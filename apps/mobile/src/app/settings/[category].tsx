import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { SettingsDetails } from "../../settings/SettingsDetails";
import { is_category, SettingsScreen } from "../../settings/SettingsUI";
import { type } from "../../ui/theme";

export default function SettingsCategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  return is_category(category) ? (
    <SettingsDetails category={category} />
  ) : (
    <SettingsScreen title="Settings" back>
      <Text style={type.body}>This settings page isn’t available. Return to Settings to choose a category.</Text>
    </SettingsScreen>
  );
}
