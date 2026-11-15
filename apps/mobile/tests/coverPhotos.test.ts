import { describe, expect, it } from "vitest";
import { createApi } from "../src/api/client";
import { coverPlacement } from "../src/ui/coverPlacement";
import { parseDishImage, parseIdentification } from "../src/recipes/parse";
import type { Recipe } from "../src/recipes/types";

const PHOTO_ID = "0123456789abcdef0123456789abcdef";
const recipe: Recipe = {
  title: "Margarita",
  description: "Classic.",
  servings: 1,
  prep_minutes: 5,
  cook_minutes: 0,
  ingredients: [{ amount: "2", unit: "oz", item: "tequila" }],
  steps: ["Shake."],
  allergens: [],
  cocktail: { glass: "Rocks", garnish: "Lime", alcoholic: true, non_alcoholic_version: null },
  note: "",
};

describe("cover photos from the server", () => {
  it("accepts only library addresses from our own server", () => {
    expect(parseDishImage({ status: "ready", url: `/images/${PHOTO_ID}.jpg` })).toEqual({
      status: "ready",
      url: `/images/${PHOTO_ID}.jpg`,
    });
    expect(parseDishImage({ status: "pending", url: "anything" })).toEqual({ status: "pending", url: null });
    for (const bad of [
      { status: "ready", url: "https://evil.example/x.jpg" },
      { status: "ready", url: `/images/../${PHOTO_ID}.jpg` },
      { status: "ready", url: null },
      { status: "weird" },
      null,
    ]) {
      expect(parseDishImage(bad)).toEqual({ status: "unavailable", url: null });
    }
  });

  it("gives every guess a photo state, defaulting to none", () => {
    const found = parseIdentification({
      kind: "cocktail",
      guesses: [
        { name: "Margarita", confidence: "high", image: { status: "ready", url: `/images/${PHOTO_ID}.jpg` } },
        { name: "Paloma", confidence: "low" },
      ],
      recipe,
      free_photos_left: 2,
    });
    if (found.kind === "not_food") throw new Error("expected a drink");
    expect(found.guesses[0].image.status).toBe("ready");
    expect(found.guesses[1].image).toEqual({ status: "unavailable", url: null });
  });
});

describe("server connection for cover photos", () => {
  it("asks about a photo by dish and kind, and builds full addresses", async () => {
    const asked: string[] = [];
    const api = createApi({
      baseUrl: "https://api.example.test/",
      idToken: async () => "t",
      fetchImpl: (async (url: string) => {
        asked.push(url);
        return new Response(JSON.stringify({ image: { status: "ready", url: `/images/${PHOTO_ID}.jpg` } }));
      }) as typeof fetch,
    });
    expect((await api.dishImage("meal", "Chicken parm & fries")).status).toBe("ready");
    expect(asked[0]).toBe("https://api.example.test/api/dish-image?kind=meal&name=Chicken%20parm%20%26%20fries");
    expect(api.imageUri(`/images/${PHOTO_ID}.jpg`)).toBe(`https://api.example.test/images/${PHOTO_ID}.jpg`);
    expect(api.imageUri(null)).toBeNull();
  });

  it("returns the recipe together with its cover photo", async () => {
    const api = createApi({
      baseUrl: "https://x.test",
      idToken: async () => "t",
      fetchImpl: (async () => new Response(JSON.stringify({ recipe, image: { status: "pending" } }))) as typeof fetch,
    });
    const result = await api.recipe("Margarita", "cocktail", "non-alcoholic");
    expect(result.recipe.title).toBe("Margarita");
    expect(result.image.status).toBe("pending");
  });
});

describe("recipe cover placement", () => {
  it("shows the upper part of tall photos and leaves other shapes to the normal crop", () => {
    // A 2:3 photo in a 390 × 350 cover: 585 tall, shifted up by 30% of the 235 that doesn't fit.
    expect(coverPlacement(390, 350, 1.5)).toEqual({ width: 390, height: 585, top: -71 });
    expect(coverPlacement(390, 350, 0.66)).toBeNull();
    expect(coverPlacement(390, 350, null)).toBeNull();
  });
});
