import { router } from "expo-router";
import { useCallback } from "react";
import { useApp } from "../AppContext";
import { useCamera } from "../camera/CameraProvider";
import { ApiError } from "../api/client";
import { automatic_diet, diets_for_kind } from "../onboarding/onboarding";
import { useOnboarding } from "../onboarding/OnboardingProvider";
import { bundled_photo_uri, bundled_recipe, bundled_version, find_bundled_dish } from "./bundled";
import { NO_IMAGE, type Kind } from "./types";

/**
 * Opens the recipe for a dish tapped on the Home photo wall or in Explore. It works like taking a photo: the recipe
 * screen slides up and shows the recipe. Dishes in the bundled collection open instantly with their own photo;
 * anything else is fetched from the server. It never uses a free photo.
 */
export function useOpenWallDish() {
  const { api, set_current, recent } = useApp();
  const diets = useOnboarding().values.diets;
  // null means a subscriber (unlimited photos). Vegetarian and vegan versions are Premium, so only subscribers
  // open in their diet's version on their own; everyone else sees the standard recipe and its "Make it…" options.
  const { photosLeft } = useCamera();
  const subscriber = photosLeft === null;
  return useCallback(
    async (dish: { name: string; kind: Kind }) => {
      const bundled = find_bundled_dish(dish.kind, dish.name);
      set_current({ status: "loading", photo: bundled?.source });
      router.push("/recipe");
      if (bundled) void recent?.add(bundled.id).catch(() => {});
      const regular = bundled && bundled_recipe(bundled);
      // A subscriber who eats vegetarian or vegan sees that version straight away: it is built in, so it costs nothing.
      // When the dish already fits, the regular recipe opens as it is.
      const auto = bundled && subscriber ? automatic_diet(diets_for_kind(diets, dish.kind)) : null;
      const version = bundled && auto ? bundled_version(bundled.id, auto) : null;
      const recipe = version && !version.already ? version.recipe : regular;
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
          bundledId: bundled.id,
          ...(version && !version.already && auto ? { diet: auto } : {}),
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
    [api, set_current, recent, diets, subscriber],
  );
}
