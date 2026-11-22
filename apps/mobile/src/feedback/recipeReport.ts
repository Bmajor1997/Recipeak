// "Report this recipe" on the recipe screen. Google Play requires apps that make content with AI to let people
// report offensive results without leaving the app. A report is sent as a bug report with its reason, so it shows on
// the same private feedback dashboard; offensive or unsafe ones are flagged there for safety review.

export type ReportReason = "offensive" | "unsafe" | "wrong_dish" | "inaccurate" | "other";

/** Same values and order the server accepts (server/feedback.js REPORT_REASONS). */
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "offensive", label: "Offensive or inappropriate" },
  { value: "unsafe", label: "Unsafe to follow" },
  { value: "wrong_dish", label: "Not the dish or drink in my photo" },
  { value: "inaccurate", label: "Wrong ingredients, steps or allergens" },
  { value: "other", label: "Something else" },
];

export const MAX_REPORT_DETAILS = 2000;
// Feedback descriptions are limited to 5,000 characters by server/feedback.js.
const MAX_REPORT_DESCRIPTION = 5000;
const MAX_TITLE = 120;

export type RecipeReportInput = {
  reason: ReportReason;
  dish: string;
  kind: "meal" | "cocktail";
  diet?: string | null;
  details: string;
  recipe?: { title: string; ingredients: { amount: string; unit: string; item: string }[]; steps: string[]; allergens: string[] };
};

/** The title and description the dashboard shows for one report. */
export function report_text({ reason, dish, kind, diet, details, recipe }: RecipeReportInput): { title: string; description: string } {
  const prefix = "Recipe report: ";
  const name = dish.trim() || "Untitled recipe";
  const title = (prefix + name).length > MAX_TITLE ? `${(prefix + name).slice(0, MAX_TITLE - 1)}…` : prefix + name;
  const label = REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
  const lines = [
    `Reason: ${label}`,
    `Recipe: ${name} (${kind === "cocktail" ? "drink" : "meal"}${diet ? `, ${diet} version` : ""})`,
    `Details: ${details.trim().slice(0, MAX_REPORT_DETAILS) || "None given"}`,
  ];
  return { title, description: lines.join("\n") };
}
