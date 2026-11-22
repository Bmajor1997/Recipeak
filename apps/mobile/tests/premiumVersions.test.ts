import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ApiError, create_api } from "../src/api/client";
import { diet_profile } from "../src/recipes/diets";
import { additions_for, is_premium_diet } from "../src/recipes/premiumVersions";
import type { Recipe } from "../src/recipes/types";

const recipe = (items: string[], title = "Test dish"): Recipe => ({
  title,
  description: "",
  servings: 4,
  prep_minutes: 10,
  cook_minutes: 20,
  ingredients: items.map((item) => ({ amount: "1", unit: "", item })),
  steps: ["Cook it."],
  allergens: [],
  cocktail: null,
  note: "",
});

describe("Premium recipe versions", () => {
  it("makes vegetarian and vegan Premium, and leaves the other diets free", () => {
    expect(is_premium_diet("vegetarian")).toBe(true);
    expect(is_premium_diet("vegan")).toBe(true);
    for (const diet of ["gluten-free", "dairy-free", "nut-free", "low-carb", "non-alcoholic"] as const)
      expect(is_premium_diet(diet)).toBe(false);
    expect(is_premium_diet(null)).toBe(false);
  });

  it("offers non-vegetarian for vegetarian meals, and both for vegan meals", () => {
    const vegetarian = recipe(["couscous", "crumbled feta", "chickpeas"]);
    expect(additions_for(diet_profile(vegetarian, "meal"), "meal")).toEqual(["non-vegetarian"]);
    const vegan = recipe(["couscous", "chickpeas", "olive oil"]);
    expect(additions_for(diet_profile(vegan, "meal"), "meal")).toEqual(["non-vegetarian", "non-vegan"]);
  });

  it("offers nothing for meat dishes or drinks", () => {
    expect(additions_for(diet_profile(recipe(["chicken thighs", "rice"]), "meal"), "meal")).toEqual([]);
    const drink = {
      ...recipe(["gin", "lime juice"]),
      cocktail: { glass: "coupe", garnish: "", alcoholic: true, non_alcoholic_version: null },
    };
    expect(additions_for(diet_profile(drink, "cocktail"), "cocktail")).toEqual([]);
  });

  it("sends the recipe on screen for a meat or dairy version, and treats the Premium refusal as an upgrade", async () => {
    let body: Record<string, unknown> = {};
    const api = create_api({
      baseUrl: "https://x.test",
      id_token: async () => "t",
      fetch_impl: (async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ recipe: recipe(["shrimp", "couscous"], "Couscous with Shrimp") }));
      }) as typeof fetch,
    });
    const made = await api.recipe_addition("Couscous Salad", "non-vegetarian", recipe(["couscous"], "Couscous Salad"));
    expect(made.title).toBe("Couscous with Shrimp");
    expect(body).toMatchObject({
      name: "Couscous Salad",
      kind: "meal",
      addition: "non-vegetarian",
      base: { title: "Couscous Salad", servings: 4 },
    });
    const refusal = new ApiError("Part of Premium.", 402, "PREMIUM_VERSIONS");
    expect(refusal.needsUpgrade).toBe(true);
    expect(refusal.upgradeReason).toBe("versions");
  });

  it("uses the same additions and Premium diets as the server", () => {
    const server = readFileSync(new URL("../../../server/recipe_ai.js", import.meta.url), "utf8");
    expect(/ADDITIONS = \[([^\]]+)\]/.exec(server)?.[1]).toBe('"non-vegetarian", "non-vegan"');
    expect(/PREMIUM_DIETS = \[([^\]]+)\]/.exec(server)?.[1]).toBe('"vegetarian", "vegan"');
  });
});
