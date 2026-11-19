// The first-launch tour's answers (design "Recipeak onboarding mockup", approved 2026-11-17). They are kept on this
// device, not per account, because the tour runs before sign-in.
import type { KeyValueStorage } from "../saved/savedRecipes";
import { DIETS, type Diet, type Kind } from "../recipes/types";

/** What the person wants more of on Home. Both kinds always show; this only changes the mix. */
export type Interest = "cocktails" | "meals" | "both";
export const INTERESTS: Interest[] = ["cocktails", "meals", "both"];

/** How the tour ended: "create" goes on to make an account, "sign-in" was "I already have an account". */
export type Entry = "create" | "sign-in";

export type Onboarding = { done: boolean; interest: Interest; diets: Diet[]; entry: Entry };
export const DEFAULT_ONBOARDING: Onboarding = { done: false, interest: "both", diets: [], entry: "create" };

const KEY = "recipeak.onboarding.v1";
// Answers saved before the app was respelled Recipeak, read once so nobody sees the tour again.
const OLD_KEY = "recipeek.onboarding.v1";

const is_interest = (v: unknown): v is Interest => INTERESTS.includes(v as Interest);
const is_diet = (v: unknown): v is Diet => (DIETS as readonly string[]).includes(v as string);

/** Reads saved answers, keeping whatever is valid, so a damaged value never shows the tour twice or crashes. */
export function parse_onboarding(raw: string | null): Onboarding {
  if (!raw) return { ...DEFAULT_ONBOARDING };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_ONBOARDING };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ...DEFAULT_ONBOARDING };
  const v = data as Record<string, unknown>;
  const diets = Array.isArray(v.diets) ? [...new Set(v.diets.filter(is_diet))] : [];
  return {
    done: v.done === true,
    interest: is_interest(v.interest) ? v.interest : "both",
    diets,
    entry: v.entry === "sign-in" ? "sign-in" : "create",
  };
}

export function create_onboarding_store(storage: KeyValueStorage) {
  return {
    async load(): Promise<Onboarding> {
      const raw = (await storage.getItem(KEY)) ?? (await storage.getItem(OLD_KEY));
      return parse_onboarding(raw);
    },
    async save(value: Onboarding): Promise<void> {
      await storage.setItem(KEY, JSON.stringify(value));
    },
  };
}

/** The "How do you eat?" choices, in the order shown. "Everything" means no diet. */
export const DIET_CHOICES: { diet: Diet | null; label: string }[] = [
  { diet: null, label: "Everything" },
  { diet: "vegetarian", label: "Vegetarian" },
  { diet: "vegan", label: "Vegan" },
  { diet: "gluten-free", label: "Gluten-free" },
  { diet: "dairy-free", label: "Dairy-free" },
  { diet: "nut-free", label: "Nut-free" },
  { diet: "low-carb", label: "Low-carb" },
  { diet: "non-alcoholic", label: "Non-alcoholic" },
];

/** Tapping a choice: "Everything" clears the others; any diet turns on or off, and turns "Everything" off. */
export function toggle_diet(diets: Diet[], choice: Diet | null): Diet[] {
  if (choice === null) return [];
  return diets.includes(choice) ? diets.filter((d) => d !== choice) : [...diets, choice];
}

/** Diets that make sense for this kind of dish: "non-alcoholic" is for drinks only. */
export const diets_for_kind = (diets: Diet[], kind: Kind): Diet[] => diets.filter((d) => kind === "cocktail" || d !== "non-alcoholic");

/**
 * The diet a recipe should open in on its own. Only the vegetarian and vegan versions ship with the app, so only
 * those switch automatically (instantly and without the server); vegan wins when both are chosen, since a vegan
 * recipe is also vegetarian.
 */
export function automatic_diet(diets: Diet[]): Diet | null {
  if (diets.includes("vegan")) return "vegan";
  if (diets.includes("vegetarian")) return "vegetarian";
  return null;
}

/** The chosen diets that need a tap to load (they come from the server), for a hint on the recipe screen. */
export function tap_diets(diets: Diet[], kind: Kind): Diet[] {
  return diets_for_kind(diets, kind).filter((d) => d !== "vegan" && d !== "vegetarian");
}

/** Readable list: "gluten-free", "gluten-free or dairy-free", "gluten-free, dairy-free or low-carb". */
export function or_list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}
