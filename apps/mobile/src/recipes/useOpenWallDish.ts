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
  const { api, set_current } = useApp();
  return useCallback(
    async (dish: Pick<WallPhoto, "name" | "kind">) => {
      set_current({ status: "loading" });
      router.push("/recipe");
      try {
        const { recipe, image } = await api.featured_recipe(dish.name, dish.kind);
        set_current({
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
        set_current({
          status: "problem",
          message: error instanceof ApiError ? error.message : "That recipe couldn't be loaded. Please try again.",
        });
      }
    },
    [api, set_current],
  );
}
