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
// data/allergen-word-cases.json is checked against both lists, so they read every shared word the same way.
const ALLERGEN_WORDS: Record<string, RegExp> = {
  milk: /\b(?:milk|butter|buttermilk|cream|cheeses?|yogh?urt|ghee|half-and-half|whey|condensed milk|evaporated milk|irish cream)\b/,
  eggs: /\b(?:eggs?|egg (?:yolks?|whites?)|eggnog|meringue)\b/,
  "tree nuts": /\b(?:almonds?|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?|macadamias?|orgeat|amaretto|frangelico|marzipan|praline)\b/,
  peanuts: /\b(?:peanuts?|peanut butter)\b/,
  wheat: /\b(?:wheat|barley|malt|beer|ale|lager|stout)\b/,
  soy: /\b(?:soy|soya|soybeans?|soymilk|tofu|miso|tamari|edamame|tempeh|shoyu)\b/,
  sesame: /\b(?:sesame|tahini)\b/,
};
const NOT_AN_ALLERGEN =
  /\b(?:coconut|oat|rice|almond|soy|cashew) (?:milk|cream)\b|\bcream of (?:coconut|tartar)\b|\b(?:peanut|almond|cashew|sunflower|cocoa) butter\b|\bginger (?:beer|ale)\b|\broot beer\b|\bgluten-free (?:beer|ale|lager)\b/g;

/** Allergens named in a written version, added to the regular recipe's so none are dropped. */
function allergens_in(text: string, regular: string[]): string[] {
  const found = new Set(regular);
  const raw = text.toLowerCase();
  const without = raw.replace(NOT_AN_ALLERGEN, " ");
  for (const [allergen, words] of Object.entries(ALLERGEN_WORDS))
    if (words.test(allergen === "tree nuts" || allergen === "peanuts" || allergen === "soy" ? raw : without)) found.add(allergen);
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
  // These patterns use escaped alcohol terms from ALCOHOL or the fixed removal list.
  return (
    step
      // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
      .replace(new RegExp(`,? (?:then |and )?(?:add|stir in|pour in|top with|float) (?:the )?${w}\\b`, "gi"), "")
      // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
      .replace(new RegExp(`\\b(?:the )?${w}(?:,| and) `, "gi"), "")
      // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
      .replace(new RegExp(`(?:,| and) (?:the )?${w}\\b`, "gi"), "")
      // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
      .replace(new RegExp(`\\b(?:the )?${w}\\b(?!-)`, "gi"), "")
  );
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
  const other = with_other_changes(written, ingredients, steps);
  if (!other.ingredients.length || [...other.ingredients.map((i) => i.item), ...other.steps].some(has_alcohol)) return null;
  return other;
}

// Words that describe an ingredient rather than name it, ignored when matching "extra lime" to "fresh lime juice".
const DESCRIBING = new Set(["a", "an", "the", "some", "chilled", "fresh", "hot", "cold", "warm", "drop", "dash", "splash", "of", "few"]);
const naming_words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2 && !DESCRIBING.has(w));
const matches = (ingredient: Ingredient, thing: string) => naming_words(thing).some((w) => ingredient.item.toLowerCase().includes(w));

/**
 * The parts of a written change that aren't about alcohol, applied to the ingredients and steps too: "hot apple cider
 * instead of water" swaps the water, "add 1½ oz hibiscus tea" adds to the tea already there (or lists a new
 * ingredient), and "extra lime" marks the lime as extra. Anything else stays in the first step, which quotes it.
 */
function with_other_changes(written: string, ingredients: Ingredient[], steps: string[]) {
  let list = [...ingredients];
  let method = [...steps];
  const clauses = written
    .toLowerCase()
    .replace(/\.$/, "")
    .split(/[;,]| and (?=(?:add|use|top|skip|omit|leave)\b)/);
  for (const raw of clauses) {
    const clause = raw.trim();
    const instead = /^(?:use |with )?(.+?) instead of (?:the )?(.+)$/.exec(clause);
    if (instead) {
      const [, now, before] = instead;
      const at = list.findIndex((i) => !has_alcohol(i.item) && matches(i, before));
      if (at < 0) continue;
      const old = list[at].item;
      list = list.map((i, n) => (n === at ? { ...i, item: now.trim() } : i));
      // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
      const named = new RegExp(`\\b(?:${escape(old.toLowerCase())}|${escape(before.trim())})\\b`, "gi");
      method = method.map((step) => step.replace(named, now.trim()));
      continue;
    }
    const added = /^(?:then )?add (?:a |an )?([\d½¼¾⅓⅔/.][\d½¼¾⅓⅔/. ]*(?:oz|ml|cups?|tbsp|tsp|dashes?)\s+)?(?:(?:more|extra) )?(.+)$/.exec(
      clause,
    );
    if (added && !has_alcohol(added[2])) {
      const [, amount, thing] = added;
      const at = list.findIndex((i) => !has_alcohol(i.item) && matches(i, thing));
      if (at >= 0) {
        const more = amount ? `plus ${amount.trim()} more` : "a little extra";
        list = list.map((i, n) => (n === at ? { ...i, item: `${i.item} (${more})` } : i));
      } else list.push(as_ingredient(`${amount ?? ""}${thing}`, { amount: "", unit: "", item: thing }));
      continue;
    }
    const extra = /\b(?:extra|more) (.+)$/.exec(clause);
    if (extra)
      for (const thing of extra[1].split(/ and | or /).slice(0, 2)) {
        const at = list.findIndex((i) => !has_alcohol(i.item) && matches(i, thing) && !i.item.includes("("));
        if (at >= 0) list = list.map((i, n) => (n === at ? { ...i, item: `${i.item} (extra)` } : i));
      }
  }
  return { ingredients: list, steps: method };
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
  // Shown as written: the method holds everything (see parse_recipe), and nothing alcoholic is listed. Written versions
  // lean on the original ("Blend without the rum", "Muddle the blackberries with the syrup"), so its other ingredients
  // and amounts come along in the method, and a saved copy still has them. The ingredient list stays empty, so no diet
  // is claimed from it (diets.ts).
  // A version with its own amounts ("Shake 1 oz lemon juice and 3/4 oz simple syrup…") is complete: nothing is added
  // that could contradict it, except what it points back to ("the same spices") and doesn't name.
  const lower = written.toLowerCase();
  const own_amounts = /[\d½¼¾⅓⅔]\s*(?:oz|ml|cups?|tbsp|tsp)\b/i.test(written);
  const named = (i: Ingredient) => naming_words(i.item).some((w) => lower.includes(w));
  const kept = recipe.ingredients
    .filter((i) => !has_alcohol(i.item) && (!own_amounts || (/\bsame\b/.test(lower) && !named(i))))
    .map((i) => [i.amount, i.unit, i.item].filter(Boolean).join(" "));
  const from_original = kept.length ? [`From the original, without the alcohol: ${kept.join("; ")}.`] : [];
  return { ...base, description: sentence, ingredients: [], steps: [sentence, ...from_original] };
}

/** A version the recipe already carries for this diet, so no AI request is needed. */
export function curated_version(recipe: Recipe, diet: Diet): Recipe | null {
  return diet === "non-alcoholic" ? curated_non_alcoholic(recipe) : null;
}
