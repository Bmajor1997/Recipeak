import { describe, expect, it } from "vitest";
import {
  automatic_diet,
  create_onboarding_store,
  DEFAULT_ONBOARDING,
  diets_for_kind,
  or_list,
  parse_onboarding,
  tap_diets,
  toggle_diet,
} from "../src/onboarding/onboarding";
import { explore_collage, home_shelves, SHELVES } from "../src/recipes/shelves";

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k: string) => data.get(k) ?? null,
    setItem: async (k: string, v: string) => void data.set(k, v),
    removeItem: async (k: string) => void data.delete(k),
  };
}

describe("first-launch tour answers", () => {
  it("starts with the tour not done, an even mix and no diet", async () => {
    const store = create_onboarding_store(memory());
    expect(await store.load()).toEqual(DEFAULT_ONBOARDING);
    expect(DEFAULT_ONBOARDING).toEqual({ done: false, interest: "both", diets: [], entry: "create" });
  });

  it("saves and reads back the answers", async () => {
    const store = create_onboarding_store(memory());
    const answers = { done: true, interest: "cocktails" as const, diets: ["vegan" as const], entry: "sign-in" as const };
    await store.save(answers);
    expect(await store.load()).toEqual(answers);
  });

  it("still reads answers saved before the Recipeak respelling", async () => {
    const storage = memory();
    const answers = { done: true, interest: "meals" as const, diets: [], entry: "create" as const };
    storage.data.set("recipeek.onboarding.v1", JSON.stringify(answers));
    const store = create_onboarding_store(storage);
    expect(await store.load()).toEqual(answers);
    await store.save({ ...answers, interest: "both" });
    expect(storage.data.get("recipeak.onboarding.v1")).toContain('"both"');
    expect((await store.load()).interest).toBe("both");
  });

  it("keeps valid parts of damaged data and drops the rest", () => {
    expect(parse_onboarding("not json")).toEqual(DEFAULT_ONBOARDING);
    expect(parse_onboarding("[1,2]")).toEqual(DEFAULT_ONBOARDING);
    expect(parse_onboarding(JSON.stringify({ done: true, interest: "pizza", diets: ["vegan", "keto", "vegan"], entry: 5 }))).toEqual({
      done: true,
      interest: "both",
      diets: ["vegan"],
      entry: "create",
    });
  });

  it("'Everything' clears the diets; a diet turns on and off", () => {
    expect(toggle_diet(["vegan", "gluten-free"], null)).toEqual([]);
    expect(toggle_diet([], "vegan")).toEqual(["vegan"]);
    expect(toggle_diet(["vegan", "gluten-free"], "vegan")).toEqual(["gluten-free"]);
  });

  it("opens bundled dishes in vegan before vegetarian, and leaves other diets to a tap", () => {
    expect(automatic_diet(["vegetarian", "vegan"])).toBe("vegan");
    expect(automatic_diet(["vegetarian", "gluten-free"])).toBe("vegetarian");
    expect(automatic_diet(["gluten-free"])).toBeNull();
    expect(tap_diets(["vegan", "gluten-free", "non-alcoholic"], "meal")).toEqual(["gluten-free"]);
    expect(tap_diets(["vegan", "gluten-free", "non-alcoholic"], "cocktail")).toEqual(["gluten-free", "non-alcoholic"]);
    expect(diets_for_kind(["non-alcoholic"], "meal")).toEqual([]);
  });

  it("joins diet names for the recipe hint", () => {
    expect(or_list(["gluten-free"])).toBe("gluten-free");
    expect(or_list(["gluten-free", "low-carb"])).toBe("gluten-free or low-carb");
    expect(or_list(["a", "b", "c"])).toBe("a, b or c");
  });
});

describe("Home mix", () => {
  const kinds = (mix: "cocktails" | "meals" | "both") =>
    home_shelves(20000, 10, mix)
      .flatMap((shelf) => shelf.dishes)
      .reduce((n, d) => ({ ...n, [d.kind]: (n[d.kind] ?? 0) + 1 }), {} as Record<string, number>);

  it("keeps the original even rows when the person chose both", () => {
    expect(home_shelves(20000).map((s) => s.id)).toEqual(["quick", "classics", "weekend", "alcohol-free", "brunch"]);
    expect(home_shelves(20000, 10, "both")).toEqual(home_shelves(20000));
  });

  it("shows more drinks for cocktail people and more meals for meal people, never only one kind", () => {
    const drinks = kinds("cocktails");
    const meals = kinds("meals");
    expect(drinks.cocktail).toBeGreaterThan(drinks.meal);
    expect(drinks.meal).toBeGreaterThan(0);
    expect(meals.meal).toBeGreaterThan(meals.cocktail);
    expect(meals.cocktail).toBeGreaterThan(0);
    expect(home_shelves(20000, 10, "cocktails")[0].id).toBe("classics");
    expect(home_shelves(20000, 10, "meals")[0].id).toBe("quick");
  });

  it("has a full row of each kind for the extra shelves", () => {
    expect(SHELVES["more-drinks"].dishes.every((d) => d.kind === "cocktail")).toBe(true);
    expect(SHELVES["more-meals"].dishes.every((d) => d.kind === "meal")).toBe(true);
  });

  it("tilts the Explore collage three to one", () => {
    const count = (mix: "cocktails" | "meals" | "both", kind: string) => explore_collage(20000, mix).filter((d) => d.kind === kind).length;
    expect(count("cocktails", "cocktail")).toBe(3);
    expect(count("meals", "meal")).toBe(3);
    expect(count("both", "meal")).toBe(2);
  });
});
