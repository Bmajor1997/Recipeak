// Large, high-contrast defaults, so the app is easy to read and every control is easy to hit.
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type TextStyle, View } from "react-native";

/** Serif display font for titles (Fraunces, loaded in the root layout). Body text stays in the phone's own font. */
export const fonts = { display: "Fraunces_600SemiBold", displayMedium: "Fraunces_500Medium" };

export const colors = {
  background: "#0B2328", // deep teal, from the app icon
  surface: "#12323A",
  raised: "#1A4049",
  scrim: "rgba(5, 18, 21, 0.92)",
  text: "#FFFFFF",
  muted: "#C9DADD",
  accent: "#FF7A45", // grapefruit orange
  accentText: "#1A0E08",
  danger: "#FFB4A6",
  border: "#2E5560",
};

export const type = StyleSheet.create({
  display: { color: colors.text, fontSize: 34, lineHeight: 40, fontFamily: fonts.display },
  title: { color: colors.text, fontSize: 28, lineHeight: 34, fontFamily: fonts.display },
  heading: { color: colors.text, fontSize: 22, lineHeight: 28, fontFamily: fonts.display, marginTop: 24, marginBottom: 10 },
  label: { color: colors.muted, fontSize: 14, fontWeight: "600", letterSpacing: 0.4 },
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
