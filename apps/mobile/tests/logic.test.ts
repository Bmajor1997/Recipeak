import { describe, expect, it } from "vitest";
import { ApiError, createApi } from "../src/api/client";
import { formatIngredient, formatMinutes, recipeAsText } from "../src/recipes/format";
import { parseIdentification, parseRecipe, parseSavedList } from "../src/recipes/parse";
import type { Recipe } from "../src/recipes/types";
import { createSavedRecipes, type KeyValueStorage, SavedLimitError } from "../src/saved/savedRecipes";

const recipe: Recipe = {
  title: "Chicken Parmesan",
  description: "Breaded chicken with marinara and mozzarella.",
  servings: 4,
  prep_minutes: 20,
  cook_minutes: 25,
  ingredients: [
    { amount: "2", unit: "lb", item: "chicken breasts" },
    { amount: "", unit: "", item: "salt to taste" },
  ],
  steps: ["Bread the chicken.", "Bake at 425°F."],
  allergens: ["milk", "eggs", "wheat"],
  cocktail: null,
  note: "",
};

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v) };
}

describe("reading server replies", () => {
  it("accepts a valid identification and rejects broken ones", () => {
    const ok = parseIdentification({
      kind: "meal",
      guesses: [{ name: "Chicken Parmesan", confidence: "high" }],
      recipe,
      free_photos_left: 2,
      premium: false,
    });
    expect(ok.kind).toBe("meal");
    expect(ok.free_photos_left).toBe(2);
    expect(parseIdentification({ kind: "not_food", guesses: [], recipe: null, free_photos_left: 3 }).kind).toBe("not_food");
    expect(() => parseIdentification({ kind: "meal", guesses: [], recipe })).toThrow();
    expect(() => parseIdentification({ kind: "soup", guesses: [{ name: "x", confidence: "high" }], recipe })).toThrow();
    expect(() => parseRecipe({ ...recipe, steps: [] })).toThrow();
    expect(() => parseRecipe({ ...recipe, servings: 1.5 })).toThrow();
  });

  it("skips damaged saved entries instead of crashing", () => {
    const list = parseSavedList([
      { id: "a", saved_at: "2026-11-14T00:00:00Z", kind: "meal", recipe },
      { id: "b", kind: "meal", recipe: { title: 5 } },
      "junk",
    ]);
    expect(list.map((s) => s.id)).toEqual(["a"]);
    expect(parseSavedList("not a list")).toEqual([]);
  });
});

describe("formatting", () => {
  it("writes times and ingredients in plain words", () => {
    expect(formatMinutes(0)).toBe("No cooking");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(90)).toBe("1 hr 30 min");
    expect(formatIngredient(recipe.ingredients[0])).toBe("2 lb chicken breasts");
    expect(formatIngredient(recipe.ingredients[1])).toBe("salt to taste");
    const text = recipeAsText(recipe);
    expect(text).toContain("1. Bread the chicken.");
    expect(text).toContain("Contains: milk, eggs, wheat");
    expect(text).toContain("not the original restaurant or bar recipe");
  });
});

describe("saved recipes", () => {
  it("keeps free accounts to 3 saved recipes, from any source, but always allows re-saving one", async () => {
    let n = 0;
    const saved = createSavedRecipes(memoryStorage(), { newId: () => `id${++n}` });
    const free = { limit: 3 };
    for (const title of ["Pho", "Margarita", "Ramen"]) await saved.save("meal", { ...recipe, title }, null, free);
    await expect(saved.save("meal", { ...recipe, title: "Paella" }, null, free)).rejects.toBeInstanceOf(SavedLimitError);
    await saved.save("meal", { ...recipe, title: "Pho" }, null, free);
    expect((await saved.list()).map((s) => s.recipe.title)).toEqual(["Pho", "Ramen", "Margarita"]);
    await saved.remove((await saved.list())[0].id);
    await saved.save("meal", { ...recipe, title: "Paella" }, null, free);
    await saved.save("meal", { ...recipe, title: "Lasagna" });
    expect(await saved.list()).toHaveLength(4);
  });

  it("saves newest first, de-duplicates by title, removes, and survives damaged storage", async () => {
    const storage = memoryStorage();
    let n = 0;
    const saved = createSavedRecipes(storage, { newId: () => `id${++n}` });
    await saved.save("meal", recipe);
    await saved.save("cocktail", { ...recipe, title: "Margarita" });
    await saved.save("meal", recipe);
    expect((await saved.list()).map((s) => s.recipe.title)).toEqual(["Chicken Parmesan", "Margarita"]);
    await saved.remove("id3");
    expect((await saved.list()).map((s) => s.id)).toEqual(["id2"]);
    storage.data.set("mealsandmixers.saved.v1", "{not json");
    expect(await saved.list()).toEqual([]);
  });
});

describe("server connection", () => {
  const reply = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

  it("sends the sign-in token and checks the reply", async () => {
    let seen: RequestInit | undefined;
    const api = createApi({
      baseUrl: "https://api.example.test/",
      idToken: async () => "token123",
      fetchImpl: (async (_url: string, init: RequestInit) => {
        seen = init;
        return new Response(JSON.stringify({ premium: false, free_photos_left: 3, free_photos_total: 3 }));
      }) as typeof fetch,
    });
    expect((await api.allowance()).free_photos_left).toBe(3);
    expect((seen?.headers as Record<string, string>).Authorization).toBe("Bearer token123");
  });

  it("turns 'free photos used' into an upgrade signal and hides unexpected server text", async () => {
    const used = createApi({
      baseUrl: "https://x.test",
      idToken: async () => "t",
      fetchImpl: reply(402, { error: "Used up.", code: "FREE_PHOTOS_USED" }) as typeof fetch,
    });
    await expect(used.identify("data:image/jpeg;base64,AAAA")).rejects.toMatchObject({ needsUpgrade: true, status: 402 });
    const odd = createApi({
      baseUrl: "https://x.test",
      idToken: async () => "t",
      fetchImpl: reply(500, { error: "x".repeat(500) }) as typeof fetch,
    });
    await expect(odd.allowance()).rejects.toMatchObject({ message: "Something went wrong. Please try again." });
  });

  it("refuses to send anything when signed out or not configured", async () => {
    const calls: unknown[] = [];
    const fetchImpl = (async (...a: unknown[]) => (calls.push(a), new Response("{}"))) as typeof fetch;
    await expect(createApi({ baseUrl: "https://x.test", idToken: async () => null, fetchImpl }).allowance()).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(createApi({ baseUrl: undefined, idToken: async () => "t", fetchImpl }).allowance()).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(0);
  });
});
