import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { create_app } from "../server/app.js";
import { configure } from "../server/main.js";
import { PremiumVerificationError } from "../server/premium_access.js";
import { validate_recipe, parse_image, parse_recipe_request } from "../server/recipe_ai.js";
import { create_usage_store } from "../server/usage_store.js";

const JPEG = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]).toString("base64")}`;
const RECIPE = {
  title: "Classic Margarita", description: "Tequila, lime and orange liqueur.", servings: 1, prep_minutes: 5, cook_minutes: 0,
  ingredients: [{ amount: "2", unit: "oz", item: "blanco tequila" }, { amount: "1", unit: "oz", item: "fresh lime juice" }],
  steps: ["Shake with ice.", "Strain into a salt-rimmed glass."], allergens: [],
  cocktail: { glass: "rocks", garnish: "lime wheel", alcoholic: true, non_alcoholic_version: "Swap tequila for lime soda." }, note: "",
};
const IDENTIFIED = { kind: "cocktail", guesses: [{ name: "Margarita", confidence: "high" }, { name: "Paloma", confidence: "low" }], recipe: RECIPE };

function provider(reply, { status = 200, delay = 0 } = {}) {
  const calls = [];
  const fetch_impl = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body), headers: options.headers });
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const body = typeof reply === "function" ? reply(calls.length) : reply;
    return {
      ok: status < 400, status, headers: { get: () => "req_test" },
      json: async () => status < 400 ? {
        status: "completed", usage: { input_tokens: 900, output_tokens: 300, total_tokens: 1200 },
        output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: typeof body === "string" ? body : JSON.stringify(body) }] }],
      } : { error: { code: "server_error", message: "sk-should-never-be-echoed" } },
    };
  };
  return { fetch_impl, calls };
}

async function start({ reply = IDENTIFIED, status, delay, premium = async () => false, env = {} } = {}) {
  const store = create_usage_store(env);
  const { fetch_impl, calls } = provider(reply, { status, delay });
  const warnings = [];
  const authorize = async (request) => {
    const m = /^Bearer (\S+)$/.exec(request.headers.authorization || "");
    return m ? { uid: m[1] } : false;
  };
  const handle = create_app({ env: { OPENAI_API_KEY: "sk-test-key", ...env }, store, authorize, premium, fetch_impl, log: { warn: (...a) => warnings.push(a) } });
  const server = createServer(handle);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, { user = "alice", body, raw, method = body === undefined && raw === undefined ? "GET" : "POST" } = {}) => fetch(base + path, {
    method,
    headers: { ...(user ? { Authorization: `Bearer ${user}` } : {}), ...(body !== undefined || raw ? { "Content-Type": "application/json" } : {}) },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  }).then(async (r) => ({ status: r.status, json: await r.json(), headers: r.headers }));
  return { call, calls, store, warnings, close: () => new Promise((r) => server.close(r)) };
}

test("requests without a signed-in account are refused before any work", async (t) => {
  const s = await start(); t.after(s.close);
  const r = await s.call("/api/identify", { user: null, body: { image: JPEG } });
  assert.equal(r.status, 401);
  assert.equal(s.calls.length, 0);
  assert.equal((await s.call("/healthz", { user: null })).json.ok, true);
});

test("a photo returns guesses and a validated recipe, and uses one free photo", async (t) => {
  const s = await start(); t.after(s.close);
  const r = await s.call("/api/identify", { body: { image: JPEG } });
  assert.equal(r.status, 200);
  assert.equal(r.json.kind, "cocktail");
  assert.equal(r.json.guesses.length, 2);
  assert.equal(r.json.recipe.title, "Classic Margarita");
  assert.equal(r.json.free_photos_left, 2);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const sent = s.calls[0].body;
  assert.equal(sent.store, false);
  assert.equal(sent.text.format.strict, true);
  assert.equal(sent.input[0].content[1].type, "input_image");
  assert.match(sent.safety_identifier, /^[0-9a-f]{64}$/);
  assert.notEqual(sent.safety_identifier, "alice");
  const [row] = s.store.records();
  assert.equal(row.status, "completed");
  assert.equal(row.usage_known, 1);
  assert.equal(row.total_tokens, 1200);
});

test("'not food' and unusable replies give the free photo back", async (t) => {
  const replies = [{ kind: "not_food", guesses: [], recipe: null }, "not json", { ...IDENTIFIED, recipe: { ...RECIPE, allergens: ["gluten"] } }];
  const s = await start({ reply: (n) => replies[n - 1] }); t.after(s.close);
  assert.equal((await s.call("/api/identify", { body: { image: JPEG } })).json.kind, "not_food");
  assert.equal((await s.call("/api/identify", { body: { image: JPEG } })).status, 502);
  assert.equal((await s.call("/api/identify", { body: { image: JPEG } })).status, 502);
  assert.equal((await s.call("/api/allowance")).json.free_photos_left, 3);
  assert.ok(s.warnings.length >= 2);
  assert.ok(!JSON.stringify(s.warnings).includes("not json"), "logs never contain the model's reply");
});

test("after 3 free photos the next one is refused before calling OpenAI", async (t) => {
  const s = await start(); t.after(s.close);
  for (let i = 0; i < 3; i++) assert.equal((await s.call("/api/identify", { body: { image: JPEG } })).status, 200);
  const r = await s.call("/api/identify", { body: { image: JPEG } });
  assert.equal(r.status, 402);
  assert.equal(r.json.code, "FREE_PHOTOS_USED");
  assert.equal(s.calls.length, 3);
  // Another account is unaffected.
  assert.equal((await s.call("/api/identify", { user: "bob", body: { image: JPEG } })).status, 200);
});

test("two uploads at once cannot both use the last free photo", async (t) => {
  const s = await start({ delay: 50, env: { MM_FREE_PHOTOS: "1" } }); t.after(s.close);
  const results = await Promise.all([s.call("/api/identify", { body: { image: JPEG } }), s.call("/api/identify", { body: { image: JPEG } })]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 402]);
  assert.equal(s.calls.length, 1);
});

test("subscribers are not limited by free photos; an unverifiable subscription fails safely", async (t) => {
  const s = await start({ premium: async () => true, env: { MM_FREE_PHOTOS: "0" } }); t.after(s.close);
  const r = await s.call("/api/identify", { body: { image: JPEG } });
  assert.equal(r.status, 200);
  assert.equal(r.json.free_photos_left, null);
  const down = await start({ premium: async () => { throw new PremiumVerificationError(); } }); t.after(down.close);
  assert.equal((await down.call("/api/identify", { body: { image: JPEG } })).status, 503);
  assert.equal(down.calls.length, 0);
});

test("a provider error keeps the cost reservation, returns no provider text, and gives the photo back", async (t) => {
  const s = await start({ status: 500 }); t.after(s.close);
  const r = await s.call("/api/identify", { body: { image: JPEG } });
  assert.equal(r.status, 502);
  assert.ok(!JSON.stringify(r.json).includes("sk-"));
  const [row] = s.store.records();
  assert.equal(row.status, "provider-error");
  assert.ok(row.estimated_cost_usd > 0);
  assert.equal(s.store.free_photos_left("alice"), 3);
});

test("bad uploads are rejected without calling OpenAI", async (t) => {
  const s = await start(); t.after(s.close);
  const fake_jpeg = `data:image/jpeg;base64,${Buffer.from("this is not really a photo at all").toString("base64")}`;
  assert.equal((await s.call("/api/identify", { body: { image: fake_jpeg } })).status, 400);
  assert.equal((await s.call("/api/identify", { body: { image: "https://example.com/x.jpg" } })).status, 400);
  assert.equal((await s.call("/api/identify", { raw: "{not json" })).status, 400);
  const huge = `data:image/jpeg;base64,${Buffer.alloc(5 * 1024 * 1024, 1).toString("base64")}`;
  assert.equal((await s.call("/api/identify", { body: { image: huge } })).status, 413);
  assert.equal(s.calls.length, 0);
});

test("follow-up recipes (other guesses, diet versions) need a counted photo and are capped for free users", async (t) => {
  const s = await start({ reply: (n) => (n === 1 ? IDENTIFIED : RECIPE) }); t.after(s.close);
  const ask = { name: "Paloma", kind: "cocktail", diet: "non-alcoholic" };
  // bob has never taken a photo, so no free follow-ups.
  assert.equal((await s.call("/api/recipe", { user: "bob", body: ask })).status, 402);
  assert.equal((await s.call("/api/identify", { body: { image: JPEG } })).status, 200);
  for (let i = 0; i < 5; i++) assert.equal((await s.call("/api/recipe", { body: ask })).status, 200);
  assert.equal((await s.call("/api/recipe", { body: ask })).json.code, "FREE_PHOTOS_USED");
  assert.match(s.calls[1].body.input[0].content[0].text, /non-alcoholic/);
  assert.equal(s.store.free_photos_left("alice"), 2, "follow-ups don't use free photos");
  assert.equal((await s.call("/api/recipe", { body: { ...ask, diet: "carnivore" } })).status, 400);
});

test("reply and request validation", () => {
  assert.throws(() => validate_recipe({ ...RECIPE, ingredients: [] }));
  assert.throws(() => validate_recipe({ ...RECIPE, servings: -1 }));
  assert.equal(validate_recipe({ ...RECIPE, allergens: ["milk", "milk"] }).allergens.length, 1);
  assert.equal(parse_image(JPEG.replace("image/jpeg", "image/png")), null, "the label must match the real file type");
  assert.equal(parse_recipe_request({ name: "  ", kind: "meal" }), null);
  assert.equal(parse_recipe_request({ name: "Pad thai", kind: "drink" }), null);
  assert.deepEqual(parse_recipe_request({ name: "Pad thai", kind: "meal" }), { name: "Pad thai", kind: "meal", diet: null });
});

test("production refuses to start without its secrets or with the development sign-in bypass", () => {
  assert.throws(() => configure({ NODE_ENV: "production", OPENAI_API_KEY: "x" }), /FIREBASE_PROJECT_ID, MM_AI_USAGE_DB, REVENUECAT_SECRET_API_KEY/);
  assert.throws(() => configure({ NODE_ENV: "production", OPENAI_API_KEY: "x", FIREBASE_PROJECT_ID: "p", MM_AI_USAGE_DB: "/tmp/x.db",
    REVENUECAT_SECRET_API_KEY: "k", MM_DEV_ALLOW_UNAUTHENTICATED: "1" }), /must not be set in production/);
  assert.throws(() => configure({ OPENAI_API_KEY: "x" }), /FIREBASE_PROJECT_ID, or MM_DEV_ALLOW_UNAUTHENTICATED/);
  assert.ok(configure({ OPENAI_API_KEY: "x", MM_DEV_ALLOW_UNAUTHENTICATED: "1" }).store);
});
