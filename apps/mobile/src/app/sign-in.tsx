import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOnboarding } from "../onboarding/OnboardingProvider";
import { firebase, firebaseConfigured, sign_in_problem, test_mode_available } from "../auth/firebase";
import { Button, Notice, useTheme, useThemedStyles, type Palette } from "../ui/theme";

export default function SignIn() {
  const { type } = useTheme();
  const styles = useThemedStyles(create_styles);
  // After the tour, new people start on "Create account"; "I already have an account" starts on sign-in.
  const { values: tour } = useOnboarding();
  const [mode, set_mode] = useState<"sign-in" | "create">(tour.entry === "create" ? "create" : "sign-in");
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

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={type.title} accessibilityRole="header">
            Recipeak
          </Text>
          <Text style={[type.body, { marginTop: 8, marginBottom: 24 }]}>
            Snap a meal or a cocktail and get a recipe to make it yourself.
          </Text>
          {!firebaseConfigured && (
            <Notice tone="error">{"Sign-in isn't set up in this build yet. Add the Firebase settings to apps/mobile/.env."}</Notice>
          )}
          {test_mode_available && <Button label="Continue in test mode" onPress={() => firebase.start_test_mode()} />}
          {apple && (
            <ProviderButton
              icon="logo-apple"
              label="Continue with Apple"
              busy={provider_busy === "apple"}
              disabled={provider_busy !== null}
              onPress={() => void continue_with("apple")}
            />
          )}
          {firebase.google_available && (
            <ProviderButton
              icon="logo-google"
              label="Continue with Google"
              busy={provider_busy === "google"}
              disabled={provider_busy !== null}
              onPress={() => void continue_with("google")}
            />
          )}
          {(apple || firebase.google_available) && (
            <View style={styles.divider} accessible={false}>
              <View style={styles.rule} />
              <Text style={styles.or}>or use your email</Text>
              <View style={styles.rule} />
            </View>
          )}
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
          <Button label={mode === "create" ? "Create account" : "Sign in"} onPress={submit} busy={busy} disabled={!email || !password} />
          <Button
            variant="secondary"
            label={mode === "create" ? "I already have an account" : "Create a new account"}
            onPress={() => {
              set_mode(mode === "create" ? "sign-in" : "create");
              set_message(null);
            }}
          />
          {mode === "sign-in" && <Button variant="secondary" label="Forgot password" onPress={reset} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProviderButton(props: {
  icon: "logo-google" | "logo-apple";
  label: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(create_styles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: props.disabled, busy: props.busy }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [styles.provider, (pressed || props.busy) && { opacity: 0.7 }]}
    >
      <Ionicons name={props.icon} size={20} color={colors.text} />
      <Text style={styles.providerText}>{props.busy ? "Opening…" : props.label}</Text>
    </Pressable>
  );
}

const create_styles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 48 },
    provider: {
      minHeight: 54,
      marginTop: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    providerText: { color: colors.text, fontSize: 16, fontWeight: "600" },
    divider: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 24, marginBottom: 4 },
    rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    or: { color: colors.muted, fontSize: 14 },
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
