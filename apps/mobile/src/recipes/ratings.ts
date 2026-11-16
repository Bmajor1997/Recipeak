// Recipe ratings: stars, "I made this", what went wrong, and an optional note. Each account keeps its own ratings
// on the phone so the recipe screen remembers them, and sends them to the team so weak recipes get fixed first.
import type { KeyValueStorage } from "../saved/savedRecipes";
import { normalize_dish_name } from "./dishName";
import type { Kind } from "./types";

export const RATING_TAGS = {
  perfect: "Perfect as written",
  too_salty: "Too salty",
  too_bland: "Too bland",
  too_sweet: "Too sweet",
  too_sour: "Too sour",
  too_strong: "Too strong",
  took_longer: "Took longer than listed",
  unclear_steps: "A step was unclear",
  amounts_off: "Amounts seemed off",
} as const;
export type RatingTag = keyof typeof RATING_TAGS;

/** The tags that make sense for a meal or a drink. */
export function tags_for(kind: Kind): RatingTag[] {
  const skip: RatingTag = kind === "meal" ? "too_strong" : "took_longer";
  return (Object.keys(RATING_TAGS) as RatingTag[]).filter((tag) => tag !== skip);
}

export type Rating = { stars: number; made: boolean; tags: RatingTag[]; note: string; sent: boolean; updated_at: string };
export const MAX_NOTE = 500;

const storage_name = (uid: string) => `mealsandmixers.ratings.v1.${encodeURIComponent(uid)}`;
export const rating_key = (kind: Kind, dish: string) => `${kind}|${normalize_dish_name(dish)}`;

function clean(v: unknown): Rating | null {
  if (typeof v !== "object" || v === null) return null;
  const r = v as Record<string, unknown>;
  if (!Number.isInteger(r.stars) || (r.stars as number) < 1 || (r.stars as number) > 5 || typeof r.made !== "boolean") return null;
  const tags = Array.isArray(r.tags) ? r.tags.filter((t): t is RatingTag => typeof t === "string" && t in RATING_TAGS) : [];
  return {
    stars: r.stars as number,
    made: r.made,
    tags,
    note: typeof r.note === "string" ? r.note.slice(0, MAX_NOTE) : "",
    sent: r.sent === true,
    updated_at: typeof r.updated_at === "string" ? r.updated_at : "",
  };
}

export type SendRating = (input: {
  kind: Kind;
  dish: string;
  stars: number;
  made: boolean;
  tags: RatingTag[];
  note: string;
}) => Promise<void>;

export function create_ratings(storage: KeyValueStorage, uid: string, send: SendRating, now = () => new Date()) {
  let sending: Promise<void> | null = null;
  async function read_all(): Promise<Record<string, Rating>> {
    try {
      const raw = JSON.parse((await storage.getItem(storage_name(uid))) ?? "{}") as Record<string, unknown>;
      const out: Record<string, Rating> = {};
      for (const [key, value] of Object.entries(raw)) {
        const r = clean(value);
        if (r) out[key] = r;
      }
      return out;
    } catch {
      return {};
    }
  }
  const write_all = (all: Record<string, Rating>) => storage.setItem(storage_name(uid), JSON.stringify(all));

  return {
    async get(kind: Kind, dish: string): Promise<Rating | null> {
      return (await read_all())[rating_key(kind, dish)] ?? null;
    },
    /** Keeps the rating on the phone. Send it with send_pending; the screen doesn't wait for the server. */
    async save(kind: Kind, dish: string, input: { stars: number; made: boolean; tags: RatingTag[]; note: string }): Promise<void> {
      const all = await read_all();
      const note = input.note.trim().slice(0, MAX_NOTE);
      all[rating_key(kind, dish)] = { ...input, note, sent: false, updated_at: now().toISOString() };
      await write_all(all);
    },
    /** Sends any ratings that were kept while offline. */
    async send_pending(): Promise<void> {
      if (sending) return sending;
      sending = (async () => {
        for (const [key, r] of Object.entries(await read_all())) {
          if (r.sent) continue;
          const [kind, dish] = key.split("|") as [Kind, string];
          try {
            await send({ kind, dish, stars: r.stars, made: r.made, tags: r.tags, note: r.note });
          } catch {
            return;
          }
          // Mark it sent only if it wasn't changed again while it was being sent.
          const latest = await read_all();
          if (latest[key]?.updated_at === r.updated_at) {
            latest[key] = { ...latest[key], sent: true };
            await write_all(latest);
          }
        }
      })().finally(() => {
        sending = null;
      });
      return sending;
    },
  };
}

export type Ratings = ReturnType<typeof create_ratings>;
