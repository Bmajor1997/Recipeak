// The app re-checks everything the server sends before showing or saving it.
import type { Allowance, CocktailDetails, Guess, Identification, Ingredient, Kind, Recipe, SavedRecipe } from "./types";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 600): string => {
  if (typeof v !== "string" || v.length > max) throw new Error("Invalid recipe");
  return v;
};
const whole = (v: unknown, max: number): number => {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0 || v > max) throw new Error("Invalid recipe");
  return v;
};
const list = <T>(v: unknown, max: number, each: (x: unknown) => T): T[] => {
  if (!Array.isArray(v) || v.length > max) throw new Error("Invalid recipe");
  return v.map(each);
};

function ingredient(v: unknown): Ingredient {
  if (!isObject(v)) throw new Error("Invalid recipe");
  return { amount: str(v.amount, 40), unit: str(v.unit, 40), item: str(v.item, 200) };
}

function cocktail(v: unknown): CocktailDetails | null {
  if (v === null) return null;
  if (!isObject(v) || typeof v.alcoholic !== "boolean") throw new Error("Invalid recipe");
  return {
    glass: str(v.glass, 80),
    garnish: str(v.garnish, 120),
    alcoholic: v.alcoholic,
    non_alcoholic_version: v.non_alcoholic_version === null ? null : str(v.non_alcoholic_version),
  };
}

export function parseRecipe(v: unknown): Recipe {
  if (!isObject(v)) throw new Error("Invalid recipe");
  const recipe: Recipe = {
    title: str(v.title, 120),
    description: str(v.description),
    servings: whole(v.servings, 100),
    prep_minutes: whole(v.prep_minutes, 2880),
    cook_minutes: whole(v.cook_minutes, 2880),
    ingredients: list(v.ingredients, 40, ingredient),
    steps: list(v.steps, 30, (s) => str(s)),
    allergens: list(v.allergens, 9, (s) => str(s, 20)),
    cocktail: cocktail(v.cocktail),
    note: str(v.note),
  };
  if (!recipe.title || !recipe.ingredients.length || !recipe.steps.length) throw new Error("Invalid recipe");
  return recipe;
}

function guess(v: unknown): Guess {
  if (!isObject(v) || !["high", "medium", "low"].includes(v.confidence as string)) throw new Error("Invalid guess");
  return { name: str(v.name, 120), confidence: v.confidence as Guess["confidence"] };
}

const photosLeft = (v: unknown): number | null => (v === null ? null : whole(v, 1000));

export function parseIdentification(v: unknown): Identification {
  if (!isObject(v)) throw new Error("Invalid reply");
  const common = { free_photos_left: photosLeft(v.free_photos_left), premium: v.premium === true };
  if (v.kind === "not_food") return { kind: "not_food", guesses: [], recipe: null, ...common };
  if (v.kind !== "meal" && v.kind !== "cocktail") throw new Error("Invalid reply");
  const guesses = list(v.guesses, 3, guess);
  if (!guesses.length) throw new Error("Invalid reply");
  return { kind: v.kind, guesses, recipe: parseRecipe(v.recipe), ...common };
}

export function parseAllowance(v: unknown): Allowance {
  if (!isObject(v)) throw new Error("Invalid reply");
  return {
    premium: v.premium === true,
    free_photos_left: photosLeft(v.free_photos_left),
    free_photos_total: whole(v.free_photos_total, 1000),
  };
}

/** Saved data on the phone can be old or damaged; skip anything that doesn't check out rather than crash. */
export function parseSavedList(v: unknown): SavedRecipe[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((item) => {
    try {
      if (!isObject(item) || (item.kind !== "meal" && item.kind !== "cocktail")) return [];
      return [{ id: str(item.id, 64), saved_at: str(item.saved_at, 40), kind: item.kind as Kind, recipe: parseRecipe(item.recipe) }];
    } catch {
      return [];
    }
  });
}
