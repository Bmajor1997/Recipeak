import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../AppContext";
import { create_device_look, create_preferences, DEFAULT_PREFERENCES, type Look, type Preferences } from "./preferences";

const device_look = create_device_look(AsyncStorage);
const look_of = (p: Preferences): Look => ({ appearance: p.appearance, accent: p.accent });

/** The defaults before anything has loaded; replaced by the device's last look, then by the account's own. */
const DEFAULTS_SHOWN: Preferences = { ...DEFAULT_PREFERENCES };

type State = {
  values: Preferences;
  ready: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
  reload: () => void;
  update: <K extends keyof Preferences>(key: K, value: Preferences[K]) => Promise<void>;
};
const Context = createContext<State | null>(null);

function AccountPreferences({ uid, children }: { uid: string | null; children: ReactNode }) {
  const store = useMemo(() => (uid ? create_preferences(AsyncStorage, uid) : null), [uid]);
  const [values, set_values] = useState<Preferences>(DEFAULTS_SHOWN);
  const [ready, set_ready] = useState(!store);
  const [busy, set_busy] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [notice, set_notice] = useState<string | null>(null);
  const [attempt, set_attempt] = useState(0);
  const locked = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // The look the last account chose: used while signed out (the start and sign-in screens) and while this account's
  // own preferences load, so the app doesn't switch between light and dark on the way in or out.
  useEffect(() => {
    let live = true;
    void device_look.load().then((look) => {
      if (live && look) set_values((current) => (current === DEFAULTS_SHOWN ? { ...current, ...look } : current));
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    if (!store) return;
    store.load().then(
      (next) => {
        if (live) {
          set_values(next);
          set_ready(true);
          void device_look.save(look_of(next)).catch(() => {});
        }
      },
      () => {
        if (live) set_error("Couldn't load your preferences. Try again before changing them.");
      },
    );
    return () => {
      live = false;
    };
  }, [store, attempt]);
  const reload = useCallback(() => {
    set_ready(false);
    set_error(null);
    set_attempt((n) => n + 1);
  }, []);
  const update = useCallback(
    async <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      if (!store || !ready || locked.current) return;
      locked.current = true;
      set_busy(true);
      set_error(null);
      set_notice(null);
      const next = { ...values, [key]: value };
      try {
        await store.save(next);
        if (alive.current) {
          set_values(next);
          set_notice("Saved on this device.");
        }
        void device_look.save(look_of(next)).catch(() => {});
      } catch {
        if (alive.current) set_error("Couldn't save that preference. Your previous choice is unchanged. Please try again.");
      } finally {
        locked.current = false;
        if (alive.current) set_busy(false);
      }
    },
    [store, ready, values],
  );
  // One value object per change, so screens using preferences only re-render when something in it changes.
  const state = useMemo(
    () => ({ values, ready, busy, error, notice, reload, update }),
    [values, ready, busy, error, notice, reload, update],
  );
  return <Context.Provider value={state}>{children}</Context.Provider>;
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
