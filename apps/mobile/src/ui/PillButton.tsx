// The rounded pill buttons on the start screen (Mindvalley-style, approved 2026-11-21): "filled" is white in dark mode
// and near-black in light mode (Google asks for a white or black button), "accent" is Recipeak's coral, and "outline"
// is the quieter choice.
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useThemedStyles, type Palette } from "./theme";

export function PillButton(props: {
  label: string;
  variant: "filled" | "accent" | "outline";
  icon?: ReactNode;
  disabled?: boolean;
  hint?: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(create_styles);
  const filled = props.variant === "filled";
  const accent = props.variant === "accent";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityHint={props.hint}
      accessibilityState={{ disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.pill,
        filled ? styles.pillFilled : accent ? styles.pillAccent : styles.pillOutline,
        (pressed || props.disabled) && { opacity: props.disabled ? 0.5 : 0.8 },
      ]}
    >
      {props.icon}
      <Text style={[styles.pillText, filled && styles.pillTextFilled, accent && styles.pillTextAccent]}>{props.label}</Text>
    </Pressable>
  );
}

const create_styles = (colors: Palette) =>
  StyleSheet.create({
    pill: {
      minHeight: 54,
      marginTop: 12,
      borderRadius: 27,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingHorizontal: 20,
    },
    pillFilled: { backgroundColor: colors.text },
    pillAccent: { backgroundColor: colors.accent },
    pillTextAccent: { color: colors.accentText },
    pillOutline: { borderWidth: 1.5, borderColor: colors.text },
    pillText: { color: colors.text, fontSize: 16, fontWeight: "600" },
    pillTextFilled: { color: colors.background },
  });
