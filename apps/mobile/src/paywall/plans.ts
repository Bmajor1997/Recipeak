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

/**
 * The free-photo line under the start screen's buttons. Nobody is signed in there, so no account's count is known: a
 * new account's offer is stated as that, and someone returning is shown no number (their count is on Home, the camera
 * and Settings once they log in, from the server).
 */
export function start_offer(returning: boolean): string {
  return returning
    ? "Your photos left and saved recipes are waiting in your account."
    : `New accounts get ${FREE_PHOTOS} free photos. No card needed.`;
}

/** Why the paywall opened: the free photos ran out, Saved is full, or "See Premium" in the first-launch tour. */
export type PaywallReason = "photos" | "saved" | "versions" | "intro";

export function paywall_eyebrow(reason: PaywallReason): string {
  if (reason === "intro") return "RECIPEAK PREMIUM";
  if (reason === "versions") return "MORE DIET VERSIONS WITH PREMIUM";
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

/** The store that bills the subscription, named in the fine print. */
export function store_name(platform: string): string {
  return platform === "ios" ? "the App Store" : "Google Play";
}

/** The plan line with the store's own localized price, once the store has answered. */
export function store_plan_detail(id: PlanId, price: string): string {
  return `${price} / ${PLANS[id].period}`;
}

/** The fine print with the store's price. Without a trial (already used, or none offered), it says so plainly. */
export function store_trial_terms(id: PlanId, price: string, trial_days: number | null, platform: string): string {
  const period = PLANS[id].period;
  const cancel = `Cancel anytime in ${store_name(platform)}.`;
  return trial_days
    ? `Free for ${trial_days} days, then ${price} / ${period}. ${cancel}`
    : `${price} / ${period}, renews automatically. ${cancel}`;
}

/** The main button: the trial's length when there is one, otherwise a plain "Subscribe". */
export function purchase_label(trial_days: number | null): string {
  return trial_days ? `Start ${trial_days}-day free trial` : "Subscribe";
}
