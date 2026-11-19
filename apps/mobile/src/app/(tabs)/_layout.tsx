import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCamera } from "../../camera/CameraProvider";
import { useTips } from "../../tips/TipsProvider";
import { TipBubble } from "../../ui/TipBubble";
import { useTheme, useThemedStyles, type Palette } from "../../ui/theme";

/**
 * The camera button: a wide "Snap" pill built into the middle of the tab bar (two tabs on each side).
 * It sits inside the bar, so it never covers a recipe, and it opens the camera instead of a page.
 */
function SnapTabButton() {
  const { colors } = useTheme();
  const styles = useThemedStyles(create_styles);
  const { open_camera } = useCamera();
  const tips = useTips();
  return (
    <View style={styles.slot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Snap"
        accessibilityHint="Opens the camera to photograph a meal or a cocktail"
        onPress={() => {
          tips.mark_seen("snap");
          open_camera();
        }}
        hitSlop={6}
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }]}
      >
        <Ionicons name="camera" size={22} color={colors.accentText} />
        <Text style={styles.label} maxFontSizeMultiplier={1.4}>
          Snap
        </Text>
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 78, paddingTop: 6 },
          tabBarActiveTintColor: colors.accentInk,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: "Home", tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={26} color={color as string} /> }}
        />
        <Tabs.Screen
          name="explore"
          options={{ title: "Explore", tabBarIcon: ({ color }) => <Ionicons name="compass-outline" size={26} color={color as string} /> }}
        />
        <Tabs.Screen name="camera" options={{ title: "Camera", tabBarButton: () => <SnapTabButton /> }} />
        <Tabs.Screen
          name="saved"
          options={{ title: "Saved", tabBarIcon: ({ color }) => <Ionicons name="bookmark-outline" size={26} color={color as string} /> }}
        />
        <Tabs.Screen
          name="settings"
          options={{ title: "Settings", tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={26} color={color as string} /> }}
        />
      </Tabs>
      <SnapTip />
    </View>
  );
}

/** The one-time tip above the Snap button, after the photo-wall tip. The tab bar is 78 high, safe area included. */
function SnapTip() {
  const tips = useTips();
  if (!tips.is_due("snap")) return null;
  return (
    <View style={{ position: "absolute", left: 16, right: 16, bottom: 78 }} pointerEvents="box-none">
      <TipBubble text="Snap a meal or drink to get its recipe." arrow="down" on_dismiss={() => tips.mark_seen("snap")} />
    </View>
  );
}

const create_styles = (colors: Palette) =>
  StyleSheet.create({
    slot: { flex: 1.5, alignItems: "center", justifyContent: "flex-start", paddingTop: 2 },
    pill: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      borderRadius: 22,
      backgroundColor: colors.accent,
    },
    label: { color: colors.accentText, fontSize: 16, fontWeight: "700" },
  });
