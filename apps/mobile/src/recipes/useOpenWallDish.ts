import { router } from "expo-router";
import { useCallback } from "react";
import { useApp } from "../AppContext";
import { ApiError } from "../api/client";
import { bundled_photo_uri, bundled_recipe, find_bundled_dish } from "./bundled";
import { NO_IMAGE, type Kind } from "./types";

/**
 * Opens the recipe for a dish tapped on the Home photo wall or in Explore. It works like taking a photo: the recipe
 * screen slides up and shows the recipe. Dishes in the bundled collection open instantly with their own photo;
 * anything else is fetched from the server. It never uses a free photo.
 */
export function useOpenWallDish() {
  const { api, set_current, recent } = useApp();
  return useCallback(
    async (dish: { name: string; kind: Kind }) => {
      const bundled = find_bundled_dish(dish.kind, dish.name);
      set_current({ status: "loading", photo: bundled?.source });
      router.push("/recipe");
      if (bundled) void recent?.add(bundled.id).catch(() => {});
      const recipe = bundled && bundled_recipe(bundled);
      if (bundled && recipe) {
        const photo = await bundled_photo_uri(bundled);
        set_current({
          status: "ready",
          kind: dish.kind,
          recipe,
          guesses: [{ name: bundled.name, confidence: "high", image: NO_IMAGE }],
          selected: 0,
          image: NO_IMAGE,
          localPhoto: photo,
          savedId: null,
          picked: true,
        });
        return;
      }
      try {
        const { recipe: fetched, image } = await api.featured_recipe(dish.name, dish.kind);
        set_current({
          status: "ready",
          kind: dish.kind,
          recipe: fetched,
          guesses: [{ name: dish.name, confidence: "high", image }],
          selected: 0,
          image,
          localPhoto: null,
          savedId: null,
          picked: true,
        });
      } catch (error) {
        set_current({
          status: "problem",
          source: "wall",
          message: error instanceof ApiError ? error.message : "That recipe couldn't be loaded. Please try again.",
        });
      }
    },
    [api, set_current, recent],
  );
}
