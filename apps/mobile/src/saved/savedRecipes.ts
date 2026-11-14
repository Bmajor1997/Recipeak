// Saved recipes live on the phone for now (see docs/PROJECT-PLAN.md: account sync comes later).
import { parseSavedList } from "../recipes/parse";
import type { Kind, Recipe, SavedRecipe } from "../recipes/types";

export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

const STORAGE_NAME = "mealsandmixers.saved.v1";
export const MAX_SAVED = 500;

export function createSavedRecipes(storage: KeyValueStorage, { now = () => new Date(), newId = randomId } = {}) {
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
    async save(kind: Kind, recipe: Recipe): Promise<SavedRecipe> {
      const list = await read();
      // Saving the same recipe twice moves it to the top instead of making a copy.
      const others = list.filter((s) => s.recipe.title !== recipe.title);
      const entry: SavedRecipe = { id: newId(), saved_at: now().toISOString(), kind, recipe };
      if (others.length >= MAX_SAVED) throw new Error(`You can save up to ${MAX_SAVED} recipes. Remove some to save more.`);
      await write([entry, ...others]);
      return entry;
    },
    async remove(id: string): Promise<void> {
      await write((await read()).filter((s) => s.id !== id));
    },
    async find(id: string): Promise<SavedRecipe | undefined> {
      return (await read()).find((s) => s.id === id);
    },
  };
}

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
