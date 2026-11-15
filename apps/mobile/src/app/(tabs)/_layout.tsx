import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useCamera } from "../../camera/CameraProvider";
import { colors } from "../../ui/theme";

/** The raised orange camera button in the middle of the tab bar. It opens the camera instead of a page. */
function CameraTabButton() {
  const { openCamera } = useCamera();
  return (
    <View style={styles.slot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Camera"
        accessibilityHint="Opens the camera to photograph a meal or a cocktail"
        onPress={openCamera}
        style={({ pressed }) => [styles.camera, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <Ionicons name="camera" size={30} color={colors.accentText} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 78, paddingTop: 6 },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 14, fontWeight: "600" },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={26} color={color as string} /> }}
      />
      <Tabs.Screen name="camera" options={{ title: "Camera", tabBarButton: () => <CameraTabButton /> }} />
      <Tabs.Screen
        name="saved"
        options={{ title: "Saved", tabBarIcon: ({ color }) => <Ionicons name="bookmark-outline" size={26} color={color as string} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, alignItems: "center" },
  camera: {
    width: 68,
    height: 68,
    borderRadius: 34,
    marginTop: -26,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: colors.background,
  },
});
