import { test } from "node:test";
import assert from "node:assert/strict";
import policy from "../security/review-policy.cjs";
const bot = { id: 199175422, type: "Bot" };
const summary = (sha, findings = false, user = bot) => ({ user, updated_at: "2026-11-22T12:00:00Z", body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${JSON.stringify({ code_review: { commit_sha: sha, status: "completed", has_any_findings: findings } })} -->` });
test("review gate rejects stale, missing and spoofed reviews and unresolved threads", () => {
  const data = { head: "new", comments: [summary("new")], reviews: [], threads: [] };
  assert.equal(policy.evaluate_review(data).ready, true);
  for (const comments of [[], [summary("old")], [summary("new", false, { id: 1, type: "User" })]])
    assert.equal(policy.evaluate_review({ ...data, comments }).ready, false);
  assert.equal(policy.evaluate_review({ ...data, threads: [{ isResolved: false }] }).ready, false);
  const with_findings = { ...data, comments: [summary("new", true)], reviews: [{ user: bot, commit_id: "new", state: "COMMENTED" }], threads: [{ isResolved: true }] };
  assert.equal(policy.evaluate_review(with_findings).ready, true);
  assert.equal(policy.evaluate_review({ ...with_findings, reviews: [] }).ready, false);
  assert.equal(policy.evaluate_review({ ...with_findings, reviews: [{ user: bot, commit_id: "old", state: "COMMENTED" }] }).ready, false);
});

test("a no-findings receipt for the exact head counts after earlier findings, and nothing else does", () => {
  const head = "dad04b4b13ae041cbf8a6abdf17bcabb57cf0105";
  const receipt = (sha, text = "Didn't find any major issues. Keep it up!", user = bot) =>
    ({ user, body: `<!-- codex-review-receipt:v1 -->\n\nCodex Review: ${text}\n\n**Reviewed commit:** \`${sha}\`` });
  const state = (extra = {}) => ({ user: bot, updated_at: "2026-11-24T19:34:00Z", body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${JSON.stringify({ code_review: { commit_sha: head, status: "completed", has_any_findings: true, has_unresolved_findings: false, ...extra } })} -->` });
  const data = { head, comments: [state(), receipt("dad04b4b13")], reviews: [], threads: [{ isResolved: true }] };
  assert.equal(policy.evaluate_review(data).ready, true);
  // Another commit, findings, a spoofed author, unresolved findings or an open thread: not ready.
  for (const comments of [
    [state(), receipt("0123456789")],
    [state(), receipt("dad04b4b13", "Here are some automated review suggestions")],
    [state(), receipt("dad04b4b13", undefined, { id: 1, type: "User" })],
    [state({ has_unresolved_findings: true }), receipt("dad04b4b13")],
    [receipt("dad04b4b13")],
  ])
    assert.equal(policy.evaluate_review({ ...data, comments }).ready, false);
  assert.equal(policy.evaluate_review({ ...data, threads: [{ isResolved: false }] }).ready, false);
});

test("the trusted workflow runs the same policy covered by these tests", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../security/review-policy.cjs", import.meta.url), "utf8").replaceAll("\r\n", "\n").replace("module.exports = { evaluate_review };", "").trim();
  const workflow = readFileSync(new URL("../.github/workflows/review-readiness.yml", import.meta.url), "utf8").replaceAll("\r\n", "\n");
  const inline = workflow.split("          script: |\n")[1].split("\n").map(line => line.slice(12)).join("\n");
  assert.ok(inline.includes(source));
  assert.doesNotMatch(workflow, /uses: actions\/checkout/);
});
