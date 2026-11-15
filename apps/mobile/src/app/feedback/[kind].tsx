import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { is_feedback_kind } from "../../feedback/feedback";
import { FeedbackForm } from "../../feedback/FeedbackForm";
import { SettingsScreen } from "../../settings/SettingsUI";
import { useTheme } from "../../ui/theme";

export default function FeedbackFormScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const { type } = useTheme();
  return is_feedback_kind(kind) ? (
    <FeedbackForm kind={kind} />
  ) : (
    <SettingsScreen title="Feedback" back>
      <Text style={type.body}>This feedback page isn’t available. Go back to Settings and open Feedback.</Text>
    </SettingsScreen>
  );
}
