// Import only the two weights used, so the other 16 font files stay out of the app.
import { Fraunces_500Medium } from "@expo-google-fonts/fraunces/500Medium";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { AppProvider, useApp } from "../AppContext";
import { CameraProvider } from "../camera/CameraProvider";
import { colors } from "../ui/theme";
import { PreferencesProvider } from "../settings/PreferencesProvider";

function Screens() {
  const { user, ready } = useApp();
  // If the fonts fail to load, the app still works with the phone's own font.
  const [fontsLoaded, fontError] = useFonts({ Fraunces_500Medium, Fraunces_600SemiBold });
  if (!ready || (!fontsLoaded && !fontError)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} accessibilityLabel="Loading" />
      </View>
    );
  }
  const header = {
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text,
    contentStyle: { backgroundColor: colors.background },
  };
  return (
    <CameraProvider>
      <Stack screenOptions={header}>
        {/* People must be signed in before their first photo. */}
        <Stack.Protected guard={Boolean(user)}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* The recipe slides up from the bottom, like the camera. */}
          <Stack.Screen
            name="recipe"
            options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom", gestureEnabled: true }}
          />
          <Stack.Screen name="settings/[category]" options={{ headerShown: false }} />
          {/* The paywall draws its own close button. */}
          <Stack.Screen name="upgrade" options={{ headerShown: false, presentation: "modal" }} />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </CameraProvider>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <PreferencesProvider>
        <StatusBar style="light" />
        <Screens />
      </PreferencesProvider>
    </AppProvider>
  );
}
