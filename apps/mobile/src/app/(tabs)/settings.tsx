import { router } from "expo-router";
import { Text } from "react-native";
import { useApp } from "../../AppContext";
import { CATEGORIES, type Category, Group, Row, SettingsScreen } from "../../settings/SettingsUI";
import { usePreferences } from "../../settings/PreferencesProvider";
import { DIET_CHOICES } from "../../onboarding/onboarding";
import { useOnboarding } from "../../onboarding/OnboardingProvider";
import { APPEARANCE_LABELS } from "../../settings/SettingsDetails";
import { useTheme } from "../../ui/theme";

export default function Settings() {
  const { type } = useTheme();
  const { user } = useApp();
  const { values, ready } = usePreferences();
  const { values: taste } = useOnboarding();
  const mix = { cocktails: "Mostly cocktails", meals: "Mostly meals", both: "A bit of both" }[taste.interest];
  const eats =
    taste.diets.length === 0
      ? "Everything"
      : DIET_CHOICES.filter((c) => c.diet && taste.diets.includes(c.diet))
          .map((c) => c.label)
          .join(", ");
  const open = (category: Category) => router.push({ pathname: "/settings/[category]", params: { category } });
  return (
    <SettingsScreen title="Settings">
      <Text style={type.muted}>Make Recipeak feel right for you.</Text>
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
        <Row label={CATEGORIES.taste} detail={`${mix} · ${eats}`} icon="restaurant-outline" onPress={() => open("taste")} />
      </Group>
      <Group title="LIBRARY & SUPPORT">
        <Row label={CATEGORIES.library} detail="Your account's saved recipes" icon="bookmark-outline" onPress={() => open("library")} />
        <Row
          label={CATEGORIES.feedback}
          detail="Suggest a feature or report a bug"
          icon="chatbubble-ellipses-outline"
          onPress={() => open("feedback")}
        />
        <Row label={CATEGORIES.help} detail="Getting started, photos, and data" icon="help-circle-outline" onPress={() => open("help")} />
      </Group>
    </SettingsScreen>
  );
}
