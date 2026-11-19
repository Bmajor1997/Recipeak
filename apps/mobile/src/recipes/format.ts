import type { Ingredient, Recipe } from "./types";

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

/** Plain text for sharing or copying a recipe. */
export function recipe_as_text(recipe: Recipe): string {
  const lines = [recipe.title, "", recipe.description, ""];
  lines.push(`Serves ${recipe.servings} · Prep ${format_minutes(recipe.prep_minutes)} · Cook ${format_minutes(recipe.cook_minutes)}`, "");
  if (recipe.cocktail) {
    lines.push(`Glass: ${recipe.cocktail.glass}`);
    if (recipe.cocktail.garnish) lines.push(`Garnish: ${recipe.cocktail.garnish}`);
    lines.push("");
  }
  lines.push("Ingredients", ...recipe.ingredients.map((i) => `• ${format_ingredient(i)}`), "");
  lines.push("Steps", ...recipe.steps.map((s, n) => `${n + 1}. ${s}`));
  if (recipe.tips?.length) lines.push("", "Tips", ...recipe.tips.map((t) => `• ${t}`));
  if (recipe.make_ahead) lines.push("", `Make ahead and storage: ${recipe.make_ahead}`);
  if (recipe.variations?.length) lines.push("", "Variations", ...recipe.variations.map((t) => `• ${t}`));
  if (recipe.cocktail?.non_alcoholic_version) lines.push("", `Non-alcoholic version: ${recipe.cocktail.non_alcoholic_version}`);
  if (recipe.allergens.length) lines.push("", `Contains: ${recipe.allergens.join(", ")}`);
  if (recipe.note) lines.push("", `Note: ${recipe.note}`);
  lines.push("", "From Recipeak. A representative recipe, not the original restaurant or bar recipe.");
  return lines.join("\n");
}
