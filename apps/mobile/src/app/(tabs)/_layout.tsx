import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useCamera } from "../../camera/CameraProvider";
import { useTheme, useThemedStyles, type Palette } from "../../ui/theme";

/** The raised camera button in the exact middle of the tab bar (two tabs on each side): a dark button inside a citrus-colored ring. It opens the camera instead of a page. */
function CameraTabButton() {
  const { colors } = useTheme();
  const styles = useThemedStyles(create_styles);
  const { open_camera } = useCamera();
  return (
    <View style={styles.slot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Camera"
        accessibilityHint="Opens the camera to photograph a meal or a cocktail"
        onPress={open_camera}
        style={({ pressed }) => [styles.camera, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <LinearGradient colors={["#FF6F61", "#FFB347", "#FF3D6E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
          <View style={styles.inner}>
            <Ionicons name="camera" size={28} color={colors.accentInk} />
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
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
      <Tabs.Screen name="camera" options={{ title: "Camera", tabBarButton: () => <CameraTabButton /> }} />
      <Tabs.Screen
        name="saved"
        options={{ title: "Saved", tabBarIcon: ({ color }) => <Ionicons name="bookmark-outline" size={26} color={color as string} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={26} color={color as string} /> }}
      />
    </Tabs>
  );
}

const create_styles = (colors: Palette) =>
  StyleSheet.create({
    slot: { flex: 1, alignItems: "center" },
    camera: {
      width: 76,
      height: 76,
      borderRadius: 38,
      marginTop: -28,
      padding: 5,
      backgroundColor: colors.background,
    },
    ring: { flex: 1, borderRadius: 33, padding: 3 },
    inner: { flex: 1, borderRadius: 30, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  });
