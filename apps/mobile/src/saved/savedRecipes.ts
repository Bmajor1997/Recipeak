// Saved recipes live on the phone for now (see docs/PROJECT-PLAN.md: account sync comes later).
// Each can keep its own photo, stored privately on the phone (see photoStore.ts).
import { parse_saved_list } from "../recipes/parse";
import type { Kind, Recipe, SavedRecipe } from "../recipes/types";

export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type PhotoStore = {
  keep_photo(sourceUri: string, id: string): Promise<string>;
  remove_photo(uri: string): void;
};

const STORAGE_NAME = "mealsandmixers.saved.v1";
const MAX_SAVED = 500;

/** Thrown when a free account already has its free saved recipes and tries to save another. */
export class SavedLimitError extends Error {
  constructor(readonly limit: number) {
    super(`The free plan keeps up to ${limit} saved recipes.`);
  }
}
const noPhotos: PhotoStore = { keep_photo: async (uri) => uri, remove_photo: () => {} };

export function create_saved_recipes(
  storage: KeyValueStorage,
  { now = () => new Date(), new_id = random_id, photos = noPhotos }: { now?: () => Date; new_id?: () => string; photos?: PhotoStore } = {},
) {
  async function read(): Promise<SavedRecipe[]> {
    const raw = await storage.getItem(STORAGE_NAME);
    if (!raw) return [];
    try {
      return parse_saved_list(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  const write = (list: SavedRecipe[]) => storage.setItem(STORAGE_NAME, JSON.stringify(list));

  return {
    list: read,
    /** `limit` is the free plan's cap (leave it out for subscribers). Re-saving a recipe already in Saved is always allowed. */
    async save(kind: Kind, recipe: Recipe, photoUri?: string | null, { limit }: { limit?: number } = {}): Promise<SavedRecipe> {
      const list = await read();
      // Saving the same recipe twice moves it to the top instead of making a copy.
      const replaced = list.filter((s) => s.recipe.title === recipe.title);
      const others = list.filter((s) => s.recipe.title !== recipe.title);
      if (limit !== undefined && replaced.length === 0 && others.length >= limit) throw new SavedLimitError(limit);
      if (others.length >= MAX_SAVED) throw new Error(`You can save up to ${MAX_SAVED} recipes. Remove some to save more.`);
      const id = new_id();
      // A photo that isn't kept still lets the recipe save, just without its picture.
      const photo_uri = photoUri ? await photos.keep_photo(photoUri, id).catch(() => null) : null;
      const entry: SavedRecipe = { id, saved_at: now().toISOString(), kind, recipe, photo_uri };
      await write([entry, ...others]);
      for (const old of replaced) if (old.photo_uri && old.photo_uri !== photo_uri) photos.remove_photo(old.photo_uri);
      return entry;
    },
    async remove(id: string): Promise<void> {
      const list = await read();
      await write(list.filter((s) => s.id !== id));
      for (const gone of list.filter((s) => s.id === id)) if (gone.photo_uri) photos.remove_photo(gone.photo_uri);
    },
    async find(id: string): Promise<SavedRecipe | undefined> {
      return (await read()).find((s) => s.id === id);
    },
  };
}

function random_id(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
