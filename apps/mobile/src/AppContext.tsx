// App-wide state: who is signed in, the API client, saved recipes, and the latest photo result.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { type Api, create_api } from "./api/client";
import { type AppUser, firebase } from "./auth/firebase";
import type { DishImage, Guess, Kind, Recipe } from "./recipes/types";
import { keep_photo, remove_photo } from "./saved/photoStore";
import { create_saved_recipes } from "./saved/savedRecipes";

/**
 * What the recipe sheet shows. While a photo is being read it is "loading"; if the photo couldn't be used it is a
 * "problem"; otherwise a recipe with its matches. `image` is the shared cover photo for the selected dish;
 * `localPhoto` is a cover already kept on this phone (for saved recipes).
 */
export type CurrentRecipe =
  | { status: "loading" }
  | { status: "problem"; message: string }
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
  saved: ReturnType<typeof create_saved_recipes>;
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

  const api = useMemo(() => create_api({ baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL, id_token: firebase.id_token }), []);
  const saved = useMemo(() => create_saved_recipes(AsyncStorage, { photos: { keep_photo, remove_photo } }), []);
  const value = useMemo(() => ({ user, ready, api, saved, current, set_current }), [user, ready, api, saved, current]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useApp(): AppState {
  const value = useContext(Context);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
