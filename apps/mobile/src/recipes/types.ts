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
};

export type Kind = "meal" | "cocktail";
export type Guess = { name: string; confidence: "high" | "medium" | "low" };

export type Identification =
  | { kind: "not_food"; guesses: []; recipe: null; free_photos_left: number | null; premium: boolean }
  | { kind: Kind; guesses: Guess[]; recipe: Recipe; free_photos_left: number | null; premium: boolean };

export type Allowance = { premium: boolean; free_photos_left: number | null; free_photos_total: number };

export const DIETS = ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free", "low-carb", "non-alcoholic"] as const;
export type Diet = (typeof DIETS)[number];

export type SavedRecipe = { id: string; saved_at: string; kind: Kind; recipe: Recipe };
