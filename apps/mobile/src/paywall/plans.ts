// The paid plans and their prices, decided 2026-11-15 (see docs/PROJECT-PLAN.md, "Paid plan").
// When RevenueCat is connected (phase 3), the store's own localized prices replace these labels.

export type PlanId = "yearly" | "monthly";

export type Plan = {
  id: PlanId;
  title: string;
  /** Price in US dollars for one billing period. */
  priceUsd: number;
  period: "year" | "month";
};

export const FREE_TRIAL_DAYS = 7;

/** What the free plan includes: 3 photos (counted on the server) and up to 3 recipes in Saved (counted on the phone). */
export const FREE_PHOTOS = 3;
export const FREE_SAVED_RECIPES = 3;

/** Why the paywall opened: the free photos ran out, Saved is full, or "See Premium" in the first-launch tour. */
export type PaywallReason = "photos" | "saved" | "intro";

export function paywall_eyebrow(reason: PaywallReason): string {
  if (reason === "intro") return "RECIPEEK PREMIUM";
  return reason === "saved" ? `YOU'VE SAVED YOUR ${FREE_SAVED_RECIPES} FREE RECIPES` : `YOU'VE USED YOUR ${FREE_PHOTOS} FREE PHOTOS`;
}

export const PLANS: Record<PlanId, Plan> = {
  yearly: { id: "yearly", title: "Yearly", priceUsd: 24.99, period: "year" },
  monthly: { id: "monthly", title: "Monthly", priceUsd: 3.99, period: "month" },
};

/** The plan that starts selected on the paywall. */
export const DEFAULT_PLAN: PlanId = "yearly";

export function format_usd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** What the yearly plan costs per month, rounded down to the cent so we never overstate the deal. */
export function yearly_per_month(): number {
  return Math.floor((PLANS.yearly.priceUsd / 12) * 100) / 100;
}

/** Saving of the yearly plan against paying monthly for 12 months, to the nearest whole percent (47.8% → 48). */
export function yearly_saving_percent(): number {
  const twelveMonths = PLANS.monthly.priceUsd * 12;
  return Math.round((1 - PLANS.yearly.priceUsd / twelveMonths) * 100);
}

/** The small line under a plan's name, e.g. "$24.99 / year · just $2.08 / month". */
export function plan_detail(id: PlanId): string {
  const plan = PLANS[id];
  const base = `${format_usd(plan.priceUsd)} / ${plan.period}`;
  return id === "yearly" ? `${base} · just ${format_usd(yearly_per_month())} / month` : base;
}

/** The fine print under the main button for the selected plan. */
export function trial_terms(id: PlanId): string {
  const plan = PLANS[id];
  return `Free for ${FREE_TRIAL_DAYS} days, then ${format_usd(plan.priceUsd)} / ${plan.period}. Cancel anytime in Google Play.`;
}
