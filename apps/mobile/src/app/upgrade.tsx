// The paywall, shown after the 3 free photos or when a free account tries to save a 4th recipe (design "A · Plan picker", approved 2026-11-15).
// Buying is not connected yet: RevenueCat and the Google Play products come in phase 3 (docs/PROJECT-PLAN.md).
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DEFAULT_PLAN,
  FREE_TRIAL_DAYS,
  PLANS,
  type PlanId,
  paywall_eyebrow,
  plan_detail,
  trial_terms,
  yearly_saving_percent,
} from "../paywall/plans";
import { Button, colors, Notice, type } from "../ui/theme";

const heroArt = require("../../assets/hero.png");
const PLAN_ORDER: PlanId[] = ["yearly", "monthly"];
const NOT_YET = "Subscriptions aren't open yet. Your saved recipes are still here, and we'll let you know when you can subscribe.";

export default function Upgrade() {
  const insets = useSafeAreaInsets();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [selected, set_selected] = useState<PlanId>(DEFAULT_PLAN);
  const [notice, set_notice] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/saved"));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={close} style={styles.close}>
          <Ionicons name="close" size={20} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.artCard}>
        <Image source={heroArt} style={styles.art} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>

      <Text style={styles.eyebrow}>{paywall_eyebrow(reason === "saved" ? "saved" : "photos")}</Text>
      <Text style={[type.title, { marginTop: 8 }]} accessibilityRole="header">
        Keep snapping. Keep cooking.
      </Text>
      <Text style={[type.muted, { marginTop: 8, fontSize: 15, lineHeight: 22 }]}>
        Unlimited photos, every saved recipe, and diet versions of any dish or drink.
      </Text>

      <View accessibilityRole="radiogroup" style={styles.plans}>
        {PLAN_ORDER.map((id) => {
          const isSelected = selected === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${PLANS[id].title}, ${plan_detail(id)}${id === "yearly" ? `, save ${yearly_saving_percent()} percent` : ""}`}
              onPress={() => set_selected(id)}
              style={[styles.plan, isSelected && styles.planSelected]}
            >
              <View style={[styles.radio, isSelected && styles.radioOn]}>
                {isSelected && <Ionicons name="checkmark" size={13} color={colors.accentText} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{PLANS[id].title}</Text>
                <Text style={styles.planDetail}>{plan_detail(id)}</Text>
              </View>
              {id === "yearly" && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{`SAVE ${yearly_saving_percent()}%`}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexGrow: 1 }} />

      <Button label={`Start ${FREE_TRIAL_DAYS}-day free trial`} onPress={() => set_notice(NOT_YET)} />
      <Text style={styles.terms}>{trial_terms(selected)}</Text>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => set_notice(NOT_YET)} style={styles.restore}>
        <Text style={styles.restoreText}>Restore purchase</Text>
      </Pressable>
      {notice && <Notice>{notice}</Notice>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  artCard: {
    height: 196,
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  art: { width: "80%", height: "80%" },
  eyebrow: { marginTop: 24, color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 1.4 },
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
  planSelected: { borderWidth: 2, borderColor: colors.accent, backgroundColor: "#1F1513" },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#5A5A60",
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
