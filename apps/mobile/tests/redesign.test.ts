import { describe, expect, it } from "vitest";
import { parseSavedList } from "../src/recipes/parse";
import { formatQuantity, parseQuantity, scaleAmount } from "../src/recipes/scale";
import { filterSaved } from "../src/recipes/search";
import type { Recipe, SavedRecipe } from "../src/recipes/types";
import { createSavedRecipes, type KeyValueStorage, type PhotoStore } from "../src/saved/savedRecipes";
import { greeting } from "../src/ui/greeting";

const base: Recipe = {
  title: "Classic Margarita",
  description: "Tequila, lime and orange liqueur.",
  servings: 1,
  prep_minutes: 5,
  cook_minutes: 0,
  ingredients: [{ amount: "2", unit: "oz", item: "blanco tequila" }],
  steps: ["Shake with ice."],
  allergens: [],
  cocktail: { glass: "Rocks glass", garnish: "Lime wheel", alcoholic: true, non_alcoholic_version: null },
  note: "",
};

describe("servings counter", () => {
  it("reads kitchen amounts", () => {
    expect(parseQuantity("1 1/2")).toBe(1.5);
    expect(parseQuantity("3/4")).toBe(0.75);
    expect(parseQuantity("½")).toBe(0.5);
    expect(parseQuantity("1½")).toBe(1.5);
    expect(parseQuantity("0.25")).toBe(0.25);
    expect(parseQuantity("a pinch")).toBeNull();
  });

  it("writes amounts as cooks expect", () => {
    expect(formatQuantity(1.5)).toBe("1 1/2");
    expect(formatQuantity(0.333)).toBe("1/3");
    expect(formatQuantity(2.97)).toBe("3");
    expect(formatQuantity(12.4)).toBe("12");
  });

  it("scales numbers and ranges, and leaves words alone", () => {
    expect(scaleAmount("2", 2)).toBe("4");
    expect(scaleAmount("3/4", 2)).toBe("1 1/2");
    expect(scaleAmount("1 1/2", 0.5)).toBe("3/4");
    expect(scaleAmount("2-3", 2)).toBe("4-6");
    expect(scaleAmount("to taste", 3)).toBe("to taste");
    expect(scaleAmount("", 3)).toBe("");
    expect(scaleAmount("1/3", 1)).toBe("1/3");
  });
});

describe("Saved search and filters", () => {
  const list: SavedRecipe[] = [
    { id: "a", saved_at: "", kind: "cocktail", recipe: base, photo_uri: null },
    {
      id: "b",
      saved_at: "",
      kind: "meal",
      recipe: {
        ...base,
        title: "Chicken Parmesan",
        description: "Breaded chicken with marinara.",
        ingredients: [{ amount: "2", unit: "lb", item: "chicken" }],
      },
      photo_uri: null,
    },
  ];
  it("filters by meals or drinks and searches names and ingredients", () => {
    expect(filterSaved(list, "", "all").map((s) => s.id)).toEqual(["a", "b"]);
    expect(filterSaved(list, "", "meal").map((s) => s.id)).toEqual(["b"]);
    expect(filterSaved(list, "tequila", "all").map((s) => s.id)).toEqual(["a"]);
    expect(filterSaved(list, "CHICKEN parm", "all").map((s) => s.id)).toEqual(["b"]);
    expect(filterSaved(list, "tequila", "meal")).toEqual([]);
  });
});

describe("photos kept with saved recipes", () => {
  function setup() {
    const data = new Map<string, string>();
    const storage: KeyValueStorage = { getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v) };
    const kept: string[] = [];
    const removed: string[] = [];
    const photos: PhotoStore = {
      keepPhoto: async (_uri, id) => {
        kept.push(id);
        return `file:///app/recipe-photos/${id}.jpg`;
      },
      removePhoto: (uri) => void removed.push(uri),
    };
    let n = 0;
    return { saved: createSavedRecipes(storage, { photos, newId: () => `id${++n}` }), kept, removed };
  }

  it("keeps the photo when saving, and deletes it when the recipe is removed", async () => {
    const { saved, kept, removed } = setup();
    const entry = await saved.save("cocktail", base, "file:///cache/photo.jpg");
    expect(entry.photo_uri).toBe("file:///app/recipe-photos/id1.jpg");
    expect(kept).toEqual(["id1"]);
    await saved.remove("id1");
    expect(removed).toEqual(["file:///app/recipe-photos/id1.jpg"]);
  });

  it("replaces the old photo when the same recipe is saved again", async () => {
    const { saved, removed } = setup();
    await saved.save("cocktail", base, "file:///cache/one.jpg");
    await saved.save("cocktail", base, "file:///cache/two.jpg");
    expect((await saved.list()).map((s) => s.photo_uri)).toEqual(["file:///app/recipe-photos/id2.jpg"]);
    expect(removed).toEqual(["file:///app/recipe-photos/id1.jpg"]);
  });

  it("still saves the recipe if the photo can't be kept, and saves without a photo", async () => {
    const data = new Map<string, string>();
    const storage: KeyValueStorage = { getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v) };
    const failing = createSavedRecipes(storage, {
      photos: { keepPhoto: async () => Promise.reject(new Error("disk full")), removePhoto: () => {} },
    });
    expect((await failing.save("cocktail", base, "file:///cache/x.jpg")).photo_uri).toBeNull();
    expect((await failing.save("meal", { ...base, title: "Soup" })).photo_uri).toBeNull();
  });

  it("only accepts photos stored on the phone, and reads older saves without photos", () => {
    const [ok, web, old] = parseSavedList([
      { id: "a", saved_at: "x", kind: "meal", recipe: base, photo_uri: "file:///app/recipe-photos/a.jpg" },
      { id: "b", saved_at: "x", kind: "meal", recipe: base, photo_uri: "https://example.com/a.jpg" },
      { id: "c", saved_at: "x", kind: "meal", recipe: base },
    ]);
    expect(ok.photo_uri).toBe("file:///app/recipe-photos/a.jpg");
    expect(web.photo_uri).toBeNull();
    expect(old.photo_uri).toBeNull();
  });
});

describe("greeting", () => {
  it("matches the time of day", () => {
    expect(greeting(8)).toBe("Good morning");
    expect(greeting(13)).toBe("Good afternoon");
    expect(greeting(19)).toBe("Good evening");
    expect(greeting(2)).toBe("Good evening");
  });
});
