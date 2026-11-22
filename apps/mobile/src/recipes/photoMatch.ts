// Choose existing bundled recipes before requesting an AI-generated recipe.
// Only exact normalized names and explicit curated aliases are considered safe automatic matches.
// Similar names are suggestions, never silently treated as the photographed dish.
import { COLLECTION, type CollectionDish } from "./collectionPhotos";
import { normalize_dish_name } from "./dishName";
import type { Kind } from "./types";

export type PhotoRecipeMatch = { dish: CollectionDish; exact: boolean };

export function match_photo_guesses(kind: Kind, guesses: readonly { name: string }[]): PhotoRecipeMatch[] {
  const seen = new Set<string>();
  const matches: PhotoRecipeMatch[] = [];
  for (const guess of guesses.slice(0, 3)) {
    const key = normalize_dish_name(guess.name);
    if (!key) continue;
    const exact = COLLECTION.find((dish) =>
      dish.kind === kind && [dish.name, ...dish.aliases].some((name) => normalize_dish_name(name) === key));
    if (exact && !seen.has(exact.id)) {
      seen.add(exact.id);
      matches.push({ dish: exact, exact: true });
    }
  }
  return matches;
}
