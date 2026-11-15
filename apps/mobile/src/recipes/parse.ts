// The app re-checks everything the server sends before showing or saving it.
import {
  type Allowance,
  type CocktailDetails,
  type DishImage,
  type Guess,
  type Identification,
  type Ingredient,
  type Kind,
  NO_IMAGE,
  type Recipe,
  type SavedRecipe,
} from "./types";

const is_object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
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
  if (!is_object(v)) throw new Error("Invalid recipe");
  return { amount: str(v.amount, 40), unit: str(v.unit, 40), item: str(v.item, 200) };
}

function cocktail(v: unknown): CocktailDetails | null {
  if (v === null) return null;
  if (!is_object(v) || typeof v.alcoholic !== "boolean") throw new Error("Invalid recipe");
  return {
    glass: str(v.glass, 80),
    garnish: str(v.garnish, 120),
    alcoholic: v.alcoholic,
    non_alcoholic_version: v.non_alcoholic_version === null ? null : str(v.non_alcoholic_version),
  };
}

export function parse_recipe(v: unknown): Recipe {
  if (!is_object(v)) throw new Error("Invalid recipe");
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

/** Only library addresses from our own server are accepted; anything else is treated as "no photo". */
export function parse_dish_image(v: unknown): DishImage {
  if (!is_object(v)) return NO_IMAGE;
  if (v.status === "ready" && typeof v.url === "string" && /^\/images\/[a-f0-9]{32}\.jpg$/.test(v.url))
    return { status: "ready", url: v.url };
  if (v.status === "pending") return { status: "pending", url: null };
  return NO_IMAGE;
}

function guess(v: unknown): Guess {
  if (!is_object(v) || !["high", "medium", "low"].includes(v.confidence as string)) throw new Error("Invalid guess");
  return { name: str(v.name, 120), confidence: v.confidence as Guess["confidence"], image: parse_dish_image(v.image) };
}

const photos_left = (v: unknown): number | null => (v === null ? null : whole(v, 1000));

export function parse_identification(v: unknown): Identification {
  if (!is_object(v)) throw new Error("Invalid reply");
  const common = { free_photos_left: photos_left(v.free_photos_left), premium: v.premium === true };
  if (v.kind === "not_food") return { kind: "not_food", guesses: [], recipe: null, ...common };
  if (v.kind !== "meal" && v.kind !== "cocktail") throw new Error("Invalid reply");
  const guesses = list(v.guesses, 3, guess);
  if (!guesses.length) throw new Error("Invalid reply");
  return { kind: v.kind, guesses, recipe: parse_recipe(v.recipe), ...common };
}

export function parse_allowance(v: unknown): Allowance {
  if (!is_object(v)) throw new Error("Invalid reply");
  return {
    premium: v.premium === true,
    free_photos_left: photos_left(v.free_photos_left),
    free_photos_total: whole(v.free_photos_total, 1000),
  };
}

/** Saved data on the phone can be old or damaged; skip anything that doesn't check out rather than crash. */
export function parse_saved_list(v: unknown): SavedRecipe[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((item) => {
    try {
      if (!is_object(item) || (item.kind !== "meal" && item.kind !== "cocktail")) return [];
      // Only a file on this phone counts as a photo; anything else (or nothing, from older saves) means no photo.
      const photo =
        typeof item.photo_uri === "string" && /^file:\/\//.test(item.photo_uri) && item.photo_uri.length < 600 ? item.photo_uri : null;
      return [
        {
          id: str(item.id, 64),
          saved_at: str(item.saved_at, 40),
          kind: item.kind as Kind,
          recipe: parse_recipe(item.recipe),
          photo_uri: photo,
        },
      ];
    } catch {
      return [];
    }
  });
}
