import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { firebase, firebaseConfigured, signInProblem } from "../auth/firebase";
import { Button, colors, Notice, type } from "../ui/theme";

export default function SignIn() {
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "muted" | "error" } | null>(null);

  async function submit() {
    if (mode === "create" && password.length < 8) return setMessage({ text: "Use a password with at least 8 characters.", tone: "error" });
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "create") await firebase.createAccount(email, password);
      else await firebase.signIn(email, password);
    } catch (error) {
      setMessage({ text: signInProblem(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!email.trim()) return setMessage({ text: "Enter your email first, then tap Forgot password.", tone: "error" });
    try {
      await firebase.resetPassword(email);
    } catch {
      // Same message either way, so this screen can't be used to find out who has an account.
    }
    setMessage({ text: "If there's an account for that email, a reset link is on its way.", tone: "muted" });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={type.title} accessibilityRole="header">
            Meals and Mixers
          </Text>
          <Text style={[type.body, { marginTop: 8, marginBottom: 24 }]}>
            Snap a meal or a cocktail and get a recipe to make it yourself.
          </Text>
          {!firebaseConfigured && (
            <Notice tone="error">{"Sign-in isn't set up in this build yet. Add the Firebase settings to apps/mobile/.env."}</Notice>
          )}
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
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
            onChangeText={setPassword}
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
              setMode(mode === "create" ? "sign-in" : "create");
              setMessage(null);
            }}
          />
          {mode === "sign-in" && <Button variant="secondary" label="Forgot password" onPress={reset} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 48 },
  label: { color: colors.text, fontSize: 17, fontWeight: "600", marginTop: 16, marginBottom: 6 },
  input: {
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 18,
    paddingHorizontal: 14,
  },
});
