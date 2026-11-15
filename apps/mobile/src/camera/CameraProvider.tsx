// Lets any screen (and the centre tab button) open the camera. When the person taps Send, the camera slides
// down and the recipe sheet slides up straight away, showing "Finding your recipe…" until the answer arrives.
import { router } from "expo-router";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useApp } from "../AppContext";
import { ApiError } from "../api/client";
import { preparePhoto } from "../photos/prepare";
import { CameraSheet, type Photo } from "./CameraSheet";

type CameraState = {
  openCamera: () => void;
  /** null for subscribers, undefined while unknown. */
  photosLeft: number | null | undefined;
  refreshAllowance: () => void;
};

const Context = createContext<CameraState | null>(null);

export const photosLeftText = (left: number | null | undefined) =>
  left == null ? null : left === 1 ? "1 free photo left" : `${left} free photos left`;

export function CameraProvider({ children }: { children: ReactNode }) {
  const { api, setCurrent, user } = useApp();
  const [open, setOpen] = useState(false);
  const [photosLeft, setPhotosLeft] = useState<number | null | undefined>(undefined);

  const refreshAllowance = useCallback(() => {
    if (!user) return;
    api.allowance().then(
      (a) => setPhotosLeft(a.premium ? null : a.free_photos_left),
      () => setPhotosLeft(undefined),
    );
  }, [api, user]);
  useEffect(refreshAllowance, [refreshAllowance]);

  const findRecipe = useCallback(
    async (photo: Photo) => {
      setOpen(false);
      setCurrent({ status: "loading" });
      router.push("/recipe");
      try {
        const { dataUrl } = await preparePhoto(photo.uri, photo.width, photo.height);
        const result = await api.identify(dataUrl);
        setPhotosLeft(result.premium ? null : result.free_photos_left);
        if (result.kind === "not_food") {
          setCurrent({ status: "problem", message: "That doesn't look like a meal or a drink. Try again, closer up and in good light." });
          return;
        }
        setCurrent({
          status: "ready",
          kind: result.kind,
          recipe: result.recipe,
          guesses: result.guesses,
          selected: 0,
          image: result.guesses[0].image,
          localPhoto: null,
          savedId: null,
        });
      } catch (error) {
        if (error instanceof ApiError && error.needsUpgrade) {
          setCurrent(null);
          router.replace("/upgrade");
        } else {
          setCurrent({
            status: "problem",
            message: error instanceof ApiError ? error.message : "That photo couldn't be read. Please try another one.",
          });
        }
      }
    },
    [api, setCurrent],
  );

  const openCamera = useCallback(() => setOpen(true), []);

  const value = useMemo(() => ({ openCamera, photosLeft, refreshAllowance }), [openCamera, photosLeft, refreshAllowance]);
  return (
    <Context.Provider value={value}>
      {children}
      <CameraSheet visible={open} onClose={() => setOpen(false)} onPhoto={findRecipe} footnote={photosLeftText(photosLeft)} />
    </Context.Provider>
  );
}

export function useCamera(): CameraState {
  const value = useContext(Context);
  if (!value) throw new Error("useCamera must be used inside CameraProvider");
  return value;
}
