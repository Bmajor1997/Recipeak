// "Recently viewed" on Home: the last recipes this account opened, newest first. A bundled dish is kept by its id;
// a recipe made with AI is kept whole (with its library photo's path), so reopening it never asks the AI again.
import type { KeyValueStorage } from "../saved/savedRecipes";
import { normalize_dish_name } from "./dishName";
import { LIBRARY_IMAGE, parse_recipe } from "./parse";
import type { Kind, Recipe } from "./types";

const MAX = 12;
/** Before 2026-11-23 the list held only bundled dish ids. It is read once and moved over. */
const old_storage_name = (uid: string) => `mealsandmixers.recent.v1.${encodeURIComponent(uid)}`;
export const recent_storage_name = (uid: string) => `mealsandmixers.recent.v2.${encodeURIComponent(uid)}`;
/** Every name this account's list has been kept under, for deleting an account. */
export const recent_storage_names = (uid: string) => [recent_storage_name(uid), old_storage_name(uid)];

export type RecentEntry =
  { type: "bundled"; id: string } | { type: "generated"; kind: Kind; name: string; recipe: Recipe; image_url: string | null };

const key_of = (entry: RecentEntry) =>
  entry.type === "bundled" ? `bundled|${entry.id}` : `generated|${entry.kind}|${normalize_dish_name(entry.name)}`;

function parse_entry(raw: unknown): RecentEntry | null {
  if (typeof raw === "string") return raw.length < 120 ? { type: "bundled", id: raw } : null;
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (v.type === "bundled") return typeof v.id === "string" && v.id.length < 120 ? { type: "bundled", id: v.id } : null;
  if (v.type !== "generated" || (v.kind !== "meal" && v.kind !== "cocktail")) return null;
  if (typeof v.name !== "string" || !v.name.trim() || v.name.length > 120) return null;
  try {
    const image_url = typeof v.image_url === "string" && LIBRARY_IMAGE.test(v.image_url) ? v.image_url : null;
    return { type: "generated", kind: v.kind, name: v.name, recipe: parse_recipe(v.recipe), image_url };
  } catch {
    return null;
  }
}

export function create_recently_viewed(storage: KeyValueStorage, uid: string) {
  async function read_list(name: string): Promise<RecentEntry[] | null> {
    const stored = await storage.getItem(name);
    if (stored === null) return null;
    try {
      const raw = JSON.parse(stored) as unknown;
      return Array.isArray(raw) ? raw.flatMap((item) => parse_entry(item) ?? []) : [];
    } catch {
      return [];
    }
  }
  async function list(): Promise<RecentEntry[]> {
    try {
      const entries = (await read_list(recent_storage_name(uid))) ?? (await read_list(old_storage_name(uid))) ?? [];
      const seen = new Set<string>();
      return entries.filter((e) => !seen.has(key_of(e)) && seen.add(key_of(e))).slice(0, MAX);
    } catch {
      return [];
    }
  }
  async function add(entry: RecentEntry): Promise<void> {
    const key = key_of(entry);
    const next = [entry, ...(await list()).filter((e) => key_of(e) !== key)].slice(0, MAX);
    await storage.setItem(recent_storage_name(uid), JSON.stringify(next));
    await storage.removeItem(old_storage_name(uid));
  }
  return { list, add };
}

export type RecentlyViewed = ReturnType<typeof create_recently_viewed>;
