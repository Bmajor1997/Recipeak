import { describe, expect, it } from "vitest";
import { create_tip_store, parse_seen_tips, tip_is_due, type Tip } from "../src/tips/tips";

function memory_storage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => void data.set(key, value),
    removeItem: async (key: string) => void data.delete(key),
  };
}

describe("one-time tips", () => {
  it("shows the photo-wall tip first, then Snap, and the share tip whenever it's unseen", () => {
    const none = new Set<Tip>();
    expect(tip_is_due("photo-wall", none)).toBe(true);
    expect(tip_is_due("snap", none)).toBe(false);
    expect(tip_is_due("share", none)).toBe(true);
    const wall_seen = new Set<Tip>(["photo-wall"]);
    expect(tip_is_due("snap", wall_seen)).toBe(true);
    expect(tip_is_due("photo-wall", wall_seen)).toBe(false);
  });

  it("remembers seen tips, ignores damaged values, and can show them all again", async () => {
    expect(parse_seen_tips("not json")).toEqual(new Set());
    expect(parse_seen_tips('["snap","made-up",3]')).toEqual(new Set(["snap"]));
    const storage = memory_storage();
    const store = create_tip_store(storage);
    await store.save(new Set<Tip>(["photo-wall", "share"]));
    expect(await store.load()).toEqual(new Set(["photo-wall", "share"]));
    await store.reset();
    expect(await store.load()).toEqual(new Set());
  });
});
