// The "Suggest a Feature" and "Report a Bug" forms, ported from Votic's FeedbackScreens.
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useApp } from "../AppContext";
import { ApiError } from "../api/client";
import { SettingsScreen } from "../settings/SettingsUI";
import { Button, type Palette, useTheme, useThemedStyles } from "../ui/theme";
import {
  EMPTY_FEEDBACK,
  FEEDBACK_FIELDS,
  FEEDBACK_TEXT,
  type FeedbackKind,
  type FeedbackValues,
  missing_fields_message,
  new_request_id,
} from "./feedback";

/** Back to the Feedback page the form was opened from (or to it, when there is nothing to go back to). */
function back_to_feedback() {
  if (router.canGoBack()) router.back();
  else router.replace({ pathname: "/settings/[category]", params: { category: "feedback" } });
}

export function FeedbackForm({ kind }: { kind: FeedbackKind }) {
  const { user } = useApp();
  // Keyed by account, so a draft or an answer can never cross from one account to another.
  return <AccountFeedbackForm key={`${user?.uid ?? "signed-out"}:${kind}`} kind={kind} />;
}

function AccountFeedbackForm({ kind }: { kind: FeedbackKind }) {
  const { api } = useApp();
  const { colors, type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const [values, set_values] = useState<FeedbackValues>(EMPTY_FEEDBACK);
  const [busy, set_busy] = useState(false);
  const [sent, set_sent] = useState(false);
  const [error, set_error] = useState("");
  // Required-field checks start at the first Submit, then follow the fields as they are corrected.
  const [validating, set_validating] = useState(false);
  const request_id = useRef(new_request_id());
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const text = FEEDBACK_TEXT[kind];
  const validation = validating ? missing_fields_message(values) : "";

  async function submit() {
    if (pending.current) return;
    set_validating(true);
    if (missing_fields_message(values)) return;
    pending.current = true;
    set_busy(true);
    set_error("");
    try {
      await api.send_feedback({ kind, title: values.title, description: values.description, request_id: request_id.current });
      if (mounted.current) set_sent(true);
    } catch (failure) {
      // The text stays in the form whatever went wrong, so the person can try again without retyping.
      if (mounted.current) set_error(failure instanceof ApiError ? failure.message : "Feedback could not be sent. Please try again.");
    } finally {
      pending.current = false;
      if (mounted.current) set_busy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <SettingsScreen title={text.title} back back_label="Feedback" on_back={back_to_feedback}>
        {sent ? (
          <View style={styles.fields}>
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={type.body}>
              {text.thanks}
            </Text>
            <Button label="Back to Feedback" onPress={back_to_feedback} />
          </View>
        ) : (
          <View style={styles.fields}>
            <Text style={type.muted}>
              Your feedback is private and goes only to the Recipeek team. Please don’t include passwords or payment details.
            </Text>
            {FEEDBACK_FIELDS.map((field) => (
              <View key={field.key} style={styles.field}>
                <Text style={styles.label}>{field.label}</Text>
                <TextInput
                  accessibilityLabel={field.label}
                  accessibilityHint={`Up to ${field.max} characters`}
                  value={values[field.key]}
                  maxLength={field.max}
                  editable={!busy}
                  multiline={field.key !== "title"}
                  textAlignVertical="top"
                  onChangeText={(value) => {
                    // Changed text is a new submission, so it gets a new reference.
                    request_id.current = new_request_id();
                    set_values((current) => ({ ...current, [field.key]: value }));
                  }}
                  placeholderTextColor={colors.muted}
                  style={[styles.input, field.key !== "title" && styles.multiline]}
                />
              </View>
            ))}
            {validation ? (
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={type.error}>
                {validation}
              </Text>
            ) : null}
            {error ? (
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={type.error}>
                {error}
              </Text>
            ) : null}
            <Button label="Submit" busy={busy} onPress={() => void submit()} />
          </View>
        )}
      </SettingsScreen>
    </KeyboardAvoidingView>
  );
}

const create_styles = (colors: Palette) =>
  StyleSheet.create({
    fill: { flex: 1, backgroundColor: colors.background },
    fields: { gap: 16 },
    field: { gap: 8 },
    label: { color: colors.text, fontSize: 16, fontWeight: "600" },
    input: {
      minHeight: 52,
      borderWidth: 1,
      borderRadius: 14,
      padding: 14,
      fontSize: 16,
      color: colors.text,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    multiline: { minHeight: 140 },
  });
