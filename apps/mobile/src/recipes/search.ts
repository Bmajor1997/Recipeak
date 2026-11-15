import type { Kind, SavedRecipe } from "./types";

export type SavedFilter = "all" | Kind;

/** Search by recipe name or ingredient, and filter to meals or drinks. */
export function filter_saved(list: SavedRecipe[], query: string, filter: SavedFilter): SavedRecipe[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((s) => {
    if (filter !== "all" && s.kind !== filter) return false;
    if (!words.length) return true;
    const haystack = [s.recipe.title, s.recipe.description, ...s.recipe.ingredients.map((i) => i.item)].join(" ").toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

export const total_minutes = (s: SavedRecipe) => s.recipe.prep_minutes + s.recipe.cook_minutes;
