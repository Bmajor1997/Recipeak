import { describe, expect, it } from "vitest";
import { create_recently_viewed } from "../src/recipes/recentlyViewed";
import { ALL_PAIRINGS, dish_minutes, explore_collage, home_shelves, local_day, SHELVES, tonights_pick } from "../src/recipes/shelves";

describe("Home shelves", () => {
  it("pairs a real meal with a real drink every day", () => {
    expect(ALL_PAIRINGS.length).toBeGreaterThanOrEqual(30);
    for (const p of ALL_PAIRINGS) expect([p.meal.kind, p.drink.kind]).toEqual(["meal", "cocktail"]);
    expect(tonights_pick(100)).toBe(tonights_pick(100));
    expect(tonights_pick(100)).not.toBe(tonights_pick(101));
  });

  it("fills every row and keeps each row the same all day", () => {
    const today = home_shelves(20000);
    for (const shelf of today) expect(shelf.dishes.length, shelf.id).toBe(10);
    expect(home_shelves(20000)).toEqual(today);
    expect(home_shelves(20001)[0].dishes).not.toEqual(today[0].dishes);
  });

  it("puts the right dishes on each shelf", () => {
    expect(SHELVES.quick.dishes.every((d) => d.kind === "meal" && dish_minutes(d) <= 30)).toBe(true);
    expect(SHELVES.weekend.dishes.every((d) => dish_minutes(d) >= 120)).toBe(true);
    expect(SHELVES.classics.dishes.every((d) => d.kind === "cocktail")).toBe(true);
    expect(SHELVES.brunch.dishes.length).toBe(20);
  });

  it("shows two meals and two drinks in the Explore collage", () => {
    expect(explore_collage(5).map((d) => d.kind)).toEqual(["meal", "cocktail", "meal", "cocktail"]);
  });

  it("changes day at local midnight", () => {
    const a = new Date(2026, 10, 16, 23, 59);
    const b = new Date(2026, 10, 17, 0, 1);
    expect(local_day(b) - local_day(a)).toBe(1);
  });
});

describe("recently viewed", () => {
  it("keeps the newest first, without repeats, per account", async () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: async (k: string) => data.get(k) ?? null,
      setItem: async (k: string, v: string) => void data.set(k, v),
      removeItem: async (k: string) => void data.delete(k),
    };
    const alice = create_recently_viewed(storage, "alice");
    await alice.add("pho");
    await alice.add("mojito");
    await alice.add("pho");
    expect(await alice.list()).toEqual(["pho", "mojito"]);
    expect(await create_recently_viewed(storage, "bob").list()).toEqual([]);
    for (let i = 0; i < 20; i++) await alice.add(`dish-${i}`);
    expect((await alice.list()).length).toBe(12);
  });
});
