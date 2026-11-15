import { describe, expect, it } from "vitest";
import { ApiError, create_api } from "../src/api/client";
import { format_ingredient, format_minutes, recipe_as_text } from "../src/recipes/format";
import { parse_identification, parse_recipe, parse_saved_list } from "../src/recipes/parse";
import type { Recipe } from "../src/recipes/types";
import { create_saved_recipes, type KeyValueStorage, SavedLimitError } from "../src/saved/savedRecipes";

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

function memory_storage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  };
}

describe("reading server replies", () => {
  it("accepts a valid identification and rejects broken ones", () => {
    const ok = parse_identification({
      kind: "meal",
      guesses: [{ name: "Chicken Parmesan", confidence: "high" }],
      recipe,
      free_photos_left: 2,
      premium: false,
    });
    expect(ok.kind).toBe("meal");
    expect(ok.free_photos_left).toBe(2);
    expect(parse_identification({ kind: "not_food", guesses: [], recipe: null, free_photos_left: 3 }).kind).toBe("not_food");
    expect(() => parse_identification({ kind: "meal", guesses: [], recipe })).toThrow();
    expect(() => parse_identification({ kind: "soup", guesses: [{ name: "x", confidence: "high" }], recipe })).toThrow();
    expect(() => parse_recipe({ ...recipe, steps: [] })).toThrow();
    expect(() => parse_recipe({ ...recipe, servings: 1.5 })).toThrow();
  });

  it("skips damaged saved entries instead of crashing", () => {
    const list = parse_saved_list([
      { id: "a", saved_at: "2026-11-14T00:00:00Z", kind: "meal", recipe },
      { id: "b", kind: "meal", recipe: { title: 5 } },
      "junk",
    ]);
    expect(list.map((s) => s.id)).toEqual(["a"]);
    expect(parse_saved_list("not a list")).toEqual([]);
  });
});

describe("formatting", () => {
  it("writes times and ingredients in plain words", () => {
    expect(format_minutes(0)).toBe("No cooking");
    expect(format_minutes(45)).toBe("45 min");
    expect(format_minutes(90)).toBe("1 hr 30 min");
    expect(format_ingredient(recipe.ingredients[0])).toBe("2 lb chicken breasts");
    expect(format_ingredient(recipe.ingredients[1])).toBe("salt to taste");
    const text = recipe_as_text(recipe);
    expect(text).toContain("1. Bread the chicken.");
    expect(text).toContain("Contains: milk, eggs, wheat");
    expect(text).toContain("not the original restaurant or bar recipe");
  });
});

describe("saved recipes", () => {
  it("keeps each account's saved recipes separate, and gives the old phone-wide list to one account only", async () => {
    const storage = memory_storage();
    let n = 0;
    const new_id = () => `id${++n}`;
    storage.data.set("mealsandmixers.saved.v1", JSON.stringify([{ id: "old", saved_at: "2026-11-14T00:00:00Z", kind: "meal", recipe }]));
    const alice = create_saved_recipes(storage, "alice", { new_id });
    const bob = create_saved_recipes(storage, "bob", { new_id });
    expect((await alice.list()).map((s) => s.id)).toEqual(["old"]);
    expect(storage.data.has("mealsandmixers.saved.v1")).toBe(false);
    expect(await bob.list()).toEqual([]);
    await bob.save("cocktail", { ...recipe, title: "Margarita" });
    expect((await alice.list()).map((s) => s.recipe.title)).toEqual(["Chicken Parmesan"]);
    expect((await bob.list()).map((s) => s.recipe.title)).toEqual(["Margarita"]);
    // Each account has its own free limit.
    for (const title of ["Pho", "Ramen"]) await alice.save("meal", { ...recipe, title }, null, { limit: 3 });
    await expect(alice.save("meal", { ...recipe, title: "Paella" }, null, { limit: 3 })).rejects.toBeInstanceOf(SavedLimitError);
    await bob.save("meal", { ...recipe, title: "Paella" }, null, { limit: 3 });
    expect(() => create_saved_recipes(storage, "")).toThrow();
  });

  it("keeps free accounts to 3 saved recipes, from any source, but always allows re-saving one", async () => {
    let n = 0;
    const saved = create_saved_recipes(memory_storage(), "alice", { new_id: () => `id${++n}` });
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
    const storage = memory_storage();
    let n = 0;
    const saved = create_saved_recipes(storage, "alice", { new_id: () => `id${++n}` });
    await saved.save("meal", recipe);
    await saved.save("cocktail", { ...recipe, title: "Margarita" });
    await saved.save("meal", recipe);
    expect((await saved.list()).map((s) => s.recipe.title)).toEqual(["Chicken Parmesan", "Margarita"]);
    await saved.remove("id3");
    expect((await saved.list()).map((s) => s.id)).toEqual(["id2"]);
    storage.data.set("mealsandmixers.saved.v2.alice", "{not json");
    expect(await saved.list()).toEqual([]);
  });
});

describe("server connection", () => {
  const reply = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

  it("sends the sign-in token and checks the reply", async () => {
    let seen: RequestInit | undefined;
    const api = create_api({
      baseUrl: "https://api.example.test/",
      id_token: async () => "token123",
      fetch_impl: (async (_url: string, init: RequestInit) => {
        seen = init;
        return new Response(JSON.stringify({ premium: false, free_photos_left: 3, free_photos_total: 3 }));
      }) as typeof fetch,
    });
    expect((await api.allowance()).free_photos_left).toBe(3);
    expect((seen?.headers as Record<string, string>).Authorization).toBe("Bearer token123");
  });

  it("turns 'free photos used' into an upgrade signal and hides unexpected server text", async () => {
    const used = create_api({
      baseUrl: "https://x.test",
      id_token: async () => "t",
      fetch_impl: reply(402, { error: "Used up.", code: "FREE_PHOTOS_USED" }) as typeof fetch,
    });
    await expect(used.identify("data:image/jpeg;base64,AAAA")).rejects.toMatchObject({ needsUpgrade: true, status: 402 });
    const odd = create_api({
      baseUrl: "https://x.test",
      id_token: async () => "t",
      fetch_impl: reply(500, { error: "x".repeat(500) }) as typeof fetch,
    });
    await expect(odd.allowance()).rejects.toMatchObject({ message: "Something went wrong. Please try again." });
  });

  it("refuses to send anything when signed out or not configured", async () => {
    const calls: unknown[] = [];
    const fetch_impl = (async (...a: unknown[]) => (calls.push(a), new Response("{}"))) as typeof fetch;
    await expect(create_api({ baseUrl: "https://x.test", id_token: async () => null, fetch_impl }).allowance()).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(create_api({ baseUrl: undefined, id_token: async () => "t", fetch_impl }).allowance()).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(0);
  });
});
