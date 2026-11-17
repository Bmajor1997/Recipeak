import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import recipes from "../src/recipes/collection.json";
import variants from "../src/recipes/collectionVariants.json";
import { normalize_dish_name } from "../src/recipes/dishName";
import { parse_recipe } from "../src/recipes/parse";

const manifest = JSON.parse(readFileSync(join(__dirname, "../../../data/curated-photos/manifest.json"), "utf8")) as {
  photos: { file: string; kind: "meal" | "cocktail"; names: string[]; hidden?: boolean }[];
};
// Photos marked hidden (wrong image, waiting for a new one) are left out of the app.
const shown = manifest.photos.filter((p) => !p.hidden);
const bundled = recipes as Record<string, unknown>;

describe("bundled collection", () => {
  it("has a valid recipe and a photo for every hand-picked dish", () => {
    for (const photo of shown) {
      const id = photo.file.replace(/\.jpg$/, "");
      const recipe = parse_recipe(bundled[id]);
      expect(recipe.ingredients.length, id).toBeGreaterThan(0);
      expect(recipe.steps.length, id).toBeGreaterThan(0);
      expect(recipe.cocktail === null, `${id} meal/cocktail details`).toBe(photo.kind === "meal");
      expect(existsSync(join(__dirname, "../assets/collection", photo.file)), id).toBe(true);
    }
    expect(Object.keys(bundled).length).toBe(shown.length);
    for (const photo of manifest.photos.filter((p) => p.hidden)) {
      expect(bundled[photo.file.replace(/\.jpg$/, "")], `${photo.file} is hidden`).toBeUndefined();
      expect(existsSync(join(__dirname, "../assets/collection", photo.file)), `${photo.file} is hidden`).toBe(false);
    }
  });

  it("keeps tips, make-ahead notes and variations on the upgraded recipes", () => {
    const pho = parse_recipe(bundled["pho"]);
    expect(pho.tips?.length).toBeGreaterThan(0);
    expect(pho.make_ahead).not.toBe("");
    expect(pho.variations?.length).toBeGreaterThan(0);
  });

  it("only lists the nine major US allergens", () => {
    const allowed = new Set(["milk", "eggs", "fish", "shellfish", "tree nuts", "peanuts", "wheat", "soy", "sesame"]);
    for (const [id, value] of Object.entries(bundled)) {
      for (const allergen of parse_recipe(value).allergens) expect(allowed.has(allergen), `${id}: ${allergen}`).toBe(true);
    }
  });

  it("has a valid vegetarian and vegan version for the dishes that have them", () => {
    const versions = variants as Record<string, Record<string, unknown>>;
    expect(Object.keys(versions).length).toBeGreaterThanOrEqual(60);
    const allowed = new Set(["milk", "eggs", "fish", "shellfish", "tree nuts", "peanuts", "wheat", "soy", "sesame"]);
    for (const [id, diets] of Object.entries(versions)) {
      expect(bundled[id], `${id} has a regular recipe`).toBeDefined();
      expect(Object.keys(diets).sort(), id).toEqual(["vegan", "vegetarian"]);
      for (const [diet, value] of Object.entries(diets)) {
        if (value === "same") continue;
        const recipe = parse_recipe(value);
        expect(recipe.ingredients.length, `${id} ${diet}`).toBeGreaterThan(0);
        expect(recipe.steps.length, `${id} ${diet}`).toBeGreaterThan(0);
        for (const allergen of recipe.allergens) expect(allowed.has(allergen), `${id} ${diet}: ${allergen}`).toBe(true);
        // Meat and fish never appear in a vegetarian or vegan ingredient list.
        const items = recipe.ingredients.map((i) => i.item.toLowerCase()).join(" | ");
        expect(items, `${id} ${diet}`).not.toMatch(
          /\b(chicken|beef|pork|lamb|goat|salmon|tuna|catfish|conch|tripe|anchov|shrimp paste|fish sauce|bacon|kielbasa|salami)\b/,
        );
      }
    }
  });

  it("matches names the way the server does", () => {
    expect(normalize_dish_name("Piña  Colada!")).toBe("pina colada");
    expect(normalize_dish_name("Dark 'n' Stormy")).toBe("dark 'n' stormy");
  });
});
