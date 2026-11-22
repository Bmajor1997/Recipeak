// The paywall, shown after the 3 free photos, when a free account tries to save a 4th recipe, or from "See Premium" in
// the first-launch tour (design "A · Plan picker", approved 2026-11-15; art: the outline place setting with a martini, approved 2026-11-20,
// drawn straight on the background with no card behind it).
// Buying goes through RevenueCat (subscriptions.ts), like Votic. The store's own prices replace the built-in ones as
// soon as the store answers; until RevenueCat and the Google Play products are set up, the buttons explain that
// subscriptions aren't open yet.
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DEFAULT_PLAN,
  FREE_TRIAL_DAYS,
  PLANS,
  type PaywallReason,
  type PlanId,
  paywall_eyebrow,
  plan_detail,
  purchase_label,
  store_plan_detail,
  store_trial_terms,
  trial_terms,
  yearly_saving_percent,
} from "./plans";
import type { PurchaseOutcome, StorePlan } from "./subscriptionService";
import { subscriptions } from "./subscriptions";
import { useApp } from "../AppContext";
import { Button, Notice, useTheme, useThemedStyles, type Palette } from "../ui/theme";

const art = require("../../assets/paywall-art.png");
const PLAN_ORDER: PlanId[] = ["yearly", "monthly"];

export function Paywall({ reason, onClose }: { reason: PaywallReason; onClose: () => void }) {
  const { colors, type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const insets = useSafeAreaInsets();
  // Exact sizes: Android otherwise sizes a bundled picture from its pixels and leaves a big gap around it.
  const art_width = Math.min(340, useWindowDimensions().width - 48);
  const [selected, set_selected] = useState<PlanId>(DEFAULT_PLAN);
  const [notice, set_notice] = useState<{ text: string; tone: "muted" | "error" } | null>(null);
  const [busy, set_busy] = useState(false);
  const [premium, set_premium] = useState(false);
  const { user } = useApp();
  // The store's prices for this account, or none yet (not set up, Expo Go, offline, or still loading).
  const [store_plans, set_store_plans] = useState<Partial<Record<PlanId, StorePlan>>>({});
  useEffect(() => {
    let live = true;
    if (user)
      void subscriptions.get_plans().then((plans) => {
        if (live) set_store_plans(Object.fromEntries(plans.map((plan) => [plan.id, plan])));
      });
    return () => {
      live = false;
    };
  }, [user]);
  const store_plan = store_plans[selected];
  const trial_days = store_plan ? store_plan.trial_days : FREE_TRIAL_DAYS;

  async function run(step: () => Promise<PurchaseOutcome>) {
    set_busy(true);
    set_notice(null);
    const outcome = await step();
    set_busy(false);
    if (outcome.kind === "failed") return set_notice({ text: outcome.message, tone: "error" });
    if (outcome.kind === "purchased" && outcome.premium) {
      set_premium(true);
      set_notice({ text: "You're Premium. Unlimited photos, saves and recipe versions are on.", tone: "muted" });
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={styles.close}>
          <Ionicons name="close" size={20} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.artWrap}>
        <Image source={art} style={{ width: art_width, height: (art_width * 600) / 1040 }} resizeMode="contain" accessible={false} />
      </View>

      <Text style={styles.eyebrow}>{paywall_eyebrow(reason)}</Text>
      <Text style={[type.title, { marginTop: 8 }]} accessibilityRole="header">
        Keep snapping. Keep cooking.
      </Text>
      <Text style={[type.muted, { marginTop: 8, fontSize: 15, lineHeight: 22 }]}>
        Unlimited photos, every saved recipe, and vegetarian, vegan, or meat and dairy versions of any dish.
      </Text>

      <View accessibilityRole="radiogroup" style={styles.plans}>
        {PLAN_ORDER.map((id) => {
          const isSelected = selected === id;
          const detail = (plan: PlanId) => {
            const sold = store_plans[plan];
            return sold ? store_plan_detail(plan, sold.price) : plan_detail(plan);
          };
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${PLANS[id].title}, ${detail(id)}${id === "yearly" ? `, save ${yearly_saving_percent()} percent` : ""}`}
              onPress={() => set_selected(id)}
              style={[styles.plan, isSelected && styles.planSelected]}
            >
              <View style={[styles.radio, isSelected && styles.radioOn]}>
                {isSelected && <Ionicons name="checkmark" size={13} color={colors.accentText} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{PLANS[id].title}</Text>
                <Text style={styles.planDetail}>{detail(id)}</Text>
              </View>
              {id === "yearly" && !store_plans.yearly && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{`SAVE ${yearly_saving_percent()}%`}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexGrow: 1 }} />

      {premium ? (
        <Button label="Done" onPress={onClose} />
      ) : (
        <>
          <Button label={purchase_label(trial_days)} busy={busy} onPress={() => void run(() => subscriptions.purchase(selected))} />
          <Text style={styles.terms}>
            {store_plan ? store_trial_terms(selected, store_plan.price, store_plan.trial_days, Platform.OS) : trial_terms(selected)}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            hitSlop={8}
            onPress={() => void run(() => subscriptions.restore())}
            style={styles.restore}
          >
            <Text style={styles.restoreText}>Restore purchase</Text>
          </Pressable>
        </>
      )}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    </ScrollView>
  );
}

const create_styles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { flexGrow: 1, paddingHorizontal: 24 },
    topBar: { flexDirection: "row", justifyContent: "flex-end" },
    close: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    artWrap: { marginTop: 8, alignItems: "center" },
    eyebrow: { marginTop: 24, color: colors.accentInk, fontSize: 12, fontWeight: "700", letterSpacing: 1.4 },
    plans: { marginTop: 20, gap: 10 },
    plan: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      minHeight: 64,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    planSelected: { borderWidth: 2, borderColor: colors.accentInk, backgroundColor: colors.accentTint },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.control,
      alignItems: "center",
      justifyContent: "center",
    },
    radioOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    planTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
    planDetail: { color: colors.muted, fontSize: 13, marginTop: 2 },
    badge: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
    badgeText: { color: colors.accentText, fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
    terms: { marginTop: 10, textAlign: "center", color: colors.muted, fontSize: 12, lineHeight: 17 },
    restore: { alignSelf: "center", marginTop: 8, minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
    restoreText: { color: colors.muted, fontSize: 13, textDecorationLine: "underline" },
  });
