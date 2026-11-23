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
  const memory = () => {
    const data = new Map<string, string>();
    return {
      data,
      getItem: async (k: string) => data.get(k) ?? null,
      setItem: async (k: string, v: string) => void data.set(k, v),
      removeItem: async (k: string) => void data.delete(k),
    };
  };
  const bundled = (id: string) => ({ type: "bundled" as const, id });
  const ai_recipe = {
    title: "Ube cheesecake",
    description: "Purple yam cheesecake.",
    servings: 8,
    prep_minutes: 30,
    cook_minutes: 60,
    ingredients: [{ amount: "1", unit: "cup", item: "ube halaya" }],
    steps: ["Bake."],
    allergens: ["milk", "eggs", "wheat"],
    cocktail: null,
    note: "",
  };

  it("keeps the newest first, without repeats, per account", async () => {
    const storage = memory();
    const alice = create_recently_viewed(storage, "alice");
    await alice.add(bundled("pho"));
    await alice.add(bundled("mojito"));
    await alice.add(bundled("pho"));
    expect(await alice.list()).toEqual([bundled("pho"), bundled("mojito")]);
    expect(await create_recently_viewed(storage, "bob").list()).toEqual([]);
    for (let i = 0; i < 20; i++) await alice.add(bundled(`dish-${i}`));
    expect((await alice.list()).length).toBe(12);
  });

  it("keeps AI recipes whole with their library photo, after a restart, deduplicated by dish name", async () => {
    const storage = memory();
    const first = create_recently_viewed(storage, "alice");
    await first.add({ type: "generated", kind: "meal", name: "Ube Cheesecake", recipe: ai_recipe, image_url: "/images/abc123.jpg" });
    await first.add(bundled("pho"));
    await first.add({ type: "generated", kind: "meal", name: "ube cheesecake", recipe: ai_recipe, image_url: "/images/abc123.jpg" });
    // A new instance stands in for the app opening again.
    const after_restart = await create_recently_viewed(storage, "alice").list();
    expect(after_restart).toHaveLength(2);
    expect(after_restart[0]).toMatchObject({ type: "generated", name: "ube cheesecake", image_url: "/images/abc123.jpg" });
    expect(after_restart[0].type === "generated" && after_restart[0].recipe.title).toBe("Ube cheesecake");
    expect(after_restart[1]).toEqual(bundled("pho"));
    expect(await create_recently_viewed(storage, "bob").list()).toEqual([]);
  });

  it("moves the old list of dish ids over, and ignores damaged or unsafe entries", async () => {
    const storage = memory();
    storage.data.set("mealsandmixers.recent.v1.alice", JSON.stringify(["pho", "mojito"]));
    const alice = create_recently_viewed(storage, "alice");
    expect(await alice.list()).toEqual([bundled("pho"), bundled("mojito")]);
    await alice.add(bundled("negroni"));
    expect(storage.data.has("mealsandmixers.recent.v1.alice")).toBe(false);
    expect(await alice.list()).toEqual([bundled("negroni"), bundled("pho"), bundled("mojito")]);
    storage.data.set(
      "mealsandmixers.recent.v2.alice",
      JSON.stringify([
        { type: "generated", kind: "meal", name: "X", recipe: { nope: true } },
        { type: "generated", kind: "meal", name: "Y", recipe: ai_recipe, image_url: "https://evil.example/x.jpg" },
      ]),
    );
    expect(await alice.list()).toEqual([{ type: "generated", kind: "meal", name: "Y", recipe: expect.anything(), image_url: null }]);
  });
});
