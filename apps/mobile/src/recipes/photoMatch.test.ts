import { describe, expect, it, vi } from "vitest";

vi.mock("./collectionPhotos", () => ({
  COLLECTION: [
    { id: "margarita", name: "Margarita", kind: "cocktail", aliases: ["Classic Margarita"] },
    { id: "chicken-parmesan", name: "Chicken Parmesan", kind: "meal", aliases: ["Chicken Parm"] },
    { id: "pina-colada", name: "Piña Colada", kind: "cocktail", aliases: [] },
  ],
}));

import { match_photo_guesses } from "./photoMatch";

describe("photo recipe matching", () => {
  it("matches exact names and aliases without an AI request", () => {
    expect(match_photo_guesses("meal", [{ name: "chicken parm" }]).map((m) => m.dish.id)).toEqual(["chicken-parmesan"]);
  });

  it("normalizes accents and capitalization", () => {
    expect(match_photo_guesses("cocktail", [{ name: "PINA COLADA" }]).map((m) => m.dish.id)).toEqual(["pina-colada"]);
  });

  it("does not invent a match for a different dish or kind", () => {
    expect(match_photo_guesses("meal", [{ name: "Margarita" }])).toEqual([]);
    expect(match_photo_guesses("cocktail", [{ name: "Strawberry Margarita" }])).toEqual([]);
  });

  it("deduplicates aliases and considers only the first three guesses", () => {
    expect(match_photo_guesses("cocktail", [
      { name: "Margarita" }, { name: "Classic Margarita" }, { name: "Piña Colada" }, { name: "Unknown" },
    ]).map((m) => m.dish.id)).toEqual(["margarita", "pina-colada"]);
  });
});
