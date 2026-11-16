import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import recipes from "../src/recipes/collection.json";
import { normalize_dish_name } from "../src/recipes/dishName";
import { parse_recipe } from "../src/recipes/parse";

const manifest = JSON.parse(readFileSync(join(__dirname, "../../../data/curated-photos/manifest.json"), "utf8")) as {
  photos: { file: string; kind: "meal" | "cocktail"; names: string[] }[];
};
const bundled = recipes as Record<string, unknown>;

describe("bundled collection", () => {
  it("has a valid recipe and a photo for every hand-picked dish", () => {
    for (const photo of manifest.photos) {
      const id = photo.file.replace(/\.jpg$/, "");
      const recipe = parse_recipe(bundled[id]);
      expect(recipe.ingredients.length, id).toBeGreaterThan(0);
      expect(recipe.steps.length, id).toBeGreaterThan(0);
      expect(recipe.cocktail === null, `${id} meal/cocktail details`).toBe(photo.kind === "meal");
      expect(existsSync(join(__dirname, "../assets/collection", photo.file)), id).toBe(true);
    }
    expect(Object.keys(bundled).length).toBe(manifest.photos.length);
  });

  it("only lists the nine major US allergens", () => {
    const allowed = new Set(["milk", "eggs", "fish", "shellfish", "tree nuts", "peanuts", "wheat", "soy", "sesame"]);
    for (const [id, value] of Object.entries(bundled)) {
      for (const allergen of parse_recipe(value).allergens) expect(allowed.has(allergen), `${id}: ${allergen}`).toBe(true);
    }
  });

  it("matches names the way the server does", () => {
    expect(normalize_dish_name("Piña  Colada!")).toBe("pina colada");
    expect(normalize_dish_name("Dark 'n' Stormy")).toBe("dark 'n' stormy");
  });
});
