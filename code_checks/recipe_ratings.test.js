import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { create_app } from "../server/app.js";
import { validate_rating } from "../server/recipe_ratings.js";
import { create_usage_store } from "../server/usage_store.js";

const rating = (extra = {}) => ({ kind: "meal", dish: "Beef Pho", stars: 4, made: true, tags: ["too_salty"], note: "Great broth.", ...extra });

test("ratings are checked before they are saved", () => {
  assert.deepEqual(validate_rating(rating({ dish: "  Phở  ", tags: ["too_salty", "too_salty"] })).dish, "pho");
  for (const bad of [{ stars: 0 }, { stars: 6 }, { stars: 4.5 }, { kind: "snack" }, { dish: "" }, { made: "yes" }, { tags: ["delicious"] }, { note: "x".repeat(501) }])
    assert.throws(() => validate_rating(rating(bad)), /./, JSON.stringify(bad));
});

test("one rating per account and dish; the summary lists the lowest rated first", () => {
  const store = create_usage_store();
  try {
    store.ratings.rate("alice", rating({ stars: 2 }));
    store.ratings.rate("alice", rating({ stars: 3, note: "Better the second time." }));
    store.ratings.rate("bob", rating({ dish: "beef pho", stars: 5, made: false, tags: ["perfect"], note: "" }));
    store.ratings.rate("bob", rating({ kind: "cocktail", dish: "Mojito", stars: 1, tags: ["too_sweet"] }));
    const { dishes } = store.ratings.summary();
    assert.equal(dishes[0].dish, "mojito");
    const pho = dishes.find((d) => d.dish === "beef pho");
    assert.deepEqual([pho.ratings, pho.average, pho.made], [2, 4, 1]);
    assert.deepEqual(pho.tags, { too_salty: 1, perfect: 1 });
    assert.deepEqual(pho.notes.map((n) => n.note), ["Better the second time."]);
    assert.equal(store.ratings.summary({ min_ratings: 2 }).dishes.length, 1);
    store.ratings.remove_user("bob");
    assert.equal(store.ratings.summary().dishes.length, 1);
  } finally {
    store.close();
  }
});

test("each account has a daily limit", () => {
  const store = create_usage_store();
  try {
    for (let i = 0; i < 100; i++) store.ratings.rate("carol", rating({ dish: `Dish ${i}` }));
    assert.throws(() => store.ratings.rate("carol", rating()), (e) => e.status === 429);
  } finally {
    store.close();
  }
});

test("rating retention removes expired notes and keeps newer ratings", () => {
  let date = new Date("2024-01-01T00:00:00.000Z");
  const store = create_usage_store({}, { now: () => date });
  try {
    store.ratings.rate("alice", rating({ dish: "Old" }));
    date = new Date("2026-01-02T00:00:00.000Z");
    store.ratings.rate("alice", rating({ dish: "Fresh" }));
    store.ratings.prune();
    assert.deepEqual(store.ratings.summary().dishes.map((dish) => dish.dish), ["fresh"]);
  } finally {
    store.close();
  }
});

test("anyone signed in can rate; only admins can read the summary", async () => {
  const store = create_usage_store();
  const authorize = async (request) => {
    const m = /^Bearer (\S+)$/.exec(request.headers.authorization || "");
    return m ? { uid: m[1] } : false;
  };
  const handle = create_app({ env: { OPENAI_API_KEY: "sk-test", MM_FEEDBACK_ADMIN_UIDS: "boss" }, store, authorize, premium: async () => false, log: { warn() {} } });
  const server = createServer(handle);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, user) =>
    fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${user}` }, body: JSON.stringify(body) });
  try {
    assert.equal((await post("/api/recipe-rating", rating(), "alice")).status, 200);
    assert.equal((await post("/api/recipe-rating", rating({ stars: 9 }), "alice")).status, 400);
    assert.equal((await post("/api/admin/recipe-ratings", {}, "alice")).status, 403);
    const reply = await post("/api/admin/recipe-ratings", {}, "boss");
    assert.equal(reply.status, 200);
    assert.equal((await reply.json()).dishes[0].dish, "beef pho");
  } finally {
    server.close();
    store.close();
  }
});
