import { describe, expect, it, vi } from "vitest";
import { confirm_method } from "../src/auth/confirmMethod";
import { purchase_label, store_plan_detail, store_trial_terms } from "../src/paywall/plans";
import {
  create_subscription_service,
  iso_period_days,
  plan_for_package,
  purchase_problem,
  SUBSCRIPTION_MESSAGES,
} from "../src/paywall/subscriptionService";

type FakeInfo = { entitlements: { active: Record<string, unknown> } };
const PREMIUM: FakeInfo = { entitlements: { active: { premium: {} } } };
const FREE: FakeInfo = { entitlements: { active: {} } };

function fake_sdk() {
  let user: string | null = null;
  const yearly = {
    identifier: "$rc_annual",
    packageType: "ANNUAL",
    product: { priceString: "$24.99", defaultOption: { freePhase: { billingPeriod: { iso8601: "P1W" } } } },
  };
  const monthly = { identifier: "$rc_monthly", packageType: "MONTHLY", product: { priceString: "$3.99", defaultOption: null } };
  const sdk = {
    configure: vi.fn(({ appUserID }: { appUserID: string | null }) => void (user = appUserID)),
    logIn: vi.fn(async (uid: string) => {
      user = uid;
      return { customerInfo: FREE };
    }),
    logOut: vi.fn(async () => void (user = null)),
    isAnonymous: vi.fn(async () => user === null),
    getAppUserID: vi.fn(async () => user),
    getOfferings: vi.fn(async () => ({ current: { availablePackages: [yearly, monthly] } })),
    purchasePackage: vi.fn(async (_item: unknown) => ({ customerInfo: PREMIUM })),
    restorePurchases: vi.fn(async () => FREE),
  };
  return sdk;
}

function service(sdk: ReturnType<typeof fake_sdk> | null, api_key: string | undefined = "goog_test") {
  // The fake stands in for the native module; only the calls the service makes are implemented.
  return create_subscription_service({ api_key, entitlement_id: "premium", load: async () => sdk as never });
}

describe("RevenueCat subscriptions", () => {
  it("says subscriptions aren't open yet when no RevenueCat key is in the build", async () => {
    const subs = service(fake_sdk(), "");
    expect(subs.unavailable_reason).toBe(SUBSCRIPTION_MESSAGES.not_set_up);
    await subs.identify("alice");
    expect(await subs.purchase("yearly")).toEqual({ kind: "failed", message: SUBSCRIPTION_MESSAGES.not_set_up });
    expect(await subs.get_plans()).toEqual([]);
  });

  it("explains that Expo Go can't buy, instead of failing silently", async () => {
    const subs = service(null);
    await subs.identify("alice");
    expect(await subs.purchase("monthly")).toEqual({ kind: "failed", message: SUBSCRIPTION_MESSAGES.expo_go });
  });

  it("asks people to sign in before buying, so the subscription belongs to an account", async () => {
    const sdk = fake_sdk();
    expect(await service(sdk).purchase("yearly")).toEqual({ kind: "failed", message: SUBSCRIPTION_MESSAGES.signed_out });
    expect(sdk.purchasePackage).not.toHaveBeenCalled();
  });

  it("shows the store's prices and the yearly free trial", async () => {
    const subs = service(fake_sdk());
    await subs.identify("alice");
    expect(await subs.get_plans()).toEqual([
      { id: "yearly", price: "$24.99", trial_days: 7 },
      { id: "monthly", price: "$3.99", trial_days: null },
    ]);
  });

  it("buys for the signed-in account and reports Premium", async () => {
    const sdk = fake_sdk();
    const subs = service(sdk);
    await subs.identify("alice");
    expect(await subs.purchase("yearly")).toEqual({ kind: "purchased", premium: true });
    expect(sdk.logIn).toHaveBeenCalledWith("alice");
    expect(sdk.purchasePackage.mock.calls[0][0]).toMatchObject({ identifier: "$rc_annual" });
  });

  it("logs the next account in after a sign-out, never buying for the previous one", async () => {
    const sdk = fake_sdk();
    const subs = service(sdk);
    await subs.identify("alice");
    await subs.reset();
    expect(sdk.logOut).toHaveBeenCalled();
    await subs.identify("bob");
    await subs.purchase("monthly");
    expect(await sdk.getAppUserID()).toBe("bob");
  });

  it("restores, and says so plainly when there's nothing to restore", async () => {
    const sdk = fake_sdk();
    const subs = service(sdk);
    await subs.identify("alice");
    expect(await subs.restore()).toEqual({ kind: "failed", message: SUBSCRIPTION_MESSAGES.nothing_to_restore });
    sdk.restorePurchases.mockResolvedValueOnce(PREMIUM);
    expect(await subs.restore()).toEqual({ kind: "purchased", premium: true });
  });

  it("turns store errors into sentences and treats closing the sheet as a quiet cancel", () => {
    expect(purchase_problem({ userCancelled: true })).toEqual({ kind: "cancelled" });
    expect(purchase_problem({ code: "PAYMENT_PENDING_ERROR" })).toEqual({ kind: "failed", message: SUBSCRIPTION_MESSAGES.pending });
    expect(purchase_problem({ code: "10" })).toEqual({ kind: "failed", message: SUBSCRIPTION_MESSAGES.network });
    expect(purchase_problem(new Error("boom"))).toEqual({ kind: "failed", message: SUBSCRIPTION_MESSAGES.failed });
  });

  it("reads plans and trial lengths", () => {
    expect(plan_for_package({ packageType: "ANNUAL", identifier: "x" } as never)).toBe("yearly");
    expect(plan_for_package({ packageType: "CUSTOM", identifier: "$rc_monthly" } as never)).toBe("monthly");
    expect(plan_for_package({ packageType: "LIFETIME", identifier: "x" } as never)).toBeNull();
    expect(iso_period_days("P1W")).toBe(7);
    expect(iso_period_days("P3D")).toBe(3);
    expect(iso_period_days("nonsense")).toBeNull();
  });
});

describe("paywall text with store prices", () => {
  it("uses the store's price and names the right store", () => {
    expect(store_plan_detail("yearly", "€27,99")).toBe("€27,99 / year");
    expect(store_trial_terms("yearly", "$24.99", 7, "android")).toBe("Free for 7 days, then $24.99 / year. Cancel anytime in Google Play.");
    expect(store_trial_terms("monthly", "$3.99", null, "ios")).toBe(
      "$3.99 / month, renews automatically. Cancel anytime in the App Store.",
    );
    expect(purchase_label(7)).toBe("Start 7-day free trial");
    expect(purchase_label(null)).toBe("Subscribe");
  });
});

describe("confirming an account before deletion", () => {
  it("uses the password when there is one, otherwise Google or Apple", () => {
    expect(confirm_method({ providers: ["password"] })).toBe("password");
    expect(confirm_method({ providers: ["google.com", "password"] })).toBe("password");
    expect(confirm_method({ providers: ["google.com"] })).toBe("google");
    expect(confirm_method({ providers: ["apple.com"] })).toBe("apple");
    expect(confirm_method({})).toBe("password");
  });
});

describe("store review timing", async () => {
  const { MAX_REVIEW_ASKS, NO_REVIEW_ASKS, REVIEW_COOLDOWN_MS, parse_review_state, review_due, with_active_day } =
    await import("../src/review/storeReview");
  const day = 24 * 60 * 60 * 1000;
  const start = new Date(2026, 10, 1, 12).getTime();

  it("waits for three different days with a recipe opened", () => {
    let state = with_active_day(NO_REVIEW_ASKS, start);
    state = with_active_day(state, start + 60_000);
    state = with_active_day(state, start + day);
    expect(state.days).toHaveLength(2);
    expect(review_due(state, start + day)).toBe(false);
    state = with_active_day(state, start + 2 * day);
    expect(review_due(state, start + 2 * day)).toBe(true);
  });

  it("asks rarely and never more than three times", () => {
    const base = { ...NO_REVIEW_ASKS, days: ["2026-11-01", "2026-11-02", "2026-11-03"] };
    expect(review_due({ ...base, asks: 1, last_asked_at: start }, start + REVIEW_COOLDOWN_MS - 1)).toBe(false);
    expect(review_due({ ...base, asks: 1, last_asked_at: start }, start + REVIEW_COOLDOWN_MS)).toBe(true);
    expect(review_due({ ...base, asks: MAX_REVIEW_ASKS, last_asked_at: null }, start)).toBe(false);
  });

  it("treats unreadable saved state as a fresh start", () => {
    expect(parse_review_state("not json")).toEqual(NO_REVIEW_ASKS);
    expect(parse_review_state('{"asks":-1,"days":["bad",3,"2026-11-02"]}')).toEqual({ asks: 0, last_asked_at: null, days: ["2026-11-02"] });
  });
});
