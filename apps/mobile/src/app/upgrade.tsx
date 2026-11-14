// Placeholder until the RevenueCat paywall (phase 3 in docs/PROJECT-PLAN.md).
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button, colors, type } from "../ui/theme";

export default function Upgrade() {
  return (
    <View style={styles.screen}>
      <Text style={type.title} accessibilityRole="header">
        {"You've used your free photos"}
      </Text>
      <Text style={[type.body, { marginTop: 12 }]}>
        Your 3 free photos are used up. A paid plan to keep finding recipes is coming soon. Your saved recipes are still here.
      </Text>
      <Button label="Back to my recipes" onPress={() => router.replace("/saved")} />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, padding: 24, backgroundColor: colors.background } });
