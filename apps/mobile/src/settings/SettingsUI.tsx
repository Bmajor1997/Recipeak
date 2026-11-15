import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, type } from "../ui/theme";

export const CATEGORIES = {
  account: "Account",
  preferences: "Preferences",
  library: "Saved recipes & storage",
  usage: "Photo allowance",
  help: "Help & privacy",
} as const;
export type Category = keyof typeof CATEGORIES;
export const isCategory = (value: unknown): value is Category => typeof value === "string" && Object.hasOwn(CATEGORIES, value);

export function SettingsScreen({ title, back = false, children }: { title: string; back?: boolean; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
    >
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Settings"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/settings"))}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
          <Text style={type.body}>Settings</Text>
        </Pressable>
      )}
      <Text accessibilityRole="header" style={type.display}>
        {title}
      </Text>
      {children}
    </ScrollView>
  );
}
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={type.label}>
        {title}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}
export function Row({
  label,
  detail,
  icon,
  onPress,
}: {
  label: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.raised }]}
    >
      <Ionicons name={icon} size={24} color={colors.accent} accessible={false} />
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={type.muted}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} accessible={false} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, gap: 18, width: "100%", maxWidth: 720, alignSelf: "center" },
  back: { flexDirection: "row", alignItems: "center", minHeight: 48, gap: 6, alignSelf: "flex-start" },
  group: { gap: 10 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, overflow: "hidden", backgroundColor: colors.surface },
  row: {
    minHeight: 84,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  copy: { flex: 1, gap: 6 },
  label: { ...type.body, fontWeight: "600" },
});
