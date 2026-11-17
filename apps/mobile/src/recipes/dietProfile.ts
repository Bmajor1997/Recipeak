// The diet profile of a bundled dish: the shared rules plus its hand-written versions and the audit's decisions.
import variants from "./collectionVariants.json";
import review from "./dietReview.json";
import { diet_profile, type DietOverride, type DietProfile } from "./diets";
import type { Diet, Kind, Recipe } from "./types";

export function bundled_diet_profile(id: string, recipe: Recipe, kind: Kind): DietProfile {
  const v = (variants as Record<string, Record<string, unknown>>)[id] ?? {};
  const hand = (Object.keys(v) as Diet[]).filter((d) => v[d] !== "same");
  const overrides = (review as Record<string, Partial<Record<Diet, DietOverride>>>)[id] ?? {};
  return diet_profile(recipe, kind, hand, overrides);
}
