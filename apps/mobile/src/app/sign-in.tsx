import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { firebase, firebaseConfigured, sign_in_problem, test_mode_available } from "../auth/firebase";
import { Notice, useTheme, useThemedStyles, type Palette } from "../ui/theme";

// Google's own four-colour "G", as its sign-in branding guidelines ask for.
const GOOGLE_G = require("../../assets/google-g.png");

/**
 * Sign-in, styled after Mindvalley's (2026-11-21): three rounded pill buttons — Continue with Google, Log in and
 * Create an account — then an email form for the last two. Sign in with Apple joins them on iPhone.
 */
export default function SignIn() {
  const { type, colors } = useTheme();
  const styles = useThemedStyles(create_styles);
  // The three choices first; Log in and Create an account open the email form.
  const [step, set_step] = useState<"choose" | "sign-in" | "create">("choose");
  const mode = step === "create" ? "create" : "sign-in";
  const [email, set_email] = useState("");
  const [password, set_password] = useState("");
  const [busy, set_busy] = useState(false);
  const [message, set_message] = useState<{ text: string; tone: "muted" | "error" } | null>(null);
  const [provider_busy, set_provider_busy] = useState<"google" | "apple" | null>(null);
  const [apple, set_apple] = useState(false);
  useEffect(() => {
    void firebase.apple_available().then(set_apple);
  }, []);

  // Google and Apple create the account the first time and sign in after that, so they work in both modes.
  async function continue_with(provider: "google" | "apple") {
    set_provider_busy(provider);
    set_message(null);
    try {
      if (provider === "google") await firebase.sign_in_with_google();
      else await firebase.sign_in_with_apple();
    } catch (error) {
      const text = sign_in_problem(error);
      if (text) set_message({ text, tone: "error" });
    } finally {
      set_provider_busy(null);
    }
  }

  async function submit() {
    if (mode === "create" && password.length < 8) return set_message({ text: "Use a password with at least 8 characters.", tone: "error" });
    set_busy(true);
    set_message(null);
    try {
      if (mode === "create") await firebase.create_account(email, password);
      else await firebase.sign_in(email, password);
    } catch (error) {
      set_message({ text: sign_in_problem(error), tone: "error" });
    } finally {
      set_busy(false);
    }
  }

  async function reset() {
    if (!email.trim()) return set_message({ text: "Enter your email first, then tap Forgot password.", tone: "error" });
    try {
      await firebase.reset_password(email);
    } catch {
      // Same message either way, so this screen can't be used to find out who has an account.
    }
    set_message({ text: "If there's an account for that email, a reset link is on its way.", tone: "muted" });
  }

  const open_form = (next: "sign-in" | "create") => {
    set_step(next);
    set_message(null);
  };

  if (step === "choose")
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.chooseContent}>
          <View style={styles.intro}>
            <Text style={type.title} accessibilityRole="header">
              Recipeak
            </Text>
            <Text style={[type.body, { marginTop: 8 }]}>Snap a meal or a cocktail and get a recipe to make it yourself.</Text>
          </View>
          {!firebaseConfigured && (
            <Notice tone="error">{"Sign-in isn't set up in this build yet. Add the Firebase settings to apps/mobile/.env."}</Notice>
          )}
          {test_mode_available && <PillButton label="Continue in test mode" variant="outline" onPress={() => firebase.start_test_mode()} />}
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          {Platform.OS !== "web" && (
            <PillButton
              label={provider_busy === "google" ? "Opening…" : "Continue with Google"}
              variant="filled"
              icon={<Image source={GOOGLE_G} style={styles.googleG} accessible={false} />}
              disabled={provider_busy !== null}
              onPress={() => void continue_with("google")}
            />
          )}
          {apple && (
            <PillButton
              label={provider_busy === "apple" ? "Opening…" : "Continue with Apple"}
              variant="outline"
              icon={<Ionicons name="logo-apple" size={20} color={colors.text} />}
              disabled={provider_busy !== null}
              onPress={() => void continue_with("apple")}
            />
          )}
          <PillButton label="Log in" variant="outline" disabled={provider_busy !== null} onPress={() => open_form("sign-in")} />
          <Text style={styles.newHere}>New to Recipeak?</Text>
          <PillButton label="Create an account" variant="outline" disabled={provider_busy !== null} onPress={() => open_form("create")} />
        </ScrollView>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            onPress={() => {
              set_step("choose");
              set_message(null);
            }}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={type.title} accessibilityRole="header">
            {mode === "create" ? "Create your account" : "Log in"}
          </Text>
          <Text style={[type.muted, { marginTop: 6 }]}>
            {mode === "create" ? "Use your email and a password with at least 8 characters." : "Log in to your Recipeak account."}
          </Text>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={set_email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            accessibilityLabel="Email"
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={set_password}
            secureTextEntry
            autoComplete={mode === "create" ? "new-password" : "current-password"}
            textContentType={mode === "create" ? "newPassword" : "password"}
            accessibilityLabel="Password"
            onSubmitEditing={submit}
          />
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <PillButton
            label={busy ? "One moment…" : mode === "create" ? "Create account" : "Log in"}
            variant="filled"
            disabled={busy || !email || !password}
            onPress={() => void submit()}
          />
          {mode === "sign-in" && (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void reset()} style={styles.textLink}>
              <Text style={styles.linkMuted}>
                Forgot password? <Text style={styles.linkStrong}>Reset it</Text>
              </Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mode === "create" ? "Log in instead" : "Create an account instead"}
            hitSlop={8}
            onPress={() => open_form(mode === "create" ? "sign-in" : "create")}
            style={styles.textLink}
          >
            <Text style={styles.linkMuted}>
              {mode === "create" ? "Already have an account? " : "New to Recipeak? "}
              <Text style={styles.linkStrong}>{mode === "create" ? "Log in" : "Create an account"}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Mindvalley's rounded buttons: "filled" is the main action (white in dark mode, near-black in light mode, so it
 * always stands out), "outline" is the quieter choice.
 */
function PillButton(props: {
  label: string;
  variant: "filled" | "outline";
  icon?: React.ReactNode;
  disabled?: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(create_styles);
  const filled = props.variant === "filled";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.pill,
        filled ? styles.pillFilled : styles.pillOutline,
        (pressed || props.disabled) && { opacity: props.disabled ? 0.5 : 0.8 },
      ]}
    >
      {props.icon}
      <Text style={[styles.pillText, filled && styles.pillTextFilled]}>{props.label}</Text>
    </Pressable>
  );
}

const create_styles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 16 },
    chooseContent: { flexGrow: 1, padding: 24, paddingTop: 48, justifyContent: "flex-end", gap: 4 },
    intro: { flex: 1, justifyContent: "center", paddingBottom: 24 },
    back: { width: 44, height: 44, justifyContent: "center", marginBottom: 8, marginLeft: -6 },
    pill: {
      minHeight: 54,
      marginTop: 12,
      borderRadius: 27,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingHorizontal: 20,
    },
    pillFilled: { backgroundColor: colors.text },
    pillOutline: { borderWidth: 1.5, borderColor: colors.text },
    pillText: { color: colors.text, fontSize: 16, fontWeight: "600" },
    pillTextFilled: { color: colors.background },
    googleG: { width: 20, height: 20 },
    newHere: { color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 20 },
    textLink: { alignSelf: "center", marginTop: 18, minHeight: 32, justifyContent: "center" },
    linkMuted: { color: colors.muted, fontSize: 15 },
    linkStrong: { color: colors.text, fontWeight: "600" },
    label: { color: colors.text, fontSize: 15, fontWeight: "600", marginTop: 16, marginBottom: 6 },
    input: {
      minHeight: 54,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: 16,
      paddingHorizontal: 14,
    },
  });
