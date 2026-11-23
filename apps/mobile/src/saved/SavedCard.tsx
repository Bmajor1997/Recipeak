// A saved recipe's card, on Saved and on Home's "Recently saved", with its own cover photo (see savedCover.ts).
import { router } from "expo-router";
import { useApp } from "../AppContext";
import { total_minutes } from "../recipes/search";
import type { SavedRecipe } from "../recipes/types";
import { PhotoCard } from "../ui/PhotoCard";
import { saved_as_current, saved_cover } from "./savedCover";

export function SavedCard({ item, width, height }: { item: SavedRecipe; width: number; height: number }) {
  const { api, set_current } = useApp();
  const cover = saved_cover(item, (path) => api.image_uri(path));
  return (
    <PhotoCard
      title={item.recipe.title}
      kind={item.kind}
      minutes={total_minutes(item)}
      photoUri={cover.uri}
      photoSource={cover.source}
      fallbackUri={cover.fallback_uri}
      width={width}
      height={height}
      onPress={() => {
        void saved_as_current(item).then((current) => {
          set_current(current);
          router.push("/recipe");
        });
      }}
    />
  );
}
