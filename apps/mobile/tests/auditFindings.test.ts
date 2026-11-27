// Regressions from the 2026-11-27 audit of main (09832ae): the saved list's changes run one at a time, a written
// alcohol-free version with a second change isn't half-applied, and butter lettuce isn't dairy.
import { describe, expect, it, vi } from "vitest";
import recipes from "../src/recipes/collection.json";
import { COLLECTION } from "../src/recipes/collectionPhotos";
import { with_ingredient_allergens } from "../src/recipes/allergenRisk";
import { curated_non_alcoholic } from "../src/recipes/curatedVersions";
import { generated_as_current } from "../src/recipes/recentItems";
import { saved_as_current } from "../src/saved/savedCover";
import { bundled_diet_profile } from "../src/recipes/dietProfile";
import { diet_profile } from "../src/recipes/diets";
import { parse_recipe } from "../src/recipes/parse";
import type { Recipe } from "../src/recipes/types";
import { create_saved_recipes } from "../src/saved/savedRecipes";

// eslint-disable-next-line @typescript-eslint/naming-convention -- expo-asset's own method name
vi.mock("expo-asset", () => ({ Asset: { fromModule: () => ({}) } }));

const recipe = (title: string): Recipe => ({
  title,
  description: "",
  servings: 1,
  prep_minutes: 1,
  cook_minutes: 1,
  ingredients: [{ amount: "1", unit: "", item: "rice" }],
  steps: ["Cook."],
  allergens: [],
  cocktail: null,
  note: "",
});

/** Storage whose next read can be held, so another change can run in between, like on a slow phone. */
function storage_with_a_pause() {
  const data = new Map<string, string>();
  let pause_next = false;
  let resume: () => void = () => {};
  return {
    pause_next_read: () => (pause_next = true),
    resume: () => resume(),
    getItem: async (k: string) => {
      const value = data.get(k) ?? null;
      if (pause_next) {
        pause_next = false;
        await new Promise<void>((r) => (resume = r));
      }
      return value;
    },
    setItem: async (k: string, v: string) => void data.set(k, v),
    removeItem: async (k: string) => void data.delete(k),
  };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const COVER = "/images/cccccccccccccccccccccccccccccccc.jpg";

describe("saved list changes run one at a time", () => {
  it("a cover found while the recipe is being removed doesn't bring it back", async () => {
    const storage = storage_with_a_pause();
    const saved = create_saved_recipes(storage, "alice");
    const pho = await saved.save("meal", recipe("Pho"), null, { ai: true });
    storage.pause_next_read();
    const restoring = saved.restore_cover(pho.id, COVER); // reads, then waits
    await tick();
    const removing = saved.remove(pho.id); // the person removes it meanwhile
    await tick();
    storage.resume();
    await Promise.all([restoring, removing]);
    expect(await saved.list()).toEqual([]);
  });

  it("a cover found while another recipe is being saved doesn't drop the new one", async () => {
    const storage = storage_with_a_pause();
    const saved = create_saved_recipes(storage, "alice");
    const pho = await saved.save("meal", recipe("Pho"), null, { ai: true });
    storage.pause_next_read();
    const restoring = saved.restore_cover(pho.id, COVER);
    await tick();
    const saving = saved.save("meal", recipe("Ramen"), null, { ai: true });
    await tick();
    storage.resume();
    await Promise.all([restoring, saving]);
    const list = await saved.list();
    expect(list.map((s) => s.recipe.title).sort()).toEqual(["Pho", "Ramen"]);
    expect(list.find((s) => s.id === pho.id)!.image_url).toBe(COVER);
  });

  it("a failed change doesn't stop the next one", async () => {
    const storage = storage_with_a_pause();
    const saved = create_saved_recipes(storage, "alice");
    await saved.save("meal", recipe("A"), null);
    await saved.save("meal", recipe("B"), null);
    await expect(saved.save("meal", recipe("C"), null, { limit: 2 })).rejects.toThrow();
    await saved.save("meal", recipe("A"), null, { limit: 2 }); // re-saving is always allowed
    expect((await saved.list()).map((s) => s.recipe.title)).toEqual(["A", "B"]);
  });
});

describe("written alcohol-free versions with a second change", () => {
  const sour: Recipe = {
    ...recipe("Bourbon Sour"),
    allergens: ["eggs"],
    ingredients: ["bourbon", "lemon juice", "simple syrup", "egg white"].map((item) => ({ amount: "1", unit: "oz", item })),
    cocktail: { glass: "coupe", garnish: "", alcoholic: true, non_alcoholic_version: "" },
  };
  const with_text = (text: string): Recipe => ({ ...sour, cocktail: { ...sour.cocktail!, non_alcoholic_version: text } });

  it("never builds a half-applied list (egg white kept, the replacement lost)", () => {
    const version = curated_non_alcoholic(with_text("Replace the bourbon with cold black tea and use aquafaba instead of egg white."));
    if (version) {
      const items = version.ingredients.map((i) => i.item);
      expect(items).not.toContain("egg white");
      expect(items).not.toContain("aquafaba");
    }
  });
  it("still swaps a plain replacement", () => {
    const version = curated_non_alcoholic(with_text("Replace the bourbon with cold black tea."))!;
    expect(version.ingredients.map((i) => i.item)).toEqual(["cold black tea", "lemon juice", "simple syrup", "egg white"]);
    expect(version.allergens).toContain("eggs");
  });
});

describe("butter lettuce isn't dairy", () => {
  it("a salad of butter lettuce is already dairy-free", () => {
    const salad = {
      ...recipe("Salad"),
      ingredients: ["butter lettuce", "tomato", "olive oil"].map((item) => ({ amount: "1", unit: "", item })),
    };
    expect(diet_profile(salad, "meal").fits).toEqual(expect.arrayContaining(["dairy-free", "vegan"]));
  });
  it("Gochujang Beef Lettuce Wraps is labelled dairy-free instead of offering a dairy-free version", () => {
    const dish = COLLECTION.find((d) => d.id === "gochujang-beef-lettuce-wraps")!;
    const profile = bundled_diet_profile(dish.id, parse_recipe((recipes as Record<string, unknown>)[dish.id]), "meal");
    expect(profile.fits).toContain("dairy-free");
    expect(profile.options).not.toContain("dairy-free");
  });
  it("real butter is still dairy", () => {
    const dish = COLLECTION.find((d) => d.id === "lobster-roll")!;
    const profile = bundled_diet_profile(dish.id, parse_recipe((recipes as Record<string, unknown>)[dish.id]), "meal");
    expect(profile.fits).not.toContain("dairy-free");
  });
});

describe("AI recipes kept on the phone get the allergens their ingredients name", () => {
  // Saved before the server added allergens from the ingredients: butter and egg white, but none listed.
  const under_listed: Recipe = {
    ...recipe("Low-Carb Gimlet"),
    ingredients: ["butter", "egg white", "gin"].map((item) => ({ amount: "1", unit: "oz", item })),
  };

  it("from Saved", async () => {
    const opened = await saved_as_current({ id: "s1", saved_at: "1", kind: "cocktail", recipe: under_listed, photo_uri: null, ai: true });
    expect(opened.recipe.allergens).toEqual(["milk", "eggs"]);
  });

  it("from Recently viewed", () => {
    const opened = generated_as_current({
      type: "generated",
      kind: "cocktail",
      name: "Low-Carb Gimlet",
      recipe: under_listed,
      image_url: null,
    });
    expect(opened.recipe.allergens).toEqual(["milk", "eggs"]);
  });

  it("never removes one, keeps the server's order, and doesn't call a plant-based stand-in dairy", () => {
    expect(with_ingredient_allergens({ ...under_listed, allergens: ["sesame"] }).allergens).toEqual(["milk", "eggs", "sesame"]);
    const plant = {
      ...recipe("Vegan toast"),
      ingredients: ["vegan butter", "vegan almond milk", "bread"].map((item) => ({ amount: "1", unit: "", item })),
    };
    const checked = with_ingredient_allergens(plant).allergens;
    expect(checked).toContain("tree nuts");
    expect(checked).not.toContain("milk");
  });

  it("leaves a recipe that already lists everything unchanged, and bundled saved recipes as the library has them", async () => {
    const complete = { ...under_listed, allergens: ["milk", "eggs"] };
    expect(with_ingredient_allergens(complete)).toBe(complete);
    const dish = COLLECTION.find((d) => d.id === "gimlet")!;
    const library = parse_recipe((recipes as Record<string, unknown>)[dish.id]);
    const opened = await saved_as_current({
      id: "s2",
      saved_at: "1",
      kind: "cocktail",
      recipe: library,
      photo_uri: null,
      bundled_id: dish.id,
    });
    expect(opened.recipe.allergens).toEqual(library.allergens);
  });

  it("doesn't read plant foods as dairy, as the server doesn't (Codex review of cf8c7f9)", () => {
    for (const item of ["coconut yogurt", "oat yoghurt", "apple butter", "vegan almond milk", "vegan cream cheese"]) {
      const checked = with_ingredient_allergens({ ...recipe("Plant"), ingredients: [{ amount: "1", unit: "cup", item }] }).allergens;
      expect(checked, item).not.toContain("milk");
    }
    // "Vegan" never hides wheat (Codex review of 324facd).
    for (const item of ["vegan whole wheat bread", "vegan all-purpose flour", "vegan wheat noodles"]) {
      const checked = with_ingredient_allergens({ ...recipe("Bread"), ingredients: [{ amount: "1", unit: "cup", item }] }).allergens;
      expect(checked, item).toContain("wheat");
    }
    const real = with_ingredient_allergens({ ...recipe("Dairy"), ingredients: [{ amount: "1", unit: "cup", item: "greek yogurt" }] });
    expect(real.allergens).toContain("milk");
  });
});
