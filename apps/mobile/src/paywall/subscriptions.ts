// The app's one RevenueCat connection. Keys are RevenueCat's public SDK keys (EXPO_PUBLIC_…), never the secret key.
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { create_subscription_service } from "./subscriptionService";

const api_key =
  Platform.OS === "android"
    ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
    : Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
      : undefined;

export const subscriptions = create_subscription_service({
  api_key,
  entitlement_id: process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "premium",
  async load() {
    // Expo Go doesn't include RevenueCat's native code; the installed app (or a development build) does.
    if (Platform.OS === "web" || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
    try {
      return (await import("react-native-purchases")).default;
    } catch {
      return null;
    }
  },
});
