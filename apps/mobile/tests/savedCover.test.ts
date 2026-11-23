// Saved recipes keep the right cover photo through saving, the phone's storage, reopening the app and the card.
import { describe, expect, it, vi } from "vitest";
import { find_bundled_dish } from "../src/recipes/bundled";
import { curated_non_alcoholic } from "../src/recipes/curatedVersions";
import { create_saved_recipes } from "../src/saved/savedRecipes";
import { saved_as_current, saved_cover } from "../src/saved/savedCover";
import type { Recipe } from "../src/recipes/types";

vi.mock("expo-asset", () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- react-test-renderer's and expo-asset's own method names
  Asset: { fromModule: () => ({ downloadAsync: async () => undefined, localUri: "file:///cache/gimlet.jpg", uri: "asset:/gimlet" }) },
}));

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: async (k: string) => data.get(k) ?? null,
    setItem: async (k: string, v: string) => void data.set(k, v),
    removeItem: async (k: string) => void data.delete(k),
  };
};
const image_uri = (path: string | null) => (path ? `https://api.example${path}` : null);
const ai_recipe: Recipe = {
  title: "Ube cheesecake",
  description: "",
  servings: 8,
  prep_minutes: 1,
  cook_minutes: 1,
  ingredients: [{ amount: "1", unit: "cup", item: "ube halaya" }],
  steps: ["Bake."],
  allergens: ["milk"],
  cocktail: null,
  note: "",
};

describe("saved recipe covers", () => {
  const gimlet = find_bundled_dish("cocktail", "Gimlet")!;
  const gimlet_recipe = { ...ai_recipe, title: "Gimlet" };

  it("a saved bundled dish shows its own photo after the app opens again, without copying it", async () => {
    const storage = memory();
    const keep_photo = vi.fn(async () => "file:///docs/recipe-photos/x.jpg");
    const saved = create_saved_recipes(storage, "alice", { photos: { keep_photo, remove_photo: vi.fn() } });
    await saved.save("cocktail", gimlet_recipe, "asset:/gimlet", { bundled_id: gimlet.id });
    expect(keep_photo).not.toHaveBeenCalled();
    // A new list over the same storage stands in for reopening the app.
    const [item] = await create_saved_recipes(storage, "alice").list();
    expect(item.bundled_id).toBe("gimlet");
    expect(saved_cover(item, image_uri)).toEqual({ source: gimlet.source, uri: null, fallback_uri: null });
    const reopened = await saved_as_current(item);
    expect(reopened).toMatchObject({ localPhoto: "file:///cache/gimlet.jpg", bundledId: "gimlet", savedId: item.id });
  });

  it("a bundled dish saved before the dish id was kept (no photo) gets its photo back by name", async () => {
    const storage = memory();
    await storage.setItem(
      "mealsandmixers.saved.v2.alice",
      JSON.stringify([{ id: "old", saved_at: "2026-11-20", kind: "cocktail", recipe: gimlet_recipe, photo_uri: null }]),
    );
    const [item] = await create_saved_recipes(storage, "alice").list();
    expect(saved_cover(item, image_uri).source).toBe(gimlet.source);
  });

  it("an AI recipe keeps its copy, falls back to the library photo, and never borrows a bundled photo", async () => {
    const storage = memory();
    const saved = create_saved_recipes(storage, "alice", {
      photos: { keep_photo: async () => "file:///docs/recipe-photos/u.jpg", remove_photo: vi.fn() },
    });
    await saved.save("meal", ai_recipe, "https://api.example/images/ube.jpg", { ai: true, image_url: "/images/ube.jpg" });
    const [item] = await create_saved_recipes(storage, "alice").list();
    expect(saved_cover(item, image_uri)).toEqual({
      source: null,
      uri: "file:///docs/recipe-photos/u.jpg",
      fallback_uri: "https://api.example/images/ube.jpg",
    });
    // Without a kept copy (cover photos off, or a failed download), the library photo is used.
    expect(saved_cover({ ...item, photo_uri: null }, image_uri).uri).toBe("https://api.example/images/ube.jpg");
    // An AI recipe that happens to share a bundled dish's name keeps its own picture.
    expect(saved_cover({ ...item, recipe: gimlet_recipe, kind: "cocktail", photo_uri: null, image_url: undefined }, image_uri)).toEqual({
      source: null,
      uri: null,
      fallback_uri: null,
    });
    expect((await saved_as_current(item)).image).toEqual({ status: "ready", url: "/images/ube.jpg" });
  });

  it("a saved written non-alcoholic version survives reading Saved again", async () => {
    const storage = memory();
    const regular = {
      ...gimlet_recipe,
      ingredients: [{ amount: "2", unit: "oz", item: "gin" }],
      cocktail: {
        glass: "coupe",
        garnish: "lime wheel",
        alcoholic: true,
        non_alcoholic_version: "Shake lime juice, syrup and a few cucumber slices and top with tonic water.",
      },
    };
    const version = curated_non_alcoholic(regular)!;
    expect(version.ingredients).toEqual([]);
    await create_saved_recipes(storage, "alice").save("cocktail", version, null, { bundled_id: gimlet.id });
    const list = await create_saved_recipes(storage, "alice").list();
    expect(list.map((s) => s.recipe.title)).toEqual(["Gimlet (non-alcoholic)"]);
  });
});
