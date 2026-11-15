import { describe, expect, it } from "vitest";
import { create_api } from "../src/api/client";

const RECIPE = {
  title: "Chicken Parmesan",
  description: "Crisp chicken under sauce and cheese.",
  servings: 4,
  prep_minutes: 15,
  cook_minutes: 30,
  ingredients: [{ amount: "2", unit: "", item: "chicken breasts" }],
  steps: ["Bread the chicken.", "Bake with sauce and cheese."],
  allergens: ["gluten", "dairy"],
  cocktail: null,
  note: "",
};

function api_sending_to(sent: unknown[]) {
  return create_api({
    baseUrl: "https://x.test",
    id_token: async () => "t",
    fetch_impl: (async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ recipe: RECIPE, image: { status: "unavailable", url: null } }));
    }) as typeof fetch,
  });
}

describe("typing the dish name instead", () => {
  it("marks a name typed after an unreadable photo as a correction, and nothing else", async () => {
    const sent: unknown[] = [];
    const api = api_sending_to(sent);
    await api.recipe("Chicken parmesan", "meal", undefined, { correction: true });
    await api.recipe("Chicken parmesan", "meal");
    await api.recipe("Chicken parmesan", "meal", "vegetarian");
    expect(sent).toEqual([
      { name: "Chicken parmesan", kind: "meal", correction: true },
      { name: "Chicken parmesan", kind: "meal" },
      { name: "Chicken parmesan", kind: "meal", diet: "vegetarian" },
    ]);
  });
});
