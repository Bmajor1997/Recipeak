import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { create_tip_store, tip_is_due, type Tip } from "./tips";

type State = {
  /** Whether this tip should show now. False until the saved list is read, so a tip never flashes on. */
  is_due: (tip: Tip) => boolean;
  /** Marks a tip as seen: it was dismissed, or the feature was used. */
  mark_seen: (tip: Tip) => void;
  /** Shows every tip again, from Settings. */
  reset: () => void;
};

const Context = createContext<State | null>(null);
const store = create_tip_store(AsyncStorage);

export function TipsProvider({ children }: { children: ReactNode }) {
  const [seen, set_seen] = useState<Set<Tip> | null>(null);
  useEffect(() => {
    let live = true;
    store.load().then(
      (next) => live && set_seen(next),
      // Storage could not be read: skip the tips rather than show them every launch.
      () => live && set_seen(new Set(["photo-wall", "snap", "share"])),
    );
    return () => {
      live = false;
    };
  }, []);
  const mark_seen = useCallback((tip: Tip) => {
    set_seen((prev) => {
      if (!prev || prev.has(tip)) return prev;
      const next = new Set(prev).add(tip);
      void store.save(next).catch(() => {});
      return next;
    });
  }, []);
  const reset = useCallback(() => {
    set_seen(new Set());
    void store.reset().catch(() => {});
  }, []);
  const is_due = useCallback((tip: Tip) => seen !== null && tip_is_due(tip, seen), [seen]);
  const state = useMemo(() => ({ is_due, mark_seen, reset }), [is_due, mark_seen, reset]);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

/** Outside the provider (in tests, for example) no tips show. */
export function useTips(): State {
  return useContext(Context) ?? { is_due: () => false, mark_seen: () => undefined, reset: () => undefined };
}
