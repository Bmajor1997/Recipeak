// One-time tips (approved 2026-11-19): a small bubble beside a feature people might miss, shown once on this phone.
// Kept on the device, like the tour's answers. Settings > Help & privacy can show them again.
import type { KeyValueStorage } from "../saved/savedRecipes";

/** The tips, in the order they appear: the Home photo wall, then the Snap button, then sharing after a first save. */
export const TIPS = ["photo-wall", "snap", "share"] as const;
export type Tip = (typeof TIPS)[number];

const KEY = "recipeak.tips.v1";

/** Reads which tips were seen, keeping only known ones, so a damaged value never crashes or repeats every tip. */
export function parse_seen_tips(raw: string | null): Set<Tip> {
  if (!raw) return new Set();
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return new Set();
    return new Set(data.filter((v): v is Tip => (TIPS as readonly string[]).includes(v as string)));
  } catch {
    return new Set();
  }
}

export function create_tip_store(storage: KeyValueStorage) {
  return {
    async load(): Promise<Set<Tip>> {
      return parse_seen_tips(await storage.getItem(KEY));
    },
    async save(seen: Set<Tip>): Promise<void> {
      await storage.setItem(KEY, JSON.stringify([...seen]));
    },
    async reset(): Promise<void> {
      await storage.removeItem(KEY);
    },
  };
}

/** Shows one tip at a time, in order: a later tip waits until the ones before it were seen. */
export function tip_is_due(tip: Tip, seen: Set<Tip>): boolean {
  if (seen.has(tip)) return false;
  // The share tip appears only after a save, so it doesn't wait for the others.
  if (tip === "share") return true;
  return TIPS.slice(0, TIPS.indexOf(tip)).every((earlier) => earlier === "share" || seen.has(earlier));
}
