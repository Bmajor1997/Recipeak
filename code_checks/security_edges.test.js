// Security regressions: exercise actual HTTP routes with a local fake identity and no external services.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { create_app } from "../server/app.js";
import { create_premium_authorizer, has_premium_entitlement, PremiumVerificationError } from "../server/premium_access.js";
import { MAX_IMAGE_BYTES, parse_image, validate_recipe } from "../server/recipe_ai.js";
import { create_usage_store } from "../server/usage_store.js";

const JPEG = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]).toString("base64")}`;
const RECIPE = {
  title: "Margarita", description: "A drink.", servings: 1, prep_minutes: 5, cook_minutes: 0,
  ingredients: [{ amount: "1", unit: "oz", item: "lime juice" }], steps: ["Shake."], allergens: [],
  cocktail: { glass: "rocks", garnish: "lime", alcoholic: true, non_alcoholic_version: null }, note: "",
};
const IDENTIFIED = { kind: "cocktail", guesses: [{ name: "Margarita", confidence: "high" }] };
const RATING = { kind: "meal", dish: "Soup", stars: 3, made: true, tags: [], note: "" };

async function start_test_server({ reply = IDENTIFIED, premium = async () => false, env = {}, delay = 0 } = {}) {
  const store = create_usage_store(env);
  let calls = 0;
  const authorize = async (request) => {
    const m = /^Bearer (\S+)$/.exec(request.headers.authorization || "");
    return m ? { uid: m[1] } : false;
  };
  const fetch_impl = async () => {
    calls += 1;
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    return {
      ok: true, status: 200, headers: { get: () => "req_test" },
      json: async () => ({ status: "completed", usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
        output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: typeof reply === "string" ? reply : JSON.stringify(reply) }] }] }),
    };
  };
  const app = create_app({ env: { OPENAI_API_KEY: "sk-test-key", MM_FEEDBACK_ADMIN_UIDS: "boss", ...env },
    store, authorize, premium, fetch_impl, log: { warn() {} } });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { user = "alice", body } = {}) => {
    const response = await fetch(base + path, { method: body === undefined ? "GET" : "POST",
      headers: { ...(user ? { Authorization: `Bearer ${user}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, json: await response.json() };
  };
  return { call, store, calls: () => calls, close: async () => { await new Promise((resolve) => server.close(resolve)); store.close(); } };
}

// A client-supplied account ID must not let one person replace another person's rating.
test("rating identity comes from the authenticated account, not the request body", async (t) => {
  const s = await start_test_server(); t.after(s.close);
  assert.equal((await s.call("/api/recipe-rating", { user: "alice", body: { ...RATING, stars: 2 } })).status, 200);
  assert.equal((await s.call("/api/recipe-rating", { user: "bob", body: { ...RATING, user_id: "alice", uid: "alice", stars: 5 } })).status, 200);
  for (const path of ["/api/admin/recipe-ratings", "/api/admin/feedback/list", "/api/admin/feedback/details", "/api/admin/feedback/mutate"])
    assert.equal((await s.call(path, { user: "bob", body: { uid: "boss", id: "someone-elses-feedback" } })).status, 403);
  const result = await s.call("/api/admin/recipe-ratings", { user: "boss", body: {} });
  assert.equal(result.status, 200);
  assert.equal(result.json.dishes[0].ratings, 2);
  assert.equal(result.json.dishes[0].average, 3.5);
});

// Expired and unverifiable subscriptions cannot be treated as active Premium access.
test("subscription expiration, lifetime, grace, and malformed dates are handled safely", () => {
  const now = Date.parse("2026-06-01T12:00:00Z");
  const customer = (entitlement) => ({ subscriber: { entitlements: { premium: entitlement } } });
  const past = { purchase_date: "2026-01-01T00:00:00Z", expires_date: "2026-05-01T00:00:00Z" };
  assert.equal(has_premium_entitlement(customer(past), "premium", now), false);
  assert.equal(has_premium_entitlement(customer({ ...past, expires_date: null }), "premium", now), true);
  assert.equal(has_premium_entitlement(customer({ ...past, grace_period_expires_date: "2026-06-02T00:00:00Z" }), "premium", now), true);
  assert.throws(() => has_premium_entitlement(customer({ ...past, expires_date: "not-a-date" }), "premium", now), PremiumVerificationError);
  assert.throws(() => has_premium_entitlement({}, "premium", now), PremiumVerificationError);
});

test("expired subscriptions stop granting premium on a fresh server verification", async (t) => {
  let now = Date.parse("2026-06-01T12:00:00Z");
  const premium = create_premium_authorizer({ REVENUECAT_SECRET_API_KEY: "sk-test" }, {
    now: () => now, cacheMs: 0, fetch_impl: async () => ({ ok: true, json: async () => ({ subscriber: { entitlements: {
      premium: { purchase_date: "2026-01-01T00:00:00Z", expires_date: "2026-06-02T00:00:00Z" },
    } } }) }),
  });
  const s = await start_test_server({ premium, env: { MM_FREE_PHOTOS: "0" } }); t.after(s.close);
  assert.equal((await s.call("/api/identify", { body: { image: JPEG } })).status, 200);
  now = Date.parse("2026-06-03T00:00:00Z");
  assert.equal((await s.call("/api/identify", { body: { image: JPEG, premium: true } })).status, 402);
  assert.equal(s.calls(), 1);
});

test("a stalled subscription service fails closed within its timeout", async () => {
  const authorize = create_premium_authorizer({ REVENUECAT_SECRET_API_KEY: "sk-test" }, {
    fetch_impl: () => new Promise(() => {}), timeoutMs: 20,
  });
  await assert.rejects(authorize("alice"), PremiumVerificationError);
});

// Repeated requests must not overdraw a free allowance or use another account's allowance.
test("a burst of uploads cannot spend the same remaining free photo twice", async (t) => {
  const s = await start_test_server({ delay: 30, env: { MM_FREE_PHOTOS: "1" } }); t.after(s.close);
  const replies = await Promise.all(Array.from({ length: 5 }, () => s.call("/api/identify", { body: { image: JPEG, user_id: "bob", premium: true } })));
  assert.equal(replies.filter((r) => r.status === 200).length, 1);
  assert.equal(replies.filter((r) => r.status === 402).length, 4);
  assert.equal(s.calls(), 1);
  assert.equal((await s.call("/api/allowance", { user: "bob" })).json.free_photos_left, 1);
});

// Validate format, size, and declared media type before any paid provider request.
test("unsupported, mismatched, truncated and oversized photo data is rejected", async (t) => {
  const short = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff]).toString("base64")}`;
  const oversized = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(MAX_IMAGE_BYTES)]).toString("base64")}`;
  for (const image of [short, oversized, JPEG.replace("image/jpeg", "image/png"), JPEG.replace("image/jpeg", "image/svg+xml"), "data:image/jpeg;base64,@@@"])
    assert.equal(parse_image(image), null);
  const s = await start_test_server(); t.after(s.close);
  assert.equal((await s.call("/api/identify", { body: { image: short } })).status, 400);
  assert.equal((await s.call("/api/identify", { body: { image: JPEG.replace("image/jpeg", "image/svg+xml") } })).status, 400);
  assert.equal(s.calls(), 0);
});

// Invalid AI replies cannot be returned as recipes or consume the user's free photo.
test("incomplete AI recipes are rejected, and an unusable photo reply gives the free photo back", async (t) => {
  for (const bad of [{ ...RECIPE, ingredients: [] }, { ...RECIPE, steps: null }, { ...RECIPE, allergens: ["unknown-allergen"] },
    { ...RECIPE, ingredients: [{ amount: "1", unit: "cup", item: " " }] }, { ...RECIPE, steps: [" "] }]) {
    assert.throws(() => validate_recipe(bad));
    const s = await start_test_server({ reply: bad, premium: async () => true }); t.after(s.close);
    const result = await s.call("/api/recipe", { body: { name: "Margarita", kind: "cocktail" } });
    assert.equal(result.status, 502);
    assert.ok(!JSON.stringify(result.json).includes("sk-test-key"));
  }
  const s = await start_test_server({ reply: { kind: "cocktail", guesses: [{ name: " ", confidence: "high" }] } }); t.after(s.close);
  assert.equal((await s.call("/api/identify", { body: { image: JPEG } })).status, 502);
  assert.equal((await s.call("/api/allowance")).json.free_photos_left, 3);
});
