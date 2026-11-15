import { router } from "expo-router";
import { useCallback } from "react";
import { useApp } from "../AppContext";
import { ApiError } from "../api/client";
import type { WallPhoto } from "../ui/wallPhotos";

/**
 * Opens the recipe for a dish tapped on the Home photo wall. It works like taking a photo:
 * the recipe screen slides up, shows that it's finding the recipe, then shows it. It uses no free photo.
 */
export function useOpenWallDish() {
  const { api, setCurrent } = useApp();
  return useCallback(
    async (dish: Pick<WallPhoto, "name" | "kind">) => {
      setCurrent({ status: "loading" });
      router.push("/recipe");
      try {
        const { recipe, image } = await api.featuredRecipe(dish.name, dish.kind);
        setCurrent({
          status: "ready",
          kind: dish.kind,
          recipe,
          guesses: [{ name: dish.name, confidence: "high", image }],
          selected: 0,
          image,
          localPhoto: null,
          savedId: null,
        });
      } catch (error) {
        setCurrent({
          status: "problem",
          message: error instanceof ApiError ? error.message : "That recipe couldn't be loaded. Please try again.",
        });
      }
    },
    [api, setCurrent],
  );
}
