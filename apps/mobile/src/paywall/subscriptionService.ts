// Subscriptions through RevenueCat, set up the same way as Votic (src/subscription/revenueCatService.ts there).
// RevenueCat opens the official Google Play (or App Store) purchase sheet, so Recipeak never sees card details.
// The phone only starts purchases; the recipe server decides who is Premium by asking RevenueCat itself
// (server/premium_access.js), so nothing the phone says can unlock Premium on its own.
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import type { PlanId } from "./plans";

type Sdk = typeof import("react-native-purchases").default;

/** A plan as the store sells it: its own localized price and whether this person gets the free trial. */
export type StorePlan = { id: PlanId; price: string; trial_days: number | null };

export type PurchaseOutcome = { kind: "purchased"; premium: boolean } | { kind: "cancelled" } | { kind: "failed"; message: string };

export type SubscriptionService = {
  /** Why buying can't work in this build, or null when it can. */
  unavailable_reason: string | null;
  /** Links purchases to the signed-in account (its Firebase uid), so they follow it to other phones. */
  identify: (uid: string) => Promise<void>;
  /** Forgets the account when someone signs out or deletes it. */
  reset: () => Promise<void>;
  /** The yearly and monthly plans with the store's prices. Empty when the store has nothing to sell yet. */
  get_plans: () => Promise<StorePlan[]>;
  purchase: (plan: PlanId) => Promise<PurchaseOutcome>;
  /** Restores a subscription bought earlier, for example on another phone. */
  restore: () => Promise<PurchaseOutcome>;
};

export type SubscriptionDeps = {
  /** The RevenueCat public SDK key for this platform (goog_… on Android, appl_… on iOS). Not a secret. */
  api_key: string | undefined;
  entitlement_id: string;
  /** Loads the native module, or returns null when this build doesn't include it (Expo Go, web). */
  load: () => Promise<Sdk | null>;
};

export const SUBSCRIPTION_MESSAGES = {
  not_set_up: "Subscriptions aren't open yet. Your saved recipes are still here, and we'll let you know when you can subscribe.",
  expo_go: "Buying needs the installed Recipeak app. Expo Go can't open the store's purchase sheet.",
  signed_out: "Sign in first, so your subscription belongs to your account.",
  no_plan: "This plan isn't available right now. Please try again.",
  failed: "The purchase didn't finish. You haven't been charged. Please try again.",
  pending: "Your purchase is waiting for the store to finish. Premium turns on as soon as it does.",
  not_allowed: "Purchases aren't allowed on this device. Check Google Play's settings or parental controls.",
  network: "Couldn't reach the store. Check your internet and try again.",
  already_owned: "You already have this plan. Tap Restore purchase to turn Premium on here.",
  nothing_to_restore: "No subscription was found for this store account.",
} as const;

/** RevenueCat's standard package types for the two plans Recipeak sells. */
export function plan_for_package(item: Pick<PurchasesPackage, "packageType" | "identifier">): PlanId | null {
  if (item.packageType === "ANNUAL" || item.identifier === "$rc_annual") return "yearly";
  if (item.packageType === "MONTHLY" || item.identifier === "$rc_monthly") return "monthly";
  return null;
}

/** "P1W" → 7, "P7D" → 7, "P1M" → 30. Used only for the trial's length on the button. */
export function iso_period_days(period: string | null | undefined): number | null {
  const match = /^P(\d+)([DWMY])$/.exec(period ?? "");
  if (!match) return null;
  const count = Number(match[1]);
  return count * { D: 1, W: 7, M: 30, Y: 365 }[match[2] as "D" | "W" | "M" | "Y"];
}

/** The free trial on the option Google Play will use, or the App Store's free introductory price. */
export function trial_days_of(product: PurchasesPackage["product"]): number | null {
  const phase = product.defaultOption?.freePhase;
  if (phase) return iso_period_days(phase.billingPeriod?.iso8601);
  const intro = product.introPrice;
  if (intro && intro.price === 0) return iso_period_days(intro.period);
  return null;
}

export function has_entitlement(info: CustomerInfo, entitlement_id: string): boolean {
  return Boolean(info.entitlements?.active?.[entitlement_id]);
}

/** Turns RevenueCat's error codes into a plain sentence, or a quiet cancellation. */
export function purchase_problem(error: unknown): PurchaseOutcome {
  const value = (error ?? {}) as { userCancelled?: boolean; code?: string | number };
  const code = String(value.code ?? "");
  if (value.userCancelled || code === "1" || code === "PURCHASE_CANCELLED") return { kind: "cancelled" };
  if (code === "20" || code === "PAYMENT_PENDING_ERROR") return { kind: "failed", message: SUBSCRIPTION_MESSAGES.pending };
  if (code === "3" || code === "PURCHASE_NOT_ALLOWED_ERROR") return { kind: "failed", message: SUBSCRIPTION_MESSAGES.not_allowed };
  if (code === "10" || code === "NETWORK_ERROR") return { kind: "failed", message: SUBSCRIPTION_MESSAGES.network };
  if (code === "6" || code === "PRODUCT_ALREADY_PURCHASED_ERROR") return { kind: "failed", message: SUBSCRIPTION_MESSAGES.already_owned };
  return { kind: "failed", message: SUBSCRIPTION_MESSAGES.failed };
}

export function create_subscription_service(deps: SubscriptionDeps): SubscriptionService {
  const unavailable_reason = deps.api_key ? null : SUBSCRIPTION_MESSAGES.not_set_up;
  let sdk_promise: Promise<Sdk | null> | null = null;
  const packages = new Map<PlanId, PurchasesPackage>();
  // Account changes run one after another, so a slow sign-out can never sign out the next account.
  let queue: Promise<unknown> = Promise.resolve();
  let generation = 0;
  let account: string | null = null;
  function in_order<T>(step: () => Promise<T>): Promise<T> {
    const result = queue.then(step);
    queue = result.catch(() => {});
    return result;
  }
  // RevenueCat starts on first use with the signed-in account, so opening the app never creates an anonymous customer.
  function sdk(uid?: string): Promise<Sdk | null> {
    if (!deps.api_key) return Promise.resolve(null);
    sdk_promise ??= deps
      .load()
      .then((loaded) => {
        loaded?.configure({ apiKey: deps.api_key as string, appUserID: uid ?? null });
        return loaded;
      })
      .catch(() => null);
    return sdk_promise;
  }
  async function ready(): Promise<{ purchases: Sdk; token: number } | PurchaseOutcome> {
    if (unavailable_reason) return { kind: "failed", message: unavailable_reason };
    await queue;
    const token = generation;
    if (!account) return { kind: "failed", message: SUBSCRIPTION_MESSAGES.signed_out };
    const purchases = await sdk(account);
    if (!purchases) return { kind: "failed", message: SUBSCRIPTION_MESSAGES.expo_go };
    // Never buy for a customer other than the signed-in account.
    if ((await purchases.getAppUserID()) !== account) await purchases.logIn(account);
    return { purchases, token };
  }

  async function get_plans(): Promise<StorePlan[]> {
    const started = await ready().catch(() => null);
    if (!started || "kind" in started) return [];
    try {
      const offerings = await started.purchases.getOfferings();
      if (started.token !== generation) return [];
      packages.clear();
      const plans: StorePlan[] = [];
      for (const item of offerings.current?.availablePackages ?? []) {
        const id = plan_for_package(item);
        if (!id || packages.has(id)) continue;
        packages.set(id, item);
        plans.push({ id, price: item.product.priceString, trial_days: trial_days_of(item.product) });
      }
      return plans;
    } catch {
      return [];
    }
  }

  return {
    unavailable_reason,
    get_plans,
    identify(uid) {
      const token = ++generation;
      account = uid;
      packages.clear();
      return in_order(async () => {
        try {
          const purchases = await sdk(uid);
          if (purchases && token === generation) await purchases.logIn(uid);
        } catch {
          // Retried before the next purchase or restore.
        }
      });
    },
    reset() {
      ++generation;
      account = null;
      packages.clear();
      return in_order(async () => {
        try {
          const purchases = sdk_promise ? await sdk_promise : null;
          if (purchases && !(await purchases.isAnonymous())) await purchases.logOut();
        } catch {
          // Nothing to forget.
        }
      });
    },
    async purchase(plan) {
      try {
        const started = await ready();
        if ("kind" in started) return started;
        if (!packages.has(plan)) await get_plans();
        const item = packages.get(plan);
        if (!item) return { kind: "failed", message: SUBSCRIPTION_MESSAGES.no_plan };
        const { customerInfo } = await started.purchases.purchasePackage(item);
        if (started.token !== generation) return { kind: "cancelled" };
        return { kind: "purchased", premium: has_entitlement(customerInfo, deps.entitlement_id) };
      } catch (error) {
        return purchase_problem(error);
      }
    },
    async restore() {
      try {
        const started = await ready();
        if ("kind" in started) return started;
        const info = await started.purchases.restorePurchases();
        if (started.token !== generation) return { kind: "cancelled" };
        return has_entitlement(info, deps.entitlement_id)
          ? { kind: "purchased", premium: true }
          : { kind: "failed", message: SUBSCRIPTION_MESSAGES.nothing_to_restore };
      } catch (error) {
        return purchase_problem(error);
      }
    },
  };
}
