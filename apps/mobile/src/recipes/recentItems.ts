// Turns the stored "Recently viewed" list into what Home shows and opens, and records what the recipe screen opens.
import type { CurrentRecipe } from "../AppContext";
import type { CollectionDish } from "./collectionPhotos";
import type { RecentEntry, RecentlyViewed } from "./recentlyViewed";
import { find_collection_dish } from "./shelves";
import { NO_IMAGE, type Kind } from "./types";

type Generated = Extract<RecentEntry, { type: "generated" }>;
export type ViewedItem = { key: string; name: string; kind: Kind; dish: CollectionDish | null; entry: Generated | null };

/** Bundled ids that no longer exist are skipped. */
export function viewed_items(entries: RecentEntry[]): ViewedItem[] {
  return entries.flatMap((entry): ViewedItem[] => {
    if (entry.type === "generated")
      return [{ key: `g|${entry.kind}|${entry.name}`, name: entry.name, kind: entry.kind, dish: null, entry }];
    const dish = find_collection_dish(entry.id);
    return dish ? [{ key: `b|${dish.id}`, name: dish.name, kind: dish.kind, dish, entry: null }] : [];
  });
}

/** The recipe screen's state for reopening a recipe made with AI from Recently viewed. */
export function generated_as_current(entry: Generated): Extract<CurrentRecipe, { status: "ready" }> {
  const image = entry.image_url ? ({ status: "ready", url: entry.image_url } as const) : NO_IMAGE;
  return {
    status: "ready",
    kind: entry.kind,
    recipe: entry.recipe,
    guesses: [{ name: entry.name, confidence: "high", image }],
    selected: 0,
    image,
    localPhoto: null,
    savedId: null,
    picked: true,
    ai: true,
  };
}

/**
 * Records the recipe on screen in this account's Recently viewed: a bundled dish by its id, a recipe made with AI as
 * it is (with its library photo). Only the standard recipe is recorded, not a diet version of it.
 */
export function record_viewed(recent: RecentlyViewed | null, current: Extract<CurrentRecipe, { status: "ready" }>, name: string) {
  if (!recent) return;
  const entry: RecentEntry | null = current.bundledId
    ? { type: "bundled", id: current.bundledId }
    : current.ai
      ? {
          type: "generated",
          kind: current.kind,
          name,
          recipe: current.recipe,
          image_url: current.image.status === "ready" ? current.image.url : null,
        }
      : null;
  if (entry) void recent.add(entry).catch(() => {});
}
