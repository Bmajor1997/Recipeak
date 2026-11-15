// Saved recipes live on the phone for now (see docs/PROJECT-PLAN.md: account sync comes later).
// Each can keep its own photo, stored privately on the phone (see photoStore.ts).
import { parseSavedList } from "../recipes/parse";
import type { Kind, Recipe, SavedRecipe } from "../recipes/types";

export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type PhotoStore = {
  keepPhoto(sourceUri: string, id: string): Promise<string>;
  removePhoto(uri: string): void;
};

const STORAGE_NAME = "mealsandmixers.saved.v1";
export const MAX_SAVED = 500;
const noPhotos: PhotoStore = { keepPhoto: async (uri) => uri, removePhoto: () => {} };

export function createSavedRecipes(
  storage: KeyValueStorage,
  { now = () => new Date(), newId = randomId, photos = noPhotos }: { now?: () => Date; newId?: () => string; photos?: PhotoStore } = {},
) {
  async function read(): Promise<SavedRecipe[]> {
    const raw = await storage.getItem(STORAGE_NAME);
    if (!raw) return [];
    try {
      return parseSavedList(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  const write = (list: SavedRecipe[]) => storage.setItem(STORAGE_NAME, JSON.stringify(list));

  return {
    list: read,
    async save(kind: Kind, recipe: Recipe, photoUri?: string | null): Promise<SavedRecipe> {
      const list = await read();
      // Saving the same recipe twice moves it to the top instead of making a copy.
      const replaced = list.filter((s) => s.recipe.title === recipe.title);
      const others = list.filter((s) => s.recipe.title !== recipe.title);
      if (others.length >= MAX_SAVED) throw new Error(`You can save up to ${MAX_SAVED} recipes. Remove some to save more.`);
      const id = newId();
      // A photo that isn't kept still lets the recipe save, just without its picture.
      const photo_uri = photoUri ? await photos.keepPhoto(photoUri, id).catch(() => null) : null;
      const entry: SavedRecipe = { id, saved_at: now().toISOString(), kind, recipe, photo_uri };
      await write([entry, ...others]);
      for (const old of replaced) if (old.photo_uri && old.photo_uri !== photo_uri) photos.removePhoto(old.photo_uri);
      return entry;
    },
    async remove(id: string): Promise<void> {
      const list = await read();
      await write(list.filter((s) => s.id !== id));
      for (const gone of list.filter((s) => s.id === id)) if (gone.photo_uri) photos.removePhoto(gone.photo_uri);
    },
    async find(id: string): Promise<SavedRecipe | undefined> {
      return (await read()).find((s) => s.id === id);
    },
  };
}

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
