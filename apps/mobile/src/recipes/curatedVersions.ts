// Versions a recipe already carries, so the "Make it…" options use them instead of asking the AI for a new one.
//
// Every bundled cocktail with a hand-written alcohol-free version keeps it in cocktail.non_alcoholic_version (the G
// line in data/recipes/src), and recipes made with AI carry the same field. Two kinds are written:
//   - a change to the regular drink ("Leave out the vodka", "replace gin with alcohol-free gin alternative"): every
//     alcoholic ingredient is swapped for what the change names or left out, and the steps follow;
//   - a drink of its own ("Shake lime juice, syrup and a few cucumber slices and top with tonic water."): shown as
//     written, without inventing amounts.
// A version is only built from the regular recipe when no alcohol is left in its ingredients or steps afterwards.
// Otherwise it is shown as written, so an unchanged alcoholic recipe is never labelled alcohol-free.
import type { Diet, Ingredient, Recipe } from "./types";

const CHANGE = /^(?:replace|use|swap|skip|omit|leave out|substitute|same)\b/i;

// Alcoholic drinks named in an ingredient or a step.
const ALCOHOL =
  /\b(?:vodka|gin|rum|tequila|mezcal|whiske?y|bourbon|rye|scotch|brandy|cognac|vermouth|liqueurs?|campari|aperol|prosecco|champagne|cava|wine|beers?|absinthe|amaro|sake|pisco|cacha[cç]a|spirits?|bitters|cointreau|triple sec|cura[cç]ao|kahl[uú]a|chartreuse|amaretto|irish cream|lillet|sherry|port|soju|hard cider|aperitivo|aperitif|schnapps|grappa|ouzo|limoncello|frangelico|baileys|pastis|sambuca|lager|ale|stout|pilsner|cerveza|liquor|alcohol|brandied|spiked|boozy|[a-z]+-soaked)\b(?!-)/gi;
// Words that look alcoholic here but aren't.
const NOT_ALCOHOL =
  /\b(?:alcohol-free|non-alcoholic|zero-proof)(?: (?!and\b|or\b|with\b)[a-z'-]+){0,4}|\b(?:ginger|root|birch) beers?\b|\bginger ales?\b|\bwine glass(?:es)?\b|\b(?:wine|sherry|cider|rice) vinegar\b|\bfor no alcohol at all\b|\bwithout alcohol\b/gi;
const plain = (text: string) => text.replace(NOT_ALCOHOL, " ");
const alcohol_words = (text: string) => [...plain(text).matchAll(ALCOHOL)].map((m) => m[0].toLowerCase());
const has_alcohol = (text: string) => alcohol_words(text).length > 0;
/** A garnish without its alcohol: "brandied cherry" → "cherry". Nothing is left when the garnish was only alcohol. */
const garnish_without_alcohol = (garnish: string) =>
  has_alcohol(garnish)
    ? plain(garnish)
        .replace(ALCOHOL, "")
        .replace(/\s{2,}/g, " ")
        .replace(/^[\s,]+|[\s,]+$/g, "")
    : garnish;
const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A step that reads badly once a word is taken out ("then add .", "in first, then .").
const BROKEN =
  /\b(?:with|in|add|the|and|then|of|into|first)\s*[.,;!]|\bwith (?:drop|add|stir|top|pour|shake|strain|fill)\b|\s[.,;]|\s{2,}|^[\s,.;]|,\s*\./i;

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
  const without = raw.replace(NOT_AN_ALLERGEN, " ");
  for (const [allergen, words] of Object.entries(ALLERGEN_WORDS))
    if (words.test(allergen === "tree nuts" || allergen === "peanuts" ? raw : without)) found.add(allergen);
  return [...found];
}

/** "1½ oz coconut water" → an ingredient with its amount; anything else is the item as written. */
function as_ingredient(text: string, fallback: Ingredient): Ingredient {
  const measured = /^([\d½¼¾⅓⅔/.\s]+)\s*(oz|ml|cups?|tbsp|tsp|dashes?)\s+(.+)$/i.exec(text.trim());
  return measured ? { amount: measured[1].trim(), unit: measured[2], item: measured[3] } : { ...fallback, item: text.trim() };
}

/** Takes an alcoholic word out of a step, with the words around it that only belong to it. */
function without_word(step: string, word: string): string {
  const w = escape(word);
  return step
    .replace(new RegExp(`,? (?:then |and )?(?:add|stir in|pour in|top with|float) (?:the )?${w}\\b`, "gi"), "")
    .replace(new RegExp(`\\b(?:the )?${w}(?:,| and) `, "gi"), "")
    .replace(new RegExp(`(?:,| and) (?:the )?${w}\\b`, "gi"), "")
    .replace(new RegExp(`\\b(?:the )?${w}\\b(?!-)`, "gi"), "");
}

/**
 * The regular recipe without alcohol, following a written change: "replace X with Y" swaps X, one alcohol-free
 * product named ("use an alcohol-free tequila alternative") replaces the one spirit, and everything else alcoholic is
 * left out. Null when that can't be done cleanly (then the version is shown as written).
 */
function changed_recipe(written: string, recipe: Recipe): Pick<Recipe, "ingredients" | "steps"> | null {
  const lower = written.toLowerCase();
  const replace = /\breplace (?:the )?([a-z' -]+?) with (.+?)\.?$/.exec(lower);
  const products = [
    ...lower.matchAll(
      /(?:\d[\d½¼¾/.\s]*\s*oz\s+)?(?:alcohol-free|non-alcoholic)\s[a-z -]*?(?:alternative|aperitivo|sparkling wine|wine|beer)s?\b/g,
    ),
  ].map((m) => m[0]);
  const alcoholic = recipe.ingredients.filter((i) => has_alcohol(i.item));
  if (!alcoholic.length) return null;
  // A named product must take the place of the one spirit; several of either can't be matched up safely.
  if (!replace && products.length > 0 && (products.length > 1 || alcoholic.length > 1)) return null;
  const swaps = new Map<string, string>(); // alcoholic word in the steps → what takes its place
  const removed: string[] = [];
  const ingredients = recipe.ingredients.flatMap((i): Ingredient[] => {
    if (!has_alcohol(i.item)) return [i];
    const words = alcohol_words(i.item);
    const instead =
      replace && i.item.toLowerCase().includes(replace[1].trim())
        ? replace[2]
        : !replace && products.length === 1 && alcoholic.length === 1
          ? products[0]
          : null;
    if (instead) {
      const swapped = as_ingredient(instead, i);
      for (const w of words) swaps.set(w, swapped.item);
      return [swapped];
    }
    removed.push(...words);
    return [];
  });
  const steps = recipe.steps.flatMap((step) => {
    let next = step;
    for (const [w, instead] of swaps) next = next.replace(new RegExp(`\\b${escape(w)}\\b`, "gi"), instead);
    for (const w of [...removed, "spirit", "spirits", "liquor"]) next = without_word(next, w);
    next = next.replace(/^\s+/, "");
    next = next.charAt(0).toUpperCase() + next.slice(1);
    // A step that was only about the alcohol, or no longer reads properly, is dropped.
    return next.length < 4 || BROKEN.test(next) ? [] : [next];
  });
  if (!ingredients.length || [...ingredients.map((i) => i.item), ...steps].some(has_alcohol)) return null;
  return { ingredients, steps };
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
    // The garnish goes without its alcohol too, whether the version is built or shown as written.
    cocktail: { ...cocktail, garnish: garnish_without_alcohol(cocktail.garnish), alcoholic: false, non_alcoholic_version: null },
    note: "Recipeak's own alcohol-free version of this drink. Check the labels of any alcohol-free spirits you use.",
    allergens: allergens_in(written, recipe.allergens),
    tips: [],
    make_ahead: "",
    variations: [],
  };
  const changed = CHANGE.test(written) ? changed_recipe(written, recipe) : null;
  if (changed)
    return {
      ...base,
      ...changed,
      description: `${recipe.description} Without alcohol: ${sentence}`,
      steps: [`To make it without alcohol: ${sentence}`, ...changed.steps],
    };
  // Shown as written: the method holds everything (see parse_recipe), and nothing alcoholic is listed.
  return { ...base, description: sentence, ingredients: [], steps: [sentence] };
}

/** A version the recipe already carries for this diet, so no AI request is needed. */
export function curated_version(recipe: Recipe, diet: Diet): Recipe | null {
  return diet === "non-alcoholic" ? curated_non_alcoholic(recipe) : null;
}
