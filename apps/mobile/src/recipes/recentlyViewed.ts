// "Recently viewed" on Home: the last dishes from the collection this account opened, newest first.
import type { KeyValueStorage } from "../saved/savedRecipes";

const MAX = 12;
const storage_name = (uid: string) => `mealsandmixers.recent.v1.${encodeURIComponent(uid)}`;

export function create_recently_viewed(storage: KeyValueStorage, uid: string) {
  async function list(): Promise<string[]> {
    try {
      const raw = JSON.parse((await storage.getItem(storage_name(uid))) ?? "[]") as unknown;
      return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string" && id.length < 120).slice(0, MAX) : [];
    } catch {
      return [];
    }
  }
  return {
    list,
    async add(id: string): Promise<void> {
      const next = [id, ...(await list()).filter((x) => x !== id)].slice(0, MAX);
      await storage.setItem(storage_name(uid), JSON.stringify(next));
    },
  };
}

export type RecentlyViewed = ReturnType<typeof create_recently_viewed>;
