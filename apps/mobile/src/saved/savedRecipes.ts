// Saved recipes belong to the signed-in account: each account has its own list, so people who share a phone never
// see each other's recipes or share one free limit. The lists live on the phone for now (see docs/PROJECT-PLAN.md:
// account sync comes later). Each recipe can keep its own photo, stored privately on the phone (see photoStore.ts).
import { parse_saved_list } from "../recipes/parse";
import type { Kind, Recipe, SavedRecipe } from "../recipes/types";

export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type PhotoStore = {
  keep_photo(sourceUri: string, id: string): Promise<string>;
  remove_photo(uri: string): void;
};

/** Before 2026-11-15 there was one list for the whole phone. The first account to open Saved after the update takes it over. */
const DEVICE_WIDE_NAME = "mealsandmixers.saved.v1";
export const saved_storage_name = (uid: string) => `mealsandmixers.saved.v2.${encodeURIComponent(uid)}`;
const MAX_SAVED = 500;

/** Thrown when a free account already has its free saved recipes and tries to save another. */
export class SavedLimitError extends Error {
  constructor(readonly limit: number) {
    super(`The free plan keeps up to ${limit} saved recipes.`);
  }
}
const no_photos: PhotoStore = { keep_photo: async (uri) => uri, remove_photo: () => {} };

/** The saved recipes of one account (`uid`, the signed-in user's id). */
export function create_saved_recipes(
  storage: KeyValueStorage,
  uid: string,
  { now = () => new Date(), new_id = random_id, photos = no_photos }: { now?: () => Date; new_id?: () => string; photos?: PhotoStore } = {},
) {
  if (!uid) throw new Error("Saved recipes need a signed-in account.");
  const storage_name = saved_storage_name(uid);
  let moved_over: Promise<void> | null = null;

  /** Moves the old phone-wide list (if any) into this account, once, and removes it so no other account gets it. */
  function take_over_device_list(): Promise<void> {
    moved_over ??= (async () => {
      if ((await storage.getItem(storage_name)) !== null) return;
      const old = await storage.getItem(DEVICE_WIDE_NAME);
      if (old === null) return;
      await storage.setItem(storage_name, old);
      await storage.removeItem(DEVICE_WIDE_NAME);
    })().catch((error) => {
      moved_over = null;
      throw error;
    });
    return moved_over;
  }

  async function read(): Promise<SavedRecipe[]> {
    await take_over_device_list();
    const raw = await storage.getItem(storage_name);
    if (!raw) return [];
    try {
      return parse_saved_list(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  const write = (list: SavedRecipe[]) => storage.setItem(storage_name, JSON.stringify(list));
  // A photo file is deleted only once no saved recipe refers to it, and only after the list without it is written.
  const remove_unused = (uri: string, kept: SavedRecipe[]) => {
    if (!kept.some((s) => s.photo_uri === uri)) photos.remove_photo(uri);
  };

  return {
    list: read,
    /** `limit` is the free plan's cap (leave it out for subscribers). Re-saving a recipe already in Saved is always allowed. */
    async save(
      kind: Kind,
      recipe: Recipe,
      photoUri?: string | null,
      { limit, ai, bundled_id, image_url }: { limit?: number; ai?: boolean; bundled_id?: string; image_url?: string | null } = {},
    ): Promise<SavedRecipe> {
      const list = await read();
      // Saving the same recipe twice moves it to the top instead of making a copy.
      const replaced = list.filter((s) => s.recipe.title === recipe.title);
      const others = list.filter((s) => s.recipe.title !== recipe.title);
      if (limit !== undefined && replaced.length === 0 && others.length >= limit) throw new SavedLimitError(limit);
      if (others.length >= MAX_SAVED) throw new Error(`You can save up to ${MAX_SAVED} recipes. Remove some to save more.`);
      const id = new_id();
      // A photo that isn't kept still lets the recipe save, just without its picture.
      // A bundled dish's photo ships with the app, so it's shown from there instead of a copy that could go missing.
      const fresh = photoUri && !bundled_id ? await photos.keep_photo(photoUri, id).catch(() => null) : null;
      // Saving again without a cover on screen keeps the cover it was saved with, rather than losing it.
      const photo_uri = fresh ?? (bundled_id ? null : (replaced.find((s) => s.photo_uri)?.photo_uri ?? null));
      image_url ??= replaced.find((s) => s.image_url)?.image_url ?? null;
      const entry: SavedRecipe = {
        id,
        saved_at: now().toISOString(),
        kind,
        recipe,
        photo_uri,
        ...(ai ? { ai: true } : {}),
        ...(bundled_id ? { bundled_id } : {}),
        ...(image_url ? { image_url } : {}),
      };
      const next = [entry, ...others];
      await write(next);
      for (const old of replaced) if (old.photo_uri) remove_unused(old.photo_uri, next);
      return entry;
    },
    async remove(id: string): Promise<void> {
      const list = await read();
      const next = list.filter((s) => s.id !== id);
      await write(next);
      for (const gone of list.filter((s) => s.id === id)) if (gone.photo_uri) remove_unused(gone.photo_uri, next);
    },
    /**
     * Gives a saved recipe made with AI whose kept photo went missing its library photo's address, once the recipe
     * screen finds it on the server, so Saved shows it again. A recipe that has a photo is never changed.
     */
    async restore_cover(id: string, image_url: string): Promise<boolean> {
      const list = await read();
      const item = list.find((s) => s.id === id);
      if (!item || item.bundled_id || item.photo_uri || item.image_url || !image_url) return false;
      await write(list.map((s) => (s.id === id ? { ...s, image_url } : s)));
      return true;
    },
    async find(id: string): Promise<SavedRecipe | undefined> {
      return (await read()).find((s) => s.id === id);
    },
  };
}

export type SavedRecipes = ReturnType<typeof create_saved_recipes>;

/** What Saved is while nobody is signed in: empty, and nothing can be saved. */
export const SIGNED_OUT_SAVED: SavedRecipes = {
  list: async () => [],
  save: async () => {
    throw new Error("Sign in to save recipes.");
  },
  remove: async () => {},
  restore_cover: async () => false,
  find: async () => undefined,
};

function random_id(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
