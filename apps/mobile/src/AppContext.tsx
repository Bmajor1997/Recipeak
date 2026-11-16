// App-wide state: who is signed in, the API client, saved recipes, and the latest photo result.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { type Api, create_api } from "./api/client";
import { type AppUser, firebase, firebaseConfigured } from "./auth/firebase";
import type { DishImage, Guess, Kind, Recipe } from "./recipes/types";
import { keep_photo, remove_photo } from "./saved/photoStore";
import { create_saved_recipes, SIGNED_OUT_SAVED, type SavedRecipes } from "./saved/savedRecipes";

/**
 * What the recipe sheet shows. While a photo is being read it is "loading"; if the photo couldn't be used it is a
 * "problem"; otherwise a recipe with its matches. `image` is the shared cover photo for the selected dish;
 * `localPhoto` is a cover already kept on this phone (for saved recipes).
 */
export type CurrentRecipe =
  | { status: "loading" }
  | { status: "problem"; message: string; source?: "photo" | "wall" }
  | {
      status: "ready";
      kind: Kind;
      recipe: Recipe;
      guesses: Guess[];
      selected: number;
      image: DishImage;
      localPhoto: string | null;
      savedId: string | null;
    };

type AppState = {
  user: AppUser | null;
  ready: boolean;
  api: Api;
  /** The signed-in account's own saved recipes. */
  saved: SavedRecipes;
  current: CurrentRecipe | null;
  set_current: (value: CurrentRecipe | null) => void;
};

const Context = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, set_user] = useState<AppUser | null>(null);
  const [ready, set_ready] = useState(false);
  const [current, set_current] = useState<CurrentRecipe | null>(null);

  useEffect(
    () =>
      firebase.subscribe((next) => {
        set_user(next);
        set_ready(true);
      }),
    [],
  );

  const api = useMemo(
    // Without Firebase there is no signed-in account the server could accept, so the build is treated as not connected.
    () => create_api({ baseUrl: firebaseConfigured ? process.env.EXPO_PUBLIC_API_BASE_URL : undefined, id_token: firebase.id_token }),
    [],
  );
  // Each account has its own Saved list, so a new list is opened whenever a different account signs in, and the
  // recipe the last account had open (with its Saved state) is closed.
  const uid = user?.uid ?? null;
  const [current_owner, set_current_owner] = useState(uid);
  if (current_owner !== uid) {
    set_current_owner(uid);
    set_current(null);
  }
  const saved = useMemo(
    () => (uid ? create_saved_recipes(AsyncStorage, uid, { photos: { keep_photo, remove_photo } }) : SIGNED_OUT_SAVED),
    [uid],
  );
  const value = useMemo(() => ({ user, ready, api, saved, current, set_current }), [user, ready, api, saved, current]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useApp(): AppState {
  const value = useContext(Context);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
