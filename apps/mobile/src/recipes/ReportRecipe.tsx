// "Report this recipe" at the bottom of the recipe screen: pick a reason, add details if you like, and send.
// The report goes privately to the Recipeak team's feedback dashboard (see feedback/recipeReport.ts).
import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useApp } from "../AppContext";
import { ApiError } from "../api/client";
import { new_request_id } from "../feedback/feedback";
import { MAX_REPORT_DETAILS, REPORT_REASONS, type ReportReason, report_text } from "../feedback/recipeReport";
import { Button, Notice, useTheme } from "../ui/theme";
import type { Kind } from "./types";

export function ReportRecipe({ kind, dish, diet }: { kind: Kind; dish: string; diet?: string | null }) {
  const { colors, type } = useTheme();
  const { api } = useApp();
  const [open, set_open] = useState(false);
  const [reason, set_reason] = useState<ReportReason | null>(null);
  const [details, set_details] = useState("");
  const [busy, set_busy] = useState(false);
  const [sent, set_sent] = useState(false);
  const [problem, set_problem] = useState<string | null>(null);
  // One reference per report, so a retry after a dropped connection is never saved twice.
  const request_id = useRef(new_request_id());

  if (sent) return <Notice>Thanks for telling us. The Recipeak team will review this recipe.</Notice>;

  if (!open)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Report this recipe"
        accessibilityHint="Tell the Recipeak team if this recipe is offensive, unsafe or wrong"
        onPress={() => set_open(true)}
        hitSlop={8}
        style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, alignSelf: "flex-start" }}
      >
        <Ionicons name="flag-outline" size={20} color={colors.muted} accessible={false} />
        <Text style={[type.body, { color: colors.muted, textDecorationLine: "underline" }]}>Report this recipe</Text>
      </Pressable>
    );

  function change(update: () => void) {
    update();
    set_problem(null);
    // Changed answers are a new report, so they get a new reference.
    request_id.current = new_request_id();
  }

  async function send() {
    if (busy) return;
    if (!reason) {
      set_problem("Choose why you're reporting this recipe.");
      return;
    }
    set_busy(true);
    set_problem(null);
    try {
      const { title, description } = report_text({ reason, dish, kind, diet, details });
      await api.send_feedback({ kind: "bug", title, description, request_id: request_id.current, report: reason });
      set_sent(true);
    } catch (failure) {
      // Their answers stay, so they can try again without starting over.
      set_problem(failure instanceof ApiError ? failure.message : "Your report couldn't be sent. Please try again.");
    } finally {
      set_busy(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Text style={type.heading} accessibilityRole="header">
        Report this recipe
      </Text>
      <Text style={type.muted}>Your report is private and goes only to the Recipeak team.</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Why are you reporting this recipe?" style={{ gap: 4 }}>
        {REPORT_REASONS.map((option) => {
          const checked = reason === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked }}
              onPress={() => change(() => set_reason(option.value))}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}
            >
              <Ionicons
                name={checked ? "radio-button-on" : "radio-button-off"}
                size={24}
                color={checked ? colors.accentInk : colors.muted}
                accessible={false}
              />
              <Text style={[type.body, { flex: 1 }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        accessibilityLabel="Details (optional)"
        accessibilityHint={`Up to ${MAX_REPORT_DETAILS} characters`}
        placeholder="Details (optional)"
        placeholderTextColor={colors.muted}
        value={details}
        maxLength={MAX_REPORT_DETAILS}
        editable={!busy}
        multiline
        textAlignVertical="top"
        onChangeText={(value) => change(() => set_details(value))}
        style={{
          minHeight: 100,
          borderWidth: 1,
          borderRadius: 14,
          padding: 14,
          fontSize: 16,
          color: colors.text,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      />
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <Button label="Send report" busy={busy} onPress={() => void send()} />
      <Button label="Cancel" variant="secondary" disabled={busy} onPress={() => set_open(false)} />
    </View>
  );
}
