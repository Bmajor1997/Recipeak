import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN, FREE_TRIAL_DAYS, PLANS, planDetail, trialTerms, yearlyPerMonth, yearlySavingPercent } from "../src/paywall/plans";

describe("paywall plans", () => {
  it("uses the prices decided on 2026-11-15", () => {
    expect(PLANS.monthly.priceUsd).toBe(3.99);
    expect(PLANS.yearly.priceUsd).toBe(24.99);
    expect(FREE_TRIAL_DAYS).toBe(7);
    expect(DEFAULT_PLAN).toBe("yearly");
  });

  it("works out the yearly deal without overstating it", () => {
    expect(yearlyPerMonth()).toBe(2.08);
    expect(yearlySavingPercent()).toBe(48);
  });

  it("writes the plan and trial lines shown on the paywall", () => {
    expect(planDetail("yearly")).toBe("$24.99 / year · just $2.08 / month");
    expect(planDetail("monthly")).toBe("$3.99 / month");
    expect(trialTerms("yearly")).toBe("Free for 7 days, then $24.99 / year. Cancel anytime in Google Play.");
  });
});
