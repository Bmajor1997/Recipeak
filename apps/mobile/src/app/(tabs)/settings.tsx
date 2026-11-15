import { router } from "expo-router";
import { Text } from "react-native";
import { useApp } from "../../AppContext";
import { CATEGORIES, type Category, Group, Row, SettingsScreen } from "../../settings/SettingsUI";
import { usePreferences } from "../../settings/PreferencesProvider";
import { APPEARANCE_LABELS } from "../../settings/SettingsDetails";
import { useTheme } from "../../ui/theme";

export default function Settings() {
  const { type } = useTheme();
  const { user } = useApp();
  const { values, ready } = usePreferences();
  const open = (category: Category) => router.push({ pathname: "/settings/[category]", params: { category } });
  return (
    <SettingsScreen title="Settings">
      <Text style={type.muted}>Make Meals &amp; Mixers feel right for you.</Text>
      <Group title="YOUR ACCOUNT">
        <Row
          label={CATEGORIES.account}
          detail={user?.email ?? "Your signed-in account"}
          icon="person-outline"
          onPress={() => open("account")}
        />
        <Row label={CATEGORIES.usage} detail="Free photos and your current access" icon="sparkles-outline" onPress={() => open("usage")} />
      </Group>
      <Group title="YOUR PREFERENCES">
        <Row
          label={CATEGORIES.preferences}
          detail={
            !ready
              ? "Loading preferences…"
              : `${APPEARANCE_LABELS[values.appearance].label} · ${values.pausePhotoWall ? "Photo wall paused" : "Photo wall motion"} · ${values.saveCoverPhotos ? "Offline covers on" : "Text-only saves"}`
          }
          icon="options-outline"
          onPress={() => open("preferences")}
        />
      </Group>
      <Group title="LIBRARY & SUPPORT">
        <Row label={CATEGORIES.library} detail="Your account's saved recipes" icon="bookmark-outline" onPress={() => open("library")} />
        <Row label={CATEGORIES.help} detail="Getting started, photos, and data" icon="help-circle-outline" onPress={() => open("help")} />
      </Group>
    </SettingsScreen>
  );
}
