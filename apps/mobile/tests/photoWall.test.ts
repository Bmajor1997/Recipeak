import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rowMotion, WALL_GAP, WALL_TILE } from "../src/ui/wallMotion";

describe("moving photo wall", () => {
  it("slides each row by exactly one copy, so the loop has no jump", () => {
    const right = rowMotion(8, false);
    expect(right.from).toBe(0);
    expect(right.to).toBe(-8 * (WALL_TILE + WALL_GAP));
    const left = rowMotion(8, true);
    expect(left.from).toBe(-8 * (WALL_TILE + WALL_GAP));
    expect(left.to).toBe(0);
  });

  it("drifts slowly", () => {
    expect(rowMotion(8, false).durationMs).toBeGreaterThanOrEqual(20_000);
  });

  it("bundles every photo the wall lists", () => {
    const list = readFileSync(join(__dirname, "../src/ui/wallPhotos.ts"), "utf8");
    const files = [...list.matchAll(/require\("\.\.\/\.\.\/assets\/wall\/([a-z0-9-]+\.jpg)"\)/g)].map((m) => m[1]);
    expect(files.length).toBeGreaterThanOrEqual(12);
    for (const file of files) expect(existsSync(join(__dirname, "../assets/wall", file)), file).toBe(true);
  });
});
