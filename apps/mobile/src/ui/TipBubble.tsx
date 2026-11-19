import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme, useThemedStyles, type Palette } from "./theme";

/**
 * A one-time tip: a small bubble with an arrow pointing at the feature it explains, and a button to dismiss it.
 * Screen readers announce it when it appears.
 */
export function TipBubble({
  text,
  arrow,
  arrow_at = "center",
  on_dismiss,
  style,
}: {
  text: string;
  arrow: "up" | "down";
  arrow_at?: "left" | "center" | "right";
  on_dismiss: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(create_styles);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`Tip: ${text}`);
  }, [text]);
  const point = (
    <View
      style={[styles.arrow, arrow === "up" ? styles.arrowUp : styles.arrowDown, styles[arrow_at]]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
  return (
    <View style={style} accessibilityLiveRegion="polite">
      {arrow === "up" && point}
      <View style={styles.bubble}>
        <Ionicons name="bulb-outline" size={20} color={colors.accentText} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={styles.text}>{text}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss tip"
          onPress={on_dismiss}
          hitSlop={8}
          style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="close" size={20} color={colors.accentText} />
        </Pressable>
      </View>
      {arrow === "down" && point}
    </View>
  );
}

const create_styles = (colors: Palette) =>
  StyleSheet.create({
    bubble: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingLeft: 14,
      paddingVertical: 6,
      paddingRight: 4,
    },
    text: { flex: 1, color: colors.accentText, fontSize: 16, fontWeight: "600", lineHeight: 22, paddingVertical: 6 },
    close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    arrow: { width: 14, height: 14, backgroundColor: colors.accent, transform: [{ rotate: "45deg" }] },
    arrowUp: { marginBottom: -7 },
    arrowDown: { marginTop: -7 },
    left: { alignSelf: "flex-start", marginLeft: 24 },
    center: { alignSelf: "center" },
    right: { alignSelf: "flex-end", marginRight: 22 },
  });
