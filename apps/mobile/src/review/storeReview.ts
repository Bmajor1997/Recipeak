/**
 * When Recipeak asks the store for its review card (Google Play's in-app review, later the App Store's), the same
 * way as Votic: the store shows its own card, Recipeak never asks "Do you like Recipeak?" first (Google Play doesn't
 * allow that) and never learns whether a review was left. Recipeak only picks the moment: right after someone saves
 * a recipe, once they've opened recipes on a few different days, and rarely.
 */
export const STORE_REVIEW_KEY = "recipeak.store-review.v1";
/** Different days with a recipe opened before the first ask. */
export const MIN_ACTIVE_DAYS = 3;
/** At least this long between asks. The store also limits how often its card appears. */
export const REVIEW_COOLDOWN_MS = 120 * 24 * 60 * 60 * 1000;
/** Never more than this many asks for one account. */
export const MAX_REVIEW_ASKS = 3;
/** Only the last few days matter, so the list stays small. */
const DAYS_KEPT = 10;

export type ReviewState = { asks: number; last_asked_at: number | null; days: string[] };
export const NO_REVIEW_ASKS: ReviewState = { asks: 0, last_asked_at: null, days: [] };

/** One account's review state, stored separately for each account like Saved. */
export function review_storage_name(uid: string): string {
  return `${STORE_REVIEW_KEY}:${uid}`;
}

/** What was saved, or a fresh start when nothing (or something unreadable) was saved. */
export function parse_review_state(raw: string | null): ReviewState {
  try {
    const value = JSON.parse(raw ?? "null") as Partial<ReviewState> | null;
    if (!value || typeof value !== "object") return NO_REVIEW_ASKS;
    const asks = Number.isInteger(value.asks) && (value.asks as number) >= 0 ? (value.asks as number) : 0;
    const last_asked_at = typeof value.last_asked_at === "number" && Number.isFinite(value.last_asked_at) ? value.last_asked_at : null;
    const days = Array.isArray(value.days)
      ? value.days.filter((day): day is string => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)).slice(-DAYS_KEPT)
      : [];
    return { asks, last_asked_at, days };
  } catch {
    return NO_REVIEW_ASKS;
  }
}

/** The phone's own calendar day, so "a different day" means what the person would expect. */
export function local_day(now: number): string {
  const date = new Date(now);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Notes that a recipe was opened today. */
export function with_active_day(state: ReviewState, now: number): ReviewState {
  const today = local_day(now);
  return state.days.includes(today) ? state : { ...state, days: [...state.days, today].slice(-DAYS_KEPT) };
}

/** Whether this is a good time to ask for a review. */
export function review_due(state: ReviewState, now: number): boolean {
  if (state.days.length < MIN_ACTIVE_DAYS || state.asks >= MAX_REVIEW_ASKS) return false;
  return state.last_asked_at === null || now - state.last_asked_at >= REVIEW_COOLDOWN_MS;
}
