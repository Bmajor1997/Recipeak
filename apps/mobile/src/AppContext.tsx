// App-wide state: who is signed in, the API client, saved recipes, and the latest photo result.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { type Api, createApi } from "./api/client";
import { type AppUser, firebase } from "./auth/firebase";
import type { DishImage, Guess, Kind, Recipe } from "./recipes/types";
import { keepPhoto, removePhoto } from "./saved/photoStore";
import { createSavedRecipes } from "./saved/savedRecipes";

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
  saved: ReturnType<typeof createSavedRecipes>;
  current: CurrentRecipe | null;
  setCurrent: (value: CurrentRecipe | null) => void;
};

const Context = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState<CurrentRecipe | null>(null);

  useEffect(
    () =>
      firebase.subscribe((next) => {
        setUser(next);
        setReady(true);
      }),
    [],
  );

  const api = useMemo(() => createApi({ baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL, idToken: firebase.idToken }), []);
  const saved = useMemo(() => createSavedRecipes(AsyncStorage, { photos: { keepPhoto, removePhoto } }), []);
  const value = useMemo(() => ({ user, ready, api, saved, current, setCurrent }), [user, ready, api, saved, current]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useApp(): AppState {
  const value = useContext(Context);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
