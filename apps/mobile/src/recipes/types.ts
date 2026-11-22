export type Ingredient = { amount: string; unit: string; item: string };

export type CocktailDetails = {
  glass: string;
  garnish: string;
  alcoholic: boolean;
  non_alcoholic_version: string | null;
};

export type Recipe = {
  title: string;
  description: string;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  ingredients: Ingredient[];
  steps: string[];
  allergens: string[];
  cocktail: CocktailDetails | null;
  note: string;
  /** Why key steps work and what to look for. Older and server recipes may not have these. */
  tips?: string[];
  /** How far ahead it can be made and how to store it. */
  make_ahead?: string;
  variations?: string[];
};

export type Kind = "meal" | "cocktail";
/** A shared cover photo from the server library: ready (with its address), still being created, or not available. */
export type DishImage = { status: "ready" | "pending" | "unavailable"; url: string | null };
export const NO_IMAGE: DishImage = { status: "unavailable", url: null };

export type Guess = { name: string; confidence: "high" | "medium" | "low"; image: DishImage };

export type Identification =
  | { kind: "not_food"; guesses: []; free_photos_left: number | null; premium: boolean }
  | { kind: Kind; guesses: Guess[]; free_photos_left: number | null; premium: boolean };

export type Allowance = { premium: boolean; free_photos_left: number | null; free_photos_total: number };

export const DIETS = ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free", "low-carb", "non-alcoholic"] as const;
export type Diet = (typeof DIETS)[number];

/** photo_uri points at a photo kept privately on this phone, or null when the recipe has no photo. */
export type SavedRecipe = { id: string; saved_at: string; kind: Kind; recipe: Recipe; photo_uri: string | null };
