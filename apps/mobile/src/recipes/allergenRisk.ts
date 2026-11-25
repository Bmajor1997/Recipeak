// Allergens a recipe may contain but can't be confirmed from its words: shown as "May contain", never as a guarantee
// either way. The recipe's own allergen list stays the confirmed part (from its ingredients, checked twice for AI
// recipes); this adds what depends on the brand or on wording that disagrees with the ingredient list.
import { allergens_in } from "./curatedVersions";
import type { Recipe } from "./types";

// Made with or without nuts depending on the brand: falernum is often made with almond, amaretto with almond or
// apricot kernel, crème de noyaux with apricot or almond kernels, nougat and mole paste often hold nuts.
const BRAND_DEPENDENT: { allergen: string; words: RegExp }[] = [
  { allergen: "tree nuts", words: /\b(?:falernum|amaretto|noyaux|nougat|mole paste|nut liqueur)\b/i },
];
// The line names a formulation without them ("nut-free amaretto (such as Disaronno)").
const SAYS_FREE = /\b(?:nut-free|nut free|almond-free|tree nut-free)\b/i;
// Words that describe a taste ("almond-scented"), not an ingredient.
const FLAVOR_WORDS = /\b[a-z]+-(?:flavou?red|scented|like|free)\b/gi;
// The allergens read from a description or method that disagrees with the ingredients: the nut allergens, where a
// mention matters most and a serving suggestion is rarely the reason.
const FROM_WORDING = new Set(["tree nuts", "peanuts"]);

export type PossibleAllergen = { allergen: string; because: string[] };

/** What the recipe may contain beyond its listed allergens, each with the words that raise it. */
export function possible_allergens(recipe: Recipe): PossibleAllergen[] {
  const listed = new Set(recipe.allergens);
  const found = new Map<string, Set<string>>();
  const add = (allergen: string, because: string) => {
    if (listed.has(allergen)) return;
    if (!found.has(allergen)) found.set(allergen, new Set());
    found.get(allergen)!.add(because);
  };
  // An ingredient list when there is one; a drink written only as a method is read from its method.
  const lines = recipe.ingredients.length ? recipe.ingredients.map((i) => i.item) : recipe.steps;
  for (const line of [...lines, recipe.cocktail?.garnish ?? ""]) {
    if (SAYS_FREE.test(line)) continue;
    for (const { allergen, words } of BRAND_DEPENDENT) {
      const hit = line.match(words);
      if (hit) add(allergen, hit[0].toLowerCase());
    }
  }
  // Brand-dependent words were judged on the ingredient lines above ("nut-free amaretto" then "shake the amaretto").
  let wording = [recipe.description, ...recipe.steps].join(" ").replace(FLAVOR_WORDS, " ");
  for (const { words } of BRAND_DEPENDENT)
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    wording = wording.replace(new RegExp(words.source, "gi"), " ");
  for (const allergen of allergens_in(wording, [])) if (FROM_WORDING.has(allergen)) add(allergen, "the description or method");
  return [...found].map(([allergen, because]) => ({ allergen, because: [...because] }));
}

/** One line for the recipe screen and shared text, or "" when there's nothing to add. */
export function possible_allergen_line(recipe: Recipe): string {
  const possible = possible_allergens(recipe);
  if (!possible.length) return "";
  const parts = possible.map(({ allergen, because }) => `${allergen} (${because.join(", ")})`);
  return `May contain ${parts.join("; ")}: these depend on the brand or recipe, so check the label.`;
}
