import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import { useCallback, useEffect, useRef } from "react";
import { useApp } from "../AppContext";
import { parse_review_state, review_due, review_storage_name, with_active_day } from "./storeReview";

/** Lets the "Saved" confirmation show before the store's card appears. */
export const REVIEW_DELAY_MS = 1_500;

/**
 * Notes that a recipe was opened today, and returns `after_save`, which the recipe screen calls once a recipe is
 * saved. If the moment is right (see storeReview.ts), the store is asked for its review card a moment later.
 */
export function useStoreReviewPrompt() {
  const { user } = useApp();
  const uid = user?.uid ?? null;
  const latest = useRef(uid);
  useEffect(() => {
    latest.current = uid;
    if (!uid) return;
    const key = review_storage_name(uid);
    void (async () => {
      try {
        const state = parse_review_state(await AsyncStorage.getItem(key));
        const next = with_active_day(state, Date.now());
        if (next !== state) await AsyncStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Only affects when the review card might show.
      }
    })();
  }, [uid]);

  return useCallback(() => {
    const account = latest.current;
    if (!account) return;
    const key = review_storage_name(account);
    void (async () => {
      try {
        const state = parse_review_state(await AsyncStorage.getItem(key));
        const now = Date.now();
        if (!review_due(state, now)) return;
        await new Promise((resolve) => setTimeout(resolve, REVIEW_DELAY_MS));
        if (latest.current !== account || !(await StoreReview.isAvailableAsync())) return;
        // Recorded first, so a store that fails or never shows its card isn't asked again on every save.
        await AsyncStorage.setItem(key, JSON.stringify({ ...state, asks: state.asks + 1, last_asked_at: now }));
        await StoreReview.requestReview();
      } catch {
        // A review card is never worth an error message.
      }
    })();
  }, []);
}
