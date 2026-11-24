import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { find_bundled_dish } from "../src/recipes/bundled";
import { RECIPE_TIMEOUT_MS } from "../src/api/client";
import { parse_identification, parse_saved_list } from "../src/recipes/parse";

// The library lookup loads photos through expo-asset, which only runs on a phone. vi.mock is hoisted above imports.
// eslint-disable-next-line @typescript-eslint/naming-convention -- expo-asset's own method name
vi.mock("expo-asset", () => ({ Asset: { fromModule: () => ({}) } }));

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("photo of a dish Recipeak may not have", () => {
  it("reads a photo reply as names only, with no recipe", () => {
    const found = parse_identification({
      kind: "meal",
      guesses: [{ name: "Chicken Katsu", confidence: "high", image: { status: "unavailable", url: null } }],
      free_photos_left: 2,
      premium: false,
    });
    expect(found).not.toHaveProperty("recipe");
    expect(found.guesses[0].name).toBe("Chicken Katsu");
  });

  it("finds library dishes by name or alias, and nothing for a dish Recipeak doesn't have", () => {
    expect(find_bundled_dish("cocktail", "margarita")?.name).toBe("Margarita");
    expect(find_bundled_dish("meal", "Margarita")).toBeNull();
    expect(find_bundled_dish("meal", "Imaginary Test Dish")).toBeNull();
  });

  it("opens a library match straight away and otherwise asks before making anything with AI", () => {
    const camera = source("../src/camera/CameraProvider.tsx");
    expect(camera).toMatch(/find_bundled_dish\(result\.kind, top\.name\)/);
    expect(camera).toMatch(/status: "ai-offer"/);
    expect(camera).not.toMatch(/api\.recipe\(/);
  });

  it("only makes the AI recipe after the person says yes, and labels it", () => {
    const screen = source("../src/app/recipe.tsx");
    const offer = screen.slice(screen.indexOf("function AiOffer"), screen.indexOf("function Sheet("));
    expect(offer).toMatch(/Make AI recipe and photo/);
    expect(offer).toMatch(/Not now/);
    expect(offer).toMatch(/allergen/);
    expect(offer).toMatch(/async function make\(\)[\s\S]*api\.recipe\(name, current\.kind, undefined, \{ correction/);
    expect(screen).toMatch(/Made with AI\. Check every ingredient and allergen/);
  });

  it("keeps the other guesses and name entry on the question screen, so nothing has to be made with AI first", () => {
    const screen = source("../src/app/recipe.tsx");
    const offer = screen.slice(screen.indexOf("function AiOffer"), screen.indexOf("function Sheet("));
    expect(offer).toMatch(/Open \$\{dish\.name\}/);
    expect(offer).toMatch(/Which one should Recipeak make\?/);
    expect(offer).toMatch(/<ManualCorrection initialKind=\{current\.kind\}[^>]*\/>/);
  });

  it("waits long enough for a new recipe to be written and checked", () => {
    expect(RECIPE_TIMEOUT_MS).toBeGreaterThanOrEqual(2 * 60_000 + 15_000);
  });

  it("remembers that a saved recipe was made with AI", () => {
    const recipe = {
      title: "Chicken Katsu",
      description: "",
      servings: 4,
      prep_minutes: 1,
      cook_minutes: 1,
      ingredients: [{ amount: "1", unit: "", item: "chicken" }],
      steps: ["Cook."],
      allergens: [],
      cocktail: null,
      note: "",
    };
    const [ai, plain] = parse_saved_list([
      { id: "a", saved_at: "2026-11-22", kind: "meal", recipe, photo_uri: null, ai: true },
      { id: "b", saved_at: "2026-11-22", kind: "meal", recipe, photo_uri: null },
    ]);
    expect(ai.ai).toBe(true);
    expect(plain).not.toHaveProperty("ai");
    for (const tab of ["../src/app/(tabs)/saved.tsx", "../src/app/(tabs)/index.tsx"]) expect(source(tab)).toMatch(/<SavedCard /);
    expect(source("../src/saved/savedCover.ts")).toMatch(/ai: item\.ai/);
    expect(source("../src/app/recipe.tsx")).toMatch(/limit,\s+ai: current\.ai,/);
  });
});
