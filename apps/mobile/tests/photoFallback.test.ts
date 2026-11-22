import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { find_bundled_dish } from "../src/recipes/bundled";
import { parse_identification } from "../src/recipes/parse";

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
    expect(offer).toMatch(/async function make\(\)[\s\S]*api\.recipe\(name, current\.kind\)/);
    expect(screen).toMatch(/Made with AI\. Check every ingredient and allergen/);
  });
});
