// Which versions of a recipe are part of Premium, and the "Make it non-vegetarian / non-vegan" options.
//
// Free accounts see every diet label ("Already vegan") and can still ask for the other diets (gluten-free and the
// rest, within the server's free allowance). Vegetarian and vegan versions, and the reverse versions below, are
// Premium: a free tap opens the Premium screen.
import type { DietProfile } from "./diets";
import type { Diet, Kind } from "./types";

export const PREMIUM_DIETS: readonly Diet[] = ["vegetarian", "vegan"];
export const is_premium_diet = (diet: Diet | null): boolean => diet !== null && PREMIUM_DIETS.includes(diet);

/**
 * The reverse of a diet version, for a meal that is already vegetarian or vegan. "non-vegetarian" adds the meat or
 * seafood that suits the dish; "non-vegan" adds dairy or eggs and stays vegetarian. Made by the server from the recipe
 * on screen, with exact amounts, steps and safe cooking temperatures.
 */
export type Addition = "non-vegetarian" | "non-vegan";

/** What each option adds, for screen readers and the Premium note. */
export const ADDITION_HINTS: Record<Addition, string> = {
  "non-vegetarian": "Adds meat or seafood that goes well with this dish",
  "non-vegan": "Adds dairy or eggs that go well with this dish",
};

/**
 * The reverse options a recipe gets: a vegetarian meal can be made non-vegetarian, and a vegan meal non-vegetarian or
 * non-vegan. Only for meals whose standard recipe the app is sure about (a label, not a "review"), never for drinks.
 */
export function additions_for(profile: DietProfile, kind: Kind): Addition[] {
  if (kind !== "meal") return [];
  const vegan = profile.fits.includes("vegan");
  const vegetarian = vegan || profile.fits.includes("vegetarian");
  return [...(vegetarian ? (["non-vegetarian"] as const) : []), ...(vegan ? (["non-vegan"] as const) : [])];
}
