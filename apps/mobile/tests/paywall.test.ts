import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN,
  FREE_SAVED_RECIPES,
  paywall_eyebrow,
  FREE_TRIAL_DAYS,
  PLANS,
  plan_detail,
  trial_terms,
  yearly_per_month,
  yearly_saving_percent,
} from "../src/paywall/plans";

describe("paywall plans", () => {
  it("uses the prices decided on 2026-11-15", () => {
    expect(PLANS.monthly.priceUsd).toBe(3.99);
    expect(PLANS.yearly.priceUsd).toBe(24.99);
    expect(FREE_TRIAL_DAYS).toBe(7);
    expect(DEFAULT_PLAN).toBe("yearly");
  });

  it("explains why the paywall opened", () => {
    expect(FREE_SAVED_RECIPES).toBe(3);
    expect(paywall_eyebrow("photos")).toBe("YOU'VE USED YOUR 3 FREE PHOTOS");
    expect(paywall_eyebrow("saved")).toBe("YOU'VE SAVED YOUR 3 FREE RECIPES");
  });

  it("works out the yearly deal without overstating it", () => {
    expect(yearly_per_month()).toBe(2.08);
    expect(yearly_saving_percent()).toBe(48);
  });

  it("writes the plan and trial lines shown on the paywall", () => {
    expect(plan_detail("yearly")).toBe("$24.99 / year · just $2.08 / month");
    expect(plan_detail("monthly")).toBe("$3.99 / month");
    expect(trial_terms("yearly")).toBe("Free for 7 days, then $24.99 / year. Cancel anytime in Google Play.");
  });
});
