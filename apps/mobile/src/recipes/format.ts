import type { Ingredient, Recipe } from "./types";

export function formatMinutes(total: number): string {
  if (total <= 0) return "No cooking";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

export function formatIngredient({ amount, unit, item }: Ingredient): string {
  return [amount, unit, item]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

/** Plain text for sharing or copying a recipe. */
export function recipeAsText(recipe: Recipe): string {
  const lines = [recipe.title, "", recipe.description, ""];
  lines.push(`Serves ${recipe.servings} · Prep ${formatMinutes(recipe.prep_minutes)} · Cook ${formatMinutes(recipe.cook_minutes)}`, "");
  if (recipe.cocktail) {
    lines.push(`Glass: ${recipe.cocktail.glass}`);
    if (recipe.cocktail.garnish) lines.push(`Garnish: ${recipe.cocktail.garnish}`);
    lines.push("");
  }
  lines.push("Ingredients", ...recipe.ingredients.map((i) => `• ${formatIngredient(i)}`), "");
  lines.push("Steps", ...recipe.steps.map((s, n) => `${n + 1}. ${s}`));
  if (recipe.cocktail?.non_alcoholic_version) lines.push("", `Non-alcoholic version: ${recipe.cocktail.non_alcoholic_version}`);
  if (recipe.allergens.length) lines.push("", `Contains: ${recipe.allergens.join(", ")}`);
  if (recipe.note) lines.push("", `Tip: ${recipe.note}`);
  lines.push("", "From Meals and Mixers. A representative recipe, not the original restaurant or bar recipe.");
  return lines.join("\n");
}
