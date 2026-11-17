// Import only the two weights used, so the other 16 font files stay out of the app.
import { Fraunces_500Medium } from "@expo-google-fonts/fraunces/500Medium";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { type ReactNode, useEffect } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { AppProvider, useApp } from "../AppContext";
import { CameraProvider } from "../camera/CameraProvider";
import { OnboardingTour } from "../onboarding/OnboardingTour";
import { OnboardingProvider, useOnboarding } from "../onboarding/OnboardingProvider";
import { PreferencesProvider, usePreferences } from "../settings/PreferencesProvider";
import { theme_for, ThemeProvider, useTheme } from "../ui/theme";

/** Light or dark: the person's choice in Settings, or the phone's own setting ("Match phone", the default). */
function Themed({ children }: { children: ReactNode }) {
  const phone = useColorScheme();
  const { values } = usePreferences();
  const scheme = values.appearance === "system" ? (phone === "light" ? "light" : "dark") : values.appearance;
  const background = theme_for(scheme).colors.background;
  // The window behind the app matches, so there's no flash of the wrong colour when screens change.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(background).catch(() => {});
  }, [background]);
  return (
    <ThemeProvider scheme={scheme}>
      <StatusBar style={scheme === "light" ? "dark" : "light"} />
      {children}
    </ThemeProvider>
  );
}

function Screens() {
  const { user, ready } = useApp();
  const onboarding = useOnboarding();
  const toured = onboarding.values.done;
  const { colors } = useTheme();
  // If the fonts fail to load, the app still works with the phone's own font.
  const [fontsLoaded, fontError] = useFonts({ Fraunces_500Medium, Fraunces_600SemiBold });
  if (!ready || !onboarding.loaded || (!fontsLoaded && !fontError)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.accentInk} accessibilityLabel="Loading" />
      </View>
    );
  }
  // The first-launch tour stands in for the whole app until it's finished, so the app never opens on another screen.
  if (!toured) return <OnboardingTour />;
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
          <Stack.Screen name="cook" options={{ title: "Cooking mode" }} />
          <Stack.Screen name="settings/[category]" options={{ headerShown: false }} />
          <Stack.Screen name="feedback/[kind]" options={{ headerShown: false }} />
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
      <OnboardingProvider>
        <PreferencesProvider>
          <Themed>
            <Screens />
          </Themed>
        </PreferencesProvider>
      </OnboardingProvider>
    </AppProvider>
  );
}
