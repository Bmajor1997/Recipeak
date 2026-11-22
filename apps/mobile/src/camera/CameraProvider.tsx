// Lets any screen (and the centre tab button) open the camera. When the person taps Send, the camera slides
// down and the recipe sheet slides up straight away, showing "Finding your recipe…" until the answer arrives.
import { router } from "expo-router";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../AppContext";
import { ApiError } from "../api/client";
import { prepare_photo } from "../photos/prepare";
import { bundled_photo_uri, bundled_recipe, find_bundled_dish } from "../recipes/bundled";
import { NO_IMAGE } from "../recipes/types";
import { CameraSheet, type Photo } from "./CameraSheet";

type CameraState = {
  open_camera: () => void;
  /** null for subscribers, undefined while unknown. */
  photosLeft: number | null | undefined;
  refresh_allowance: () => void;
};

const Context = createContext<CameraState | null>(null);

export const photos_left_text = (left: number | null | undefined) =>
  left == null ? null : left === 1 ? "1 free photo left" : `${left} free photos left`;

export function CameraProvider({ children }: { children: ReactNode }) {
  const { api, set_current, user } = useApp();
  const [open, set_open] = useState(false);
  const [photosLeft, set_photos_left] = useState<number | null | undefined>(undefined);

  // The account whose allowance is shown. An answer that arrives after a different account signs in is ignored,
  // so one account's plan is never applied to the next.
  const uid = user?.uid ?? null;
  const shown_for = useRef(uid);
  const refresh_allowance = useCallback(() => {
    if (!uid) return;
    api.allowance().then(
      (a) => {
        if (shown_for.current === uid) set_photos_left(a.premium ? null : a.free_photos_left);
      },
      () => {
        if (shown_for.current === uid) set_photos_left(undefined);
      },
    );
  }, [api, uid]);
  // A different account starts with an unknown allowance until the server answers for it.
  const [allowance_owner, set_allowance_owner] = useState(uid);
  if (allowance_owner !== uid) {
    set_allowance_owner(uid);
    set_photos_left(undefined);
  }
  useEffect(() => {
    shown_for.current = uid;
    refresh_allowance();
  }, [uid, refresh_allowance]);

  const find_recipe = useCallback(
    async (photo: Photo) => {
      set_open(false);
      set_current({ status: "loading" });
      router.push("/recipe");
      try {
        const { dataUrl } = await prepare_photo(photo.uri, photo.width, photo.height);
        const result = await api.identify(dataUrl);
        set_photos_left(result.premium ? null : result.free_photos_left);
        if (result.kind === "not_food") {
          set_current({ status: "problem", message: "That doesn't look like a meal or a drink. Try again, closer up and in good light." });
          return;
        }
        // A dish Recipeak already has opens straight away: a checked recipe and its photo, with no AI recipe.
        const top = result.guesses[0];
        const dish = find_bundled_dish(result.kind, top.name);
        const recipe = dish && bundled_recipe(dish);
        if (dish && recipe) {
          set_current({
            status: "ready",
            kind: result.kind,
            recipe,
            guesses: result.guesses.map((g, i) => (i === 0 ? { ...g, name: dish.name } : g)),
            selected: 0,
            image: NO_IMAGE,
            localPhoto: await bundled_photo_uri(dish),
            savedId: null,
            bundledId: dish.id,
          });
          return;
        }
        // Otherwise nothing more is made until the person says yes (recipe.tsx, AiOffer).
        set_current({ status: "ai-offer", kind: result.kind, guesses: result.guesses });
      } catch (error) {
        if (error instanceof ApiError && error.needsUpgrade) {
          set_current(null);
          router.replace("/upgrade");
        } else {
          set_current({
            status: "problem",
            message: error instanceof ApiError ? error.message : "That photo couldn't be read. Please try another one.",
          });
        }
      }
    },
    [api, set_current],
  );

  const open_camera = useCallback(() => set_open(true), []);

  const value = useMemo(() => ({ open_camera, photosLeft, refresh_allowance }), [open_camera, photosLeft, refresh_allowance]);
  return (
    <Context.Provider value={value}>
      {children}
      <CameraSheet visible={open} onClose={() => set_open(false)} onPhoto={find_recipe} footnote={photos_left_text(photosLeft)} />
    </Context.Provider>
  );
}

export function useCamera(): CameraState {
  const value = useContext(Context);
  if (!value) throw new Error("useCamera must be used inside CameraProvider");
  return value;
}
