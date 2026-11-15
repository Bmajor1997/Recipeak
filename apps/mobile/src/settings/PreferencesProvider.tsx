import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../AppContext";
import { createPreferences, DEFAULT_PREFERENCES, type Preferences } from "./preferences";

type State = {
  values: Preferences;
  ready: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
  reload: () => void;
  update: (key: keyof Preferences, value: boolean) => Promise<void>;
};
const Context = createContext<State | null>(null);

function AccountPreferences({ uid, children }: { uid: string | null; children: ReactNode }) {
  const store = useMemo(() => (uid ? createPreferences(AsyncStorage, uid) : null), [uid]);
  const [values, setValues] = useState<Preferences>({ ...DEFAULT_PREFERENCES });
  const [ready, setReady] = useState(!store);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const locked = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    if (!store) return;
    store.load().then(
      (next) => {
        if (live) {
          setValues(next);
          setReady(true);
        }
      },
      () => {
        if (live) setError("Couldn't load your preferences. Try again before changing them.");
      },
    );
    return () => {
      live = false;
    };
  }, [store, attempt]);
  const reload = useCallback(() => {
    setReady(false);
    setError(null);
    setAttempt((n) => n + 1);
  }, []);
  async function update(key: keyof Preferences, value: boolean) {
    if (!store || !ready || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    const next = { ...values, [key]: value };
    try {
      await store.save(next);
      if (alive.current) {
        setValues(next);
        setNotice("Saved on this device.");
      }
    } catch {
      if (alive.current) setError("Couldn't save that preference. Your previous choice is unchanged. Please try again.");
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return <Context.Provider value={{ values, ready, busy, error, notice, reload, update }}>{children}</Context.Provider>;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useApp();
  return (
    <AccountPreferences key={user?.uid ?? "signed-out"} uid={user?.uid ?? null}>
      {children}
    </AccountPreferences>
  );
}
export function usePreferences() {
  const state = useContext(Context);
  if (!state) throw new Error("usePreferences must be inside PreferencesProvider");
  return state;
}
