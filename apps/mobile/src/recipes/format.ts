import { possible_allergen_line } from "./allergenRisk";
import { scale_amount } from "./scale";
import type { Diet, Ingredient, Recipe } from "./types";

export function format_minutes(total: number): string {
  if (total <= 0) return "No cooking";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

export function format_ingredient({ amount, unit, item }: Ingredient): string {
  return [amount, unit, item]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

/** What makes a shared recipe the sender's own (approved 2026-11-19). */
export type ShareDetails = {
  /** The serving size the person picked; ingredient amounts are scaled to it. */
  servings?: number;
  /** The diet version being shown, if any. */
  diet?: Diet | null;
  /** The person's own "I made this" note. */
  note?: string;
  /** The app's store page, once Recipeak is published. */
  store_url?: string | null;
};

/** Plain text for sharing or copying a recipe: the version the person is looking at, with their own note. */
export function recipe_as_text(recipe: Recipe, details: ShareDetails = {}): string {
  const base = recipe.servings || 1;
  const servings = details.servings && details.servings > 0 ? details.servings : base;
  const factor = servings / base;
  const lines = [recipe.title];
  if (details.diet) lines.push(`${details.diet[0].toUpperCase()}${details.diet.slice(1)} version`);
  lines.push("", recipe.description, "");
  lines.push(`Serves ${servings} · Prep ${format_minutes(recipe.prep_minutes)} · Cook ${format_minutes(recipe.cook_minutes)}`, "");
  if (recipe.cocktail) {
    lines.push(`Glass: ${recipe.cocktail.glass}`);
    if (recipe.cocktail.garnish) lines.push(`Garnish: ${recipe.cocktail.garnish}`);
    lines.push("");
  }
  lines.push(
    "Ingredients",
    ...recipe.ingredients.map((i) => `• ${format_ingredient({ ...i, amount: scale_amount(i.amount, factor) })}`),
    "",
  );
  lines.push("Steps", ...recipe.steps.map((s, n) => `${n + 1}. ${s}`));
  if (recipe.tips?.length) lines.push("", "Tips", ...recipe.tips.map((t) => `• ${t}`));
  if (recipe.make_ahead) lines.push("", `Make ahead and storage: ${recipe.make_ahead}`);
  if (recipe.variations?.length) lines.push("", "Variations", ...recipe.variations.map((t) => `• ${t}`));
  if (recipe.cocktail?.non_alcoholic_version) lines.push("", `Non-alcoholic version: ${recipe.cocktail.non_alcoholic_version}`);
  if (recipe.allergens.length) lines.push("", `Contains: ${recipe.allergens.join(", ")}`);
  const possible = possible_allergen_line(recipe);
  if (possible) lines.push(...(recipe.allergens.length ? [] : [""]), possible);
  if (recipe.note) lines.push("", `Note: ${recipe.note}`);
  const note = details.note?.trim();
  if (note) lines.push("", `My note: ${note}`);
  lines.push("", "Made with Relish. A representative recipe, not the original restaurant or bar recipe.");
  if (details.store_url) lines.push(`Get Relish: ${details.store_url}`);
  return lines.join("\n");
}
