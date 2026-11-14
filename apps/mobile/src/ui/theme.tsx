// Large, high-contrast defaults, so the app is easy to read and every control is easy to hit.
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type TextStyle, View } from "react-native";

export const colors = {
  background: "#0E2A30", // deep teal, from the app icon
  surface: "#163A42",
  text: "#FFFFFF",
  muted: "#C9DADD",
  accent: "#FF7A45", // grapefruit orange
  accentText: "#1A0E08",
  danger: "#FFB4A6",
  border: "#2E5560",
};

export const type = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  heading: { color: colors.text, fontSize: 21, fontWeight: "700", marginTop: 20, marginBottom: 8 },
  body: { color: colors.text, fontSize: 18, lineHeight: 26 },
  muted: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  error: { color: colors.danger, fontSize: 17, lineHeight: 24 },
});

export function Button({
  label,
  onPress,
  variant = "primary",
  busy = false,
  disabled = false,
  hint,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  busy?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.button, primary ? styles.primary : styles.secondary, (pressed || disabled) && { opacity: 0.7 }]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? colors.accentText : colors.text} />
      ) : (
        <Text style={[styles.label, { color: primary ? colors.accentText : colors.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.accent, borderColor: colors.accent }]}
    >
      <Text style={[styles.chipLabel, selected && { color: colors.accentText }]}>{label}</Text>
    </Pressable>
  );
}

export function Notice({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" }) {
  const style: TextStyle = tone === "error" ? type.error : type.muted;
  return (
    <View accessibilityLiveRegion="polite" style={styles.notice}>
      <Text style={style}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 56, borderRadius: 14, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", marginTop: 12 },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 18, fontWeight: "700" },
  chip: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 8,
  },
  chipLabel: { color: colors.text, fontSize: 16, fontWeight: "600" },
  notice: { marginTop: 12 },
});
