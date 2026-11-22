import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import { create_app } from "../server/app.js";
import { normalize_feedback, validate_feedback } from "../server/feedback.js";
import { create_usage_store } from "../server/usage_store.js";

const body = (extra = {}) => ({
  category: "feature",
  title: "Wine pairings",
  description: "Please suggest a wine to go with each meal.",
  requestId: randomUUID(),
  ...extra,
});

function with_store(work, now) {
  const store = create_usage_store({}, now ? { now } : {});
  try {
    return work(store.feedback, store);
  } finally {
    store.close();
  }
}

async function start(env = {}) {
  const store = create_usage_store();
  const authorize = async (request) => {
    const m = /^Bearer (\S+)$/.exec(request.headers.authorization || "");
    return m ? { uid: m[1] } : false;
  };
  const handle = create_app({ env: { OPENAI_API_KEY: "sk-test", ...env }, store, authorize, premium: async () => false, log: { warn() {} } });
  const server = createServer(handle);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, payload, user = "alice") =>
    fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user}` } : {}) },
      body: JSON.stringify(payload),
    }).then(async (r) => ({ status: r.status, json: await r.json() }));
  const get = (path) => fetch(base + path);
  return { post, get, store, close: () => new Promise((r) => server.close(() => { store.close(); r(); })) };
}

test("feedback validation rejects forged identity, unknown categories, bad text and oversized input", () => {
  for (const input of [
    null, [], {},
    body({ user_id: "admin" }),
    body({ isAdmin: true }),
    body({ category: "other" }),
    body({ title: " " }),
    body({ description: "" }),
    body({ title: "a".repeat(121) }),
    body({ description: "a".repeat(5001) }),
    body({ description: "\0" }),
    body({ steps: "only for bugs" }),
    body({ requestId: "short" }),
  ])
    assert.throws(() => validate_feedback(input));
  assert.equal(normalize_feedback("  WINE　Pairings!!! "), "wine pairings");
  assert.equal(validate_feedback(body({ category: "bug", title: " Crash ", description: "It closed." })).title, "Crash");
});

test("exact duplicates group together, retries are idempotent, and originals are kept without account ids", () =>
  with_store((f) => {
    const input = body();
    const first = f.create("a", input);
    assert.deepEqual(f.create("a", input), first, "a retry of the same submission returns the same id");
    f.create("b", body({ title: " WINE pairings! ", description: "Please suggest a wine to go with each meal!" }));
    const result = f.dashboard();
    assert.equal(result.features.length, 1);
    assert.equal(result.features[0].unique_users, 2);
    assert.equal(result.totals.feature, 2);
    const details = f.details(result.features[0].id);
    assert.equal(details.submissions.length, 2);
    assert.equal(Object.hasOwn(details.submissions[0], "user_id"), false);
    assert.throws(() => f.create("a", { ...input, description: "Changed" }), (error) => error.status === 409);
  }));

test("each account can send 10 reports a day", () =>
  with_store((f) => {
    for (let i = 0; i < 10; i++) f.create("a", body({ title: `Idea ${i}` }));
    assert.throws(() => f.create("a", body({ title: "Idea 11" })), (error) => error.status === 429);
    f.create("b", body({ title: "Someone else" }));
  }));

test("administrators can update, merge and separate groups; invalid operations are refused", () =>
  with_store((f) => {
    f.create("a", body({ category: "bug", title: "Camera freezes", description: "The camera froze on Send." }));
    f.create("b", body({ category: "bug", title: "Camera stuck", description: "The camera got stuck after a photo." }));
    let bugs = f.dashboard().bugs;
    assert.equal(bugs.length, 2);
    f.mutate({ action: "update", id: bugs[0].id, status: "Planned", severity: "High", safetyFlag: false });
    f.mutate({ action: "merge", id: bugs[1].id, targetId: bugs[0].id });
    bugs = f.dashboard().bugs;
    assert.equal(bugs.length, 1);
    assert.equal(bugs[0].unique_users, 2);
    const submissions = f.details(bugs[0].id).submissions;
    f.mutate({ action: "separate", id: bugs[0].id, submissionIds: [submissions[0].id] });
    assert.equal(f.dashboard().bugs.length, 2);
    assert.throws(() => f.mutate({ action: "update", id: bugs[0].id, status: "Done", isAdmin: true }), (error) => error.status === 400);
    assert.throws(() => f.mutate({ action: "delete", id: bugs[0].id }), (error) => error.status === 400);
  }));

test("feedback older than a year is removed", () => {
  let clock = new Date("2026-01-01T12:00:00Z");
  with_store((f) => {
    f.create("a", body());
    clock = new Date("2027-01-02T12:00:00Z");
    f.prune();
    assert.equal(f.dashboard().totals.feature, 0);
  }, () => clock);
});

test("the app sends feedback; only listed administrators can read it", async (t) => {
  const s = await start({ MM_FEEDBACK_ADMIN_UIDS: "ben, other-admin" });
  t.after(s.close);
  assert.equal((await s.post("/api/feedback", body(), null)).status, 401);
  const sent = await s.post("/api/feedback", body({ category: "bug", title: "Save button", description: "Nothing happens." }));
  assert.equal(sent.status, 200);
  assert.equal(typeof sent.json.id, "string");
  assert.equal((await s.post("/api/feedback", { ...body(), title: "" })).status, 400);
  assert.equal((await s.post("/api/admin/feedback/list", {}, "alice")).status, 403);
  const list = await s.post("/api/admin/feedback/list", {}, "ben");
  assert.equal(list.status, 200);
  assert.equal(list.json.totals.bug, 1);
  const details = await s.post("/api/admin/feedback/details", { id: list.json.bugs[0].id }, "ben");
  assert.equal(details.json.submissions[0].title, "Save button");
  assert.equal((await s.post("/api/admin/feedback/details", { id: list.json.bugs[0].id }, "alice")).status, 403);
  assert.equal((await s.post("/api/admin/feedback/mutate", { action: "update", id: list.json.bugs[0].id, status: "Resolved" }, "ben")).status, 200);
});

test("nobody is an administrator unless listed", async (t) => {
  const s = await start();
  t.after(s.close);
  assert.equal((await s.post("/api/admin/feedback/list", {}, "ben")).status, 403);
});

test("the dashboard page is served with a strict content policy, and its config holds only the public web key", async (t) => {
  const s = await start({ FIREBASE_WEB_API_KEY: "public-web-key" });
  t.after(s.close);
  const page = await s.get("/admin/feedback");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Recipeak/);
  assert.match(page.headers.get("content-security-policy"), /script-src 'self'/);
  assert.equal(page.headers.get("x-frame-options"), "DENY");
  assert.equal((await s.get("/admin/feedback.js")).status, 200);
  assert.equal((await s.get("/admin/../server/main.js")).status, 404);
  assert.deepEqual(await (await s.get("/admin/feedback-config")).json(), { apiKey: "public-web-key" });
});

test("recipe reports are bug reports; offensive or unsafe ones are flagged for safety review", () =>
  with_store((f) => {
    const report = (reason, extra = {}) =>
      body({ category: "bug", title: "Recipe report: Mojito", description: `Reason: ${reason}`, report: reason, ...extra });
    for (const bad of [report("spam"), body({ report: "offensive" }), report(7)]) assert.throws(() => validate_feedback(bad));
    f.create("a", report("inaccurate"));
    f.create("b", report("unsafe", { title: "Recipe report: Fugu" }));
    const bugs = f.dashboard().bugs;
    const by_title = Object.fromEntries(bugs.map((g) => [g.title, g]));
    assert.equal(by_title["Recipe report: Mojito"].safety_flag, 0);
    assert.equal(by_title["Recipe report: Mojito"].severity, "Unassessed");
    assert.equal(by_title["Recipe report: Fugu"].safety_flag, 1);
    assert.equal(by_title["Recipe report: Fugu"].severity, "High");
    // The same words with a different reason are a different report.
    f.create("c", report("offensive"));
    assert.equal(f.dashboard().bugs.length, 3);
  }));

test("the feedback route accepts a recipe report", async () => {
  const app = await start();
  try {
    const sent = await app.post("/api/feedback", body({ category: "bug", title: "Recipe report: Daiquiri", description: "Reason: wrong dish", report: "wrong_dish" }));
    assert.equal(sent.status, 200);
    assert.equal(typeof sent.json.id, "string");
    const refused = await app.post("/api/feedback", body({ category: "feature", report: "other" }));
    assert.equal(refused.status, 400);
  } finally {
    await app.close();
  }
});
