/// <reference types="node" />
// The minimatch override routes every consumer through vendor/minimatch-compat, backed by patched minimatch 11.
// Ported from Votic (apps/mobile/src/config/patternDependencies.test.ts).
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const legacy = require("minimatch");
const modern = require("minimatch-modern");

describe("patched pattern matcher", () => {
  it("keeps legacy callable matching, defaults and classes backed by patched upstream code", () => {
    expect(require("minimatch-modern/package.json").version).toBe("11.0.8");
    expect(legacy("src/example.ts", "src/**/*.ts")).toBe(true);
    expect(legacy("src/example.js", "src/**/*.ts")).toBe(false);
    expect(legacy(".env", "*")).toBe(false);
    expect(legacy.defaults({ dot: true })(".env", "*")).toBe(true);
    expect(new legacy.Minimatch("*.ts")).toBeInstanceOf(modern.Minimatch);
    expect(legacy.GLOBSTAR).toBe(modern.GLOBSTAR);
    expect(legacy.match(["src/a.ts", "src/b.js"], "**/*.ts")).toEqual(["src/a.ts"]);
  });

  it("supports native Node ESM named imports used by newer tooling", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import match, { minimatch, Minimatch, defaults, makeRe, GLOBSTAR } from 'minimatch';
         if (!match('a.ts', '*.ts') || !minimatch('a.ts', '*.ts')) throw Error('matching failed');
         if (!new Minimatch('*.ts').match('a.ts') || !defaults({dot:true})('.env', '*')) throw Error('API failed');
         if (!makeRe('*.ts').test('a.ts') || !GLOBSTAR) throw Error('missing exports');
         console.log('ok');`,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(output.trim()).toBe("ok");
  });

  it("documents makeRe's test-only contract without claiming RegExp compatibility", () => {
    const pattern = legacy.makeRe("src/**/*.ts");
    expect(pattern).not.toBeInstanceOf(RegExp);
    expect(pattern.test("src/a.ts")).toBe(true);
    expect(pattern.test("src/a.js")).toBe(false);
  });
});
