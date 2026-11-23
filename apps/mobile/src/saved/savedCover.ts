// Where a saved recipe's cover photo comes from. A bundled dish always uses the photo that ships with the app (also
// for recipes saved before the dish id was kept, matched by name). A recipe made with AI uses its copy on this phone,
// then the shared library photo on the server if that copy is missing. The app's art shows only when neither exists.
import type { CurrentRecipe } from "../AppContext";
import { bundled_photo_uri, bundled_recipe, find_bundled_dish } from "../recipes/bundled";
import { COLLECTION, type CollectionDish } from "../recipes/collectionPhotos";
import { NO_IMAGE, type SavedRecipe } from "../recipes/types";

/** The bundled dish a saved recipe came from, or null for one made with AI. */
export function saved_bundled_dish(item: SavedRecipe): CollectionDish | null {
  if (item.bundled_id) return COLLECTION.find((dish) => dish.id === item.bundled_id) ?? null;
  // Saved before the dish id was kept: recipes made with AI never take a bundled dish's photo.
  return item.ai ? null : find_bundled_dish(item.kind, item.recipe.title);
}

export type SavedCover = { source: number | null; uri: string | null; fallback_uri: string | null };

/** The cover to show for a saved recipe. `image_uri` turns a library path into a full address (api.image_uri). */
export function saved_cover(item: SavedRecipe, image_uri: (path: string | null) => string | null): SavedCover {
  const dish = saved_bundled_dish(item);
  if (dish) return { source: dish.source, uri: null, fallback_uri: null };
  const library = image_uri(item.image_url ?? null);
  return { source: null, uri: item.photo_uri ?? library, fallback_uri: item.photo_uri ? library : null };
}

/** The recipe screen's state for reopening a saved recipe, with its own cover and (for a bundled dish) its versions. */
export async function saved_as_current(item: SavedRecipe): Promise<Extract<CurrentRecipe, { status: "ready" }>> {
  const dish = saved_bundled_dish(item);
  // Diet versions are worked out from the bundled recipe only when the saved one is that recipe, not a version of it.
  const standard = dish !== null && bundled_recipe(dish)?.title === item.recipe.title;
  return {
    status: "ready",
    kind: item.kind,
    recipe: item.recipe,
    guesses: [],
    selected: 0,
    image: item.image_url ? { status: "ready", url: item.image_url } : NO_IMAGE,
    localPhoto: dish ? await bundled_photo_uri(dish) : item.photo_uri,
    savedId: item.id,
    ai: item.ai,
    ...(dish && standard ? { bundledId: dish.id } : {}),
  };
}
