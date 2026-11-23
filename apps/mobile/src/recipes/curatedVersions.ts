// Versions a recipe already carries, so the "Make it…" options use them instead of asking the AI for a new one.
//
// Every bundled cocktail with a hand-written alcohol-free version keeps it in cocktail.non_alcoholic_version (the G
// line in data/recipes/src), and recipes made with AI carry the same field. Two kinds are written:
//   - a change to the regular drink ("Leave out the vodka", "replace gin with alcohol-free gin alternative"): the
//     regular ingredients and steps stay, with the change as the first step;
//   - a drink of its own ("Shake lime juice, syrup and a few cucumber slices and top with tonic water."): shown as
//     written, without inventing amounts.
import type { Diet, Ingredient, Recipe } from "./types";

const CHANGE = /^(?:replace|use|swap|skip|omit|leave out|substitute|same)\b/i;

// The same allergen words the server adds to AI recipes (server/recipe_ai.js), for a drink written as a sentence.
const ALLERGEN_WORDS: Record<string, RegExp> = {
  milk: /\b(?:milk|butter|buttermilk|cream|cheeses?|yogh?urt|ghee|half-and-half|whey|condensed milk|evaporated milk|irish cream)\b/,
  eggs: /\b(?:eggs?|egg (?:yolks?|whites?)|eggnog|meringue)\b/,
  "tree nuts": /\b(?:almonds?|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?|macadamias?|orgeat|amaretto|frangelico|marzipan|praline)\b/,
  peanuts: /\b(?:peanuts?|peanut butter)\b/,
  wheat: /\b(?:wheat|barley|malt|beer)\b/,
  soy: /\b(?:soy|soya|tofu|miso)\b/,
  sesame: /\b(?:sesame|tahini)\b/,
};
const NOT_AN_ALLERGEN = /\b(?:coconut|oat|rice|almond|soy|cashew) (?:milk|cream)\b|\bcream of (?:coconut|tartar)\b|\bnon-alcoholic beer\b/g;

/** Allergens named in a written version, added to the regular recipe's so none are dropped. */
function allergens_in(text: string, regular: string[]): string[] {
  const found = new Set(regular);
  const raw = text.toLowerCase();
  const plain = raw.replace(NOT_AN_ALLERGEN, " ");
  for (const [allergen, words] of Object.entries(ALLERGEN_WORDS))
    if (words.test(allergen === "tree nuts" || allergen === "peanuts" ? raw : plain)) found.add(allergen);
  return [...found];
}

/**
 * Applies the plain changes a written version names to the ingredient list: "leave out / omit / skip the vodka"
 * removes it, "replace gin with alcohol-free gin alternative" swaps it. Anything else is left for the first step.
 */
function apply_change(text: string, ingredients: Ingredient[]): Ingredient[] {
  const lower = text.toLowerCase();
  const replaced = /\breplace (?:the )?([a-z' -]+?) with (.+?)\.?$/.exec(lower);
  if (replaced) {
    const [, spirit, instead] = replaced;
    return ingredients.map((i) => (i.item.toLowerCase().includes(spirit) ? { ...i, item: instead } : i));
  }
  const left_out = /\b(?:leave out|omit|skip)(?: the)? ([a-z' -]+?)(?:[;.,]| for\b| and\b|$)/.exec(lower);
  if (left_out) return ingredients.filter((i) => !i.item.toLowerCase().includes(left_out[1].trim()));
  return ingredients;
}

/** The recipe's own alcohol-free version, or null when it has none written (the AI is asked instead). */
export function curated_non_alcoholic(recipe: Recipe): Recipe | null {
  const cocktail = recipe.cocktail;
  const written = cocktail?.non_alcoholic_version?.trim();
  if (!cocktail || !cocktail.alcoholic || !written) return null;
  const sentence = written.charAt(0).toUpperCase() + written.slice(1);
  const base = {
    ...recipe,
    title: `${recipe.title} (non-alcoholic)`,
    cocktail: { ...cocktail, alcoholic: false, non_alcoholic_version: null },
    note: "Recipeak's own alcohol-free version of this drink. Check the labels of any alcohol-free spirits you use.",
    tips: [],
    make_ahead: "",
    variations: [],
  };
  if (CHANGE.test(written))
    return {
      ...base,
      ingredients: apply_change(written, recipe.ingredients),
      description: `${recipe.description} Without alcohol: ${sentence}`,
      steps: [`To make it without alcohol: ${sentence}`, ...recipe.steps],
      allergens: allergens_in(written, recipe.allergens),
    };
  return { ...base, description: sentence, ingredients: [], steps: [sentence], allergens: allergens_in(written, recipe.allergens) };
}

/** A version the recipe already carries for this diet, so no AI request is needed. */
export function curated_version(recipe: Recipe, diet: Diet): Recipe | null {
  return diet === "non-alcoholic" ? curated_non_alcoholic(recipe) : null;
}
