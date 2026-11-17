import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { create_onboarding_store, DEFAULT_ONBOARDING, type Onboarding } from "./onboarding";

type State = {
  /** False until the saved answers are read; the app waits for this so the tour never flashes on. */
  loaded: boolean;
  values: Onboarding;
  /** Changes the answers. Kept on the device; if saving fails, the change still applies until the app closes. */
  update: (change: Partial<Onboarding>) => void;
};

const Context = createContext<State | null>(null);
const store = create_onboarding_store(AsyncStorage);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [values, set_values] = useState<Onboarding>({ ...DEFAULT_ONBOARDING });
  const [loaded, set_loaded] = useState(false);
  useEffect(() => {
    let live = true;
    store.load().then(
      (next) => {
        if (!live) return;
        set_values(next);
        set_loaded(true);
      },
      // Storage could not be read: skip the tour rather than block the app.
      () => {
        if (!live) return;
        set_values({ ...DEFAULT_ONBOARDING, done: true });
        set_loaded(true);
      },
    );
    return () => {
      live = false;
    };
  }, []);
  const update = useCallback((change: Partial<Onboarding>) => {
    set_values((prev) => {
      const next = { ...prev, ...change };
      void store.save(next).catch(() => {});
      return next;
    });
  }, []);
  const state = useMemo(() => ({ loaded, values, update }), [loaded, values, update]);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

export function useOnboarding(): State {
  const state = useContext(Context);
  if (!state) throw new Error("useOnboarding must be inside OnboardingProvider");
  return state;
}
