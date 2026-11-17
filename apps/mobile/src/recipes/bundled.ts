// The hand-written recipes and photos that ship inside the app (see scripts/make_collection.py).
// They let the Home wall and Explore open recipes instantly, with no server and no AI cost.
import { Asset } from "expo-asset";
import recipes from "./collection.json";
import variants from "./collectionVariants.json";
import { COLLECTION, type CollectionDish } from "./collectionPhotos";
import { normalize_dish_name } from "./dishName";
import { parse_recipe } from "./parse";
import type { Diet, Kind, Recipe } from "./types";

const index = new Map<string, CollectionDish>();
for (const dish of COLLECTION) {
  for (const name of [dish.name, ...dish.aliases]) {
    const key = `${dish.kind}|${normalize_dish_name(name)}`;
    if (!index.has(key)) index.set(key, dish);
  }
}

/** Finds a dish in the bundled collection by kind and any of its names. */
export function find_bundled_dish(kind: Kind, name: string): CollectionDish | null {
  return index.get(`${kind}|${normalize_dish_name(name)}`) ?? null;
}

/** The bundled recipe for a dish, checked the same way as a recipe from the server. */
export function bundled_recipe(dish: CollectionDish): Recipe | null {
  try {
    return parse_recipe((recipes as Record<string, unknown>)[dish.id]);
  } catch {
    return null;
  }
}

/** A file address for a bundled photo, so it can be shown as the cover and copied when the recipe is saved. */
export async function bundled_photo_uri(dish: CollectionDish): Promise<string | null> {
  try {
    const asset = Asset.fromModule(dish.source);
    await asset.downloadAsync();
    return asset.localUri ?? asset.uri ?? null;
  } catch {
    return null;
  }
}

/** The diets that have hand-written bundled versions. Other diets still come from the server. */
export const BUNDLED_DIETS = ["vegetarian", "vegan"] as const;

/**
 * A bundled dish's version for a diet: its own recipe, or the regular recipe with already: true when that one
 * already fits the diet. Null when the dish has no bundled version for this diet (ask the server instead).
 */
export function bundled_version(id: string, diet: Diet | null): { recipe: Recipe; already: boolean } | null {
  const dish = COLLECTION.find((d) => d.id === id);
  if (!dish) return null;
  const regular = bundled_recipe(dish);
  if (!regular) return null;
  if (diet === null) return { recipe: regular, already: false };
  if (!(BUNDLED_DIETS as readonly string[]).includes(diet)) return null;
  const value = (variants as Record<string, Record<string, unknown>>)[id]?.[diet];
  if (value === undefined) return null;
  if (value === "same") return { recipe: regular, already: true };
  try {
    return { recipe: parse_recipe(value), already: false };
  } catch {
    return null;
  }
}
