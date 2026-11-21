import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, Text } from "react-native";
import { useApp } from "../../AppContext";
import { CATEGORIES, type Category, Group, Row, SettingsScreen } from "../../settings/SettingsUI";
import { usePreferences } from "../../settings/PreferencesProvider";
import { DIET_CHOICES } from "../../onboarding/onboarding";
import { useOnboarding } from "../../onboarding/OnboardingProvider";
import { ACCENT_LABELS, APPEARANCE_LABELS } from "../../settings/SettingsDetails";
import { legal_page_urls, STORE_URL, SUPPORT_EMAIL, support_mail_url } from "../../settings/legalLinks";
import { Notice, useTheme } from "../../ui/theme";

/** "Recipeak 0.1.0", so people can tell support which version they have. */
export function version_line(version: string | null | undefined): string {
  return version ? `Recipeak ${version}` : "Recipeak";
}

export default function Settings() {
  const { type } = useTheme();
  const { user } = useApp();
  const { values, ready } = usePreferences();
  const { values: taste } = useOnboarding();
  const [link_problem, set_link_problem] = useState<string | null>(null);
  const mix = { cocktails: "Mostly cocktails", meals: "Mostly meals", both: "A bit of both" }[taste.interest];
  const eats =
    taste.diets.length === 0
      ? "Everything"
      : DIET_CHOICES.filter((c) => c.diet && taste.diets.includes(c.diet))
          .map((c) => c.label)
          .join(", ");
  const pages = legal_page_urls(process.env.EXPO_PUBLIC_API_BASE_URL);
  const open = (category: Category) => router.push({ pathname: "/settings/[category]", params: { category } });
  const open_link = (url: string) => {
    set_link_problem(null);
    Linking.openURL(url).catch(() => set_link_problem(`Couldn’t open that link. You can email ${SUPPORT_EMAIL}.`));
  };
  return (
    <SettingsScreen title="Settings">
      <Group title="YOUR ACCOUNT">
        <Row
          label={CATEGORIES.account}
          detail={user?.email ?? "Your signed-in account"}
          icon="person-outline"
          onPress={() => open("account")}
        />
        <Row label={CATEGORIES.usage} detail="Your plan, photos left and purchases" icon="sparkles-outline" onPress={() => open("usage")} />
      </Group>
      <Group title="PREFERENCES">
        <Row
          label={CATEGORIES.preferences}
          detail={
            ready ? `${APPEARANCE_LABELS[values.appearance].label} · ${ACCENT_LABELS[values.accent].label} buttons` : "Loading preferences…"
          }
          icon="color-palette-outline"
          onPress={() => open("preferences")}
        />
        <Row label={CATEGORIES.taste} detail={`${mix} · ${eats}`} icon="restaurant-outline" onPress={() => open("taste")} />
      </Group>
      <Group title="SUPPORT">
        <Row label={CATEGORIES.help} detail="How Recipeak works, and tips" icon="help-circle-outline" onPress={() => open("help")} />
        <Row
          label={CATEGORIES.feedback}
          detail="Suggest a feature or report a bug"
          icon="chatbubble-ellipses-outline"
          onPress={() => open("feedback")}
        />
        <Row
          label="Contact support"
          detail={SUPPORT_EMAIL}
          icon="mail-outline"
          trailing="open-outline"
          onPress={() => open_link(support_mail_url())}
        />
        {STORE_URL && (
          <Row
            label="Rate Recipeak"
            detail="Leave a review on Google Play"
            icon="star-outline"
            trailing="open-outline"
            onPress={() => open_link(STORE_URL as string)}
          />
        )}
      </Group>
      {pages && (
        <Group title="ABOUT">
          <Row
            label="Privacy policy"
            detail="What Recipeak keeps and why"
            icon="shield-checkmark-outline"
            trailing="open-outline"
            onPress={() => open_link(pages.privacy)}
          />
          <Row
            label="Terms of use"
            detail="The rules for using Recipeak"
            icon="document-text-outline"
            trailing="open-outline"
            onPress={() => open_link(pages.terms)}
          />
        </Group>
      )}
      {link_problem && <Notice tone="error">{link_problem}</Notice>}
      <Text style={[type.muted, { textAlign: "center" }]}>{`${version_line(Constants.expoConfig?.version)} · Made by Benjamin Major`}</Text>
    </SettingsScreen>
  );
}
