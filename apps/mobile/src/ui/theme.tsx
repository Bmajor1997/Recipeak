// Light and dark themes. Large, high-contrast defaults, so the app is easy to read and every control is easy to hit.
// Screens read the current colours with useTheme(), and build their styles with useThemedStyles(create_styles).
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type TextStyle, View } from "react-native";
import { DARK_COLORS, LIGHT_COLORS, type Palette, type Scheme } from "./palette";

/** Serif display font for titles (Fraunces, loaded in the root layout). Body text stays in the phone's own font. */
export const fonts = { display: "Fraunces_600SemiBold", displayMedium: "Fraunces_500Medium" };

export { DARK_COLORS, LIGHT_COLORS, type Palette, type Scheme };

export function create_type(colors: Palette) {
  return StyleSheet.create({
    display: { color: colors.text, fontSize: 28, lineHeight: 34, fontFamily: fonts.display },
    title: { color: colors.text, fontSize: 24, lineHeight: 30, fontFamily: fonts.display },
    heading: { color: colors.text, fontSize: 20, lineHeight: 26, fontFamily: fonts.display, marginTop: 22, marginBottom: 8 },
    label: { color: colors.muted, fontSize: 12, fontWeight: "600", letterSpacing: 0.6 },
    body: { color: colors.text, fontSize: 16, lineHeight: 24 },
    muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    error: { color: colors.danger, fontSize: 15, lineHeight: 22 },
  });
}

export type Theme = { scheme: Scheme; colors: Palette; type: ReturnType<typeof create_type> };

const DARK_THEME: Theme = { scheme: "dark", colors: DARK_COLORS, type: create_type(DARK_COLORS) };
const LIGHT_THEME: Theme = { scheme: "light", colors: LIGHT_COLORS, type: create_type(LIGHT_COLORS) };

/** The camera is always dark, like every phone camera, whatever the app's theme is. */
export const CAMERA_THEME = DARK_THEME;

export function theme_for(scheme: Scheme): Theme {
  return scheme === "light" ? LIGHT_THEME : DARK_THEME;
}

const ThemeContext = createContext<Theme>(DARK_THEME);

export function ThemeProvider({ scheme, children }: { scheme: Scheme; children: ReactNode }) {
  return <ThemeContext.Provider value={theme_for(scheme)}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Builds a screen's styles for the current theme, once per theme. Pass a function defined outside the component. */
export function useThemedStyles<T>(create_styles: (colors: Palette) => T): T {
  const { colors } = useTheme();
  return useMemo(() => create_styles(colors), [create_styles, colors]);
}

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
  const { colors } = useTheme();
  const styles = useThemedStyles(create_styles);
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
  const { colors } = useTheme();
  const styles = useThemedStyles(create_styles);
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
  const { type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const style: TextStyle = tone === "error" ? type.error : type.muted;
  return (
    <View accessibilityLiveRegion="polite" style={styles.notice}>
      <Text style={style}>{children}</Text>
    </View>
  );
}

const create_styles = (colors: Palette) =>
  StyleSheet.create({
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
