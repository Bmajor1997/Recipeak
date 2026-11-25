// Nut safety: brand-dependent ingredients (falernum, amaretto) and wording that disagrees with the ingredient list are
// never called nut-free, and show as "May contain" rather than being hidden or claimed as certain.
import { describe, expect, it } from "vitest";
import recipes from "../src/recipes/collection.json";
import { possible_allergen_line, possible_allergens } from "../src/recipes/allergenRisk";
import { curated_non_alcoholic } from "../src/recipes/curatedVersions";
import { bundled_diet_profile } from "../src/recipes/dietProfile";
import { diet_profile } from "../src/recipes/diets";
import { recipe_as_text } from "../src/recipes/format";
import { parse_recipe } from "../src/recipes/parse";
import type { Recipe } from "../src/recipes/types";

const library = (id: string) => parse_recipe((recipes as Record<string, unknown>)[id]);
const nut_free = (r: Recipe) => diet_profile(r, "cocktail").status["nut-free"]?.status;
const drink = (items: string[], extra: Partial<Recipe> = {}): Recipe => ({
  ...library("gimlet"),
  description: "A bright, sharp drink.",
  steps: ["Shake with ice and strain."],
  ingredients: items.map((item) => ({ amount: "1/2", unit: "oz", item })),
  allergens: [],
  ...extra,
});

describe("falernum", () => {
  it("the Test Pilot (velvet falernum) isn't nut-free, and may contain tree nuts", () => {
    const pilot = library("test-pilot");
    expect(bundled_diet_profile("test-pilot", pilot, "cocktail").fits).not.toContain("nut-free");
    expect(bundled_diet_profile("test-pilot", pilot, "cocktail").status["nut-free"]?.status).toBe("review");
    expect(possible_allergens(pilot)).toEqual([{ allergen: "tree nuts", because: ["falernum"] }]);
  });

  it("every library drink with falernum loses the nut-free label", () => {
    for (const id of [
      "zombie",
      "chartreuse-swizzle",
      "royal-bermuda-yacht-club",
      "corn-n-oil-cocktail",
      "pearl-diver-cocktail",
      "test-pilot",
      "three-dots-and-a-dash",
      "illegal",
    ])
      expect(bundled_diet_profile(id, library(id), "cocktail").fits, id).not.toContain("nut-free");
  });

  it("falernum of unknown formulation may contain tree nuts; a nut-free one is nut-free", () => {
    expect(nut_free(drink(["falernum"]))).toBe("review");
    expect(possible_allergens(drink(["falernum syrup"]))[0]?.allergen).toBe("tree nuts");
    for (const verified of ["nut-free falernum", "almond-free velvet falernum"]) {
      expect(nut_free(drink([verified])), verified).toBe("fits");
      expect(possible_allergens(drink([verified])), verified).toEqual([]);
    }
  });

  it("an AI alcohol-free Test Pilot whose description mentions almond isn't nut-free", () => {
    const ai = drink(["non-alcoholic dark rum", "falernum syrup, non-alcoholic", "fresh lime juice"], {
      description: "A tiki drink with lime, grapefruit, almond, and warm spice.",
    });
    expect(nut_free(ai)).not.toBe("fits");
    expect(possible_allergens(ai)).toEqual([{ allergen: "tree nuts", because: ["falernum", "the description or method"] }]);
  });
});

describe("almond syrups and amaretto", () => {
  it("orgeat and almond syrup are tree nuts, never nut-free", () => {
    for (const item of ["orgeat", "almond syrup"]) {
      expect(nut_free(drink([item])), item).not.toBe("fits");
      expect(nut_free(drink([item])), item).not.toBe("review");
    }
  });

  it("amaretto: unknown is unverified and may contain tree nuts; nut-free amaretto is nut-free", () => {
    expect(nut_free(drink(["amaretto"]))).toBe("review");
    expect(possible_allergens(drink(["amaretto"]))).toEqual([{ allergen: "tree nuts", because: ["amaretto"] }]);
    const verified = drink(["nut-free amaretto (such as Disaronno)"], { steps: ["Shake the amaretto with ice."] });
    expect(nut_free(verified)).toBe("fits");
    expect(possible_allergens(verified)).toEqual([]);
    // The library Amaretto Sour ("a nut-free, almond-flavored amaretto"): a flavor word isn't an ingredient.
    expect(bundled_diet_profile("amaretto-sour", library("amaretto-sour"), "cocktail").fits).toContain("nut-free");
  });

  it("a substitution that brings in orgeat lists tree nuts; listed allergens aren't repeated as possible", () => {
    const version = curated_non_alcoholic(library("amaretto-sour"))!;
    expect(version.allergens).toContain("tree nuts");
    expect(possible_allergens(version).map((p) => p.allergen)).not.toContain("tree nuts");
  });
});

describe("wording and incomplete information", () => {
  it("a description that names a nut the ingredients don't list isn't nut-free", () => {
    const r = drink(["fresh lime juice", "simple syrup"], { description: "Topped with toasted walnuts." });
    expect(nut_free(r)).toBe("review");
    expect(possible_allergens(r)[0]).toEqual({ allergen: "tree nuts", because: ["the description or method"] });
  });

  it("a recipe written only as a method is read from its method, and claims no diet", () => {
    const method_only = drink([], { steps: ["Shake lime, falernum syrup and soda."] });
    expect(nut_free(method_only)).toBe("review");
    expect(possible_allergens(method_only)[0]?.allergen).toBe("tree nuts");
  });

  it("shows and shares a May contain line, and nothing when there's no risk", () => {
    const pilot = library("test-pilot");
    expect(possible_allergen_line(pilot)).toBe(
      "May contain tree nuts (falernum): these depend on the brand or recipe, so check the label.",
    );
    expect(recipe_as_text(pilot)).toContain("May contain tree nuts (falernum)");
    expect(possible_allergen_line(library("gimlet"))).toBe("");
  });
});
