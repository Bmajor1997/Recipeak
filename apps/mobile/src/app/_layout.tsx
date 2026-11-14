import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { AppProvider, useApp } from "../AppContext";
import { colors } from "../ui/theme";

function Screens() {
  const { user, ready } = useApp();
  if (!ready) {
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
    <Stack screenOptions={header}>
      {/* People must be signed in before their first photo. */}
      <Stack.Protected guard={Boolean(user)}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="recipe" options={{ title: "Recipe" }} />
        <Stack.Screen name="upgrade" options={{ title: "Keep cooking", presentation: "modal" }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="light" />
      <Screens />
    </AppProvider>
  );
}
