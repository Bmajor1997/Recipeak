import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import verifier from "../security/verify-gitleaks-log.cjs";
import audit_gate from "../security/check-npm-audit.cjs";
import report_tool from "../security/update-vulnerability-report.cjs";

test("secret scan verifier accepts real colored output and rejects empty or broken scans", () => {
  const esc = String.fromCharCode(27);
  const colored = `${esc}[90m6:37PM${esc}[0m ${esc}[32mINF${esc}[0m ${esc}[1m569 commits scanned.${esc}[0m\n${esc}[1mno leaks found${esc}[0m`;
  assert.doesNotThrow(() => verifier.verify_gitleaks_log(colored));
  assert.doesNotThrow(() => verifier.verify_gitleaks_log("1 commit scanned.\nno leaks found"));
  for (const log of ["", "no leaks found", "0 commits scanned.\nno leaks found", "569 commits scanned.", "1 commits scanned.\n0 commits scanned.\nno leaks found", `${colored}\ncommand aborted: exit status 128`, `${colored}\nfatal: unknown revision`, `${colored}\nERR scan failed`]) {
    assert.throws(() => verifier.verify_gitleaks_log(log));
  }
});

function with_policy(text, run) {
  const dir = mkdtempSync(join(tmpdir(), "mm-policy-"));
  const policy_path = join(dir, "osv-scanner.toml");
  writeFileSync(policy_path, text);
  try { return run(policy_path); } finally { rmSync(dir, { recursive: true, force: true }); }
}

const high_audit = {
  vulnerabilities: {
    leaf: { severity: "high", via: [{ severity: "high", title: "Bad thing", url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc" }] },
    parent: { severity: "high", via: ["leaf"] },
    minor: { severity: "moderate", via: [{ severity: "moderate", title: "Small thing" }] },
  },
};

test("dependency gate blocks high/critical advisories without an active exception", () => {
  with_policy("# none\n", (policy_path) => {
    assert.deepEqual(audit_gate.blocking_findings(high_audit, { policy_path }), ["leaf: unapproved high/critical advisory", "parent: unapproved high/critical advisory"]);
    assert.deepEqual(audit_gate.blocking_findings({ vulnerabilities: {} }, { policy_path }), []);
    assert.throws(() => audit_gate.blocking_findings({ error: { code: "ENOLOCK" } }, { policy_path }));
  });
});

test("dependency gate honours only unexpired exceptions", () => {
  const policy = '[[IgnoredVulns]]\nid = "GHSA-aaaa-bbbb-cccc"\nignoreUntil = 2030-01-01\nreason = "test"\n';
  with_policy(policy, (policy_path) => {
    assert.deepEqual(audit_gate.blocking_findings(high_audit, { policy_path, now: new Date("2029-12-31T00:00:00Z") }), []);
    assert.equal(audit_gate.blocking_findings(high_audit, { policy_path, now: new Date("2030-01-02T00:00:00Z") }).length, 2);
  });
  with_policy('[[IgnoredVulns]]\nid = "GHSA-aaaa-bbbb-cccc"\n', (policy_path) => {
    assert.throws(() => audit_gate.blocking_findings(high_audit, { policy_path }));
  });
});

test("vulnerability report block is replaced in place and escapes table pipes", () => {
  const start = "<!-- AUTO-GENERATED-NPM-AUDIT:START -->";
  const end = "<!-- AUTO-GENERATED-NPM-AUDIT:END -->";
  const original = `# Report\n\n${start}\nold\n${end}\n\nfooter\n`;
  const updated = report_tool.update_report(original, { vulnerabilities: { "a|b": { severity: "low", via: [{ title: "x|y" }], fixAvailable: true } } });
  assert.match(updated, /\| Low \| x\\\|y \| a\\\|b \|/);
  assert.ok(!updated.includes("old"));
  assert.ok(updated.endsWith("\n\nfooter\n"));
  assert.match(report_tool.update_report("# Report", {}), /No npm dependency vulnerabilities detected/);
});
