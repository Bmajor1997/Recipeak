// Large, high-contrast defaults, so the app is easy to read and every control is easy to hit.
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type TextStyle, View } from "react-native";

/** Serif display font for titles (Fraunces, loaded in the root layout). Body text stays in the phone's own font. */
export const fonts = { display: "Fraunces_600SemiBold", displayMedium: "Fraunces_500Medium" };

export const colors = {
  // "Black and grapefruit": near-black so food photos carry the colour; the accent is the grapefruit in the app icon.
  background: "#0F0F10",
  surface: "#1A1A1C",
  raised: "#26262A",
  scrim: "rgba(15, 15, 16, 0.92)",
  text: "#FFFFFF",
  muted: "#A9A9AD",
  accent: "#FF6F61", // grapefruit coral
  accentText: "#2B0A06",
  danger: "#FFB3AB",
  border: "#2E2E33",
};

export const type = StyleSheet.create({
  display: { color: colors.text, fontSize: 28, lineHeight: 34, fontFamily: fonts.display },
  title: { color: colors.text, fontSize: 24, lineHeight: 30, fontFamily: fonts.display },
  heading: { color: colors.text, fontSize: 20, lineHeight: 26, fontFamily: fonts.display, marginTop: 22, marginBottom: 8 },
  label: { color: colors.muted, fontSize: 12, fontWeight: "600", letterSpacing: 0.6 },
  body: { color: colors.text, fontSize: 16, lineHeight: 24 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 15, lineHeight: 22 },
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
  button: { minHeight: 52, borderRadius: 26, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", marginTop: 12 },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 16, fontWeight: "700" },
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
  chipLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
  notice: { marginTop: 12 },
});
