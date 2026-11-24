import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../AppContext";
import { clear_account_device_data, delete_account, delete_account_problem } from "../auth/deleteAccount";
import { confirm_method } from "../auth/confirmMethod";
import { firebase } from "../auth/firebase";
import { remove_photo } from "../saved/photoStore";
import { FREE_SAVED_RECIPES } from "../paywall/plans";
import type { Allowance } from "../recipes/types";
import { Button, Notice, useTheme, useThemedStyles, type Palette } from "../ui/theme";
import { FEEDBACK_KINDS, FEEDBACK_TEXT, type FeedbackKind } from "../feedback/feedback";
import { DietPicker, InterestPicker } from "../onboarding/Choices";
import { toggle_diet } from "../onboarding/onboarding";
import { useOnboarding } from "../onboarding/OnboardingProvider";
import { manage_subscription_url } from "./legalLinks";
import { subscriptions } from "../paywall/subscriptions";
import { usePreferences } from "./PreferencesProvider";
import { useTips } from "../tips/TipsProvider";
import { APPEARANCES, type Appearance } from "./preferences";
import { ACCENT_COLORS, type AccentColor, palette_for } from "../ui/palette";
import { CATEGORIES, type Category, Group, Row, SettingsScreen } from "./SettingsUI";

/** How this account signs in, for the account card. */
export function signed_in_with(providers: string[] | undefined): string {
  if (providers?.includes("google.com")) return "Signed in with Google";
  if (providers?.includes("apple.com")) return "Signed in with Apple";
  return "Signed in with email";
}

/** "2 of 3 photos left" for free accounts. */
export function photos_left_line(plan: Allowance): string {
  const left = plan.free_photos_left ?? 0;
  return `${left} of ${plan.free_photos_total} photo${plan.free_photos_total === 1 ? "" : "s"} left`;
}

export function SettingsDetails({ category }: { category: Category }) {
  return (
    <SettingsScreen title={CATEGORIES[category]} back>
      {category === "account" ? (
        <Account />
      ) : category === "preferences" ? (
        <Preferences />
      ) : category === "taste" ? (
        <Taste />
      ) : category === "usage" ? (
        <Usage />
      ) : category === "feedback" ? (
        <Feedback />
      ) : (
        <Help />
      )}
    </SettingsScreen>
  );
}

/** The answers from the first-launch tour: what Home shows more of, and which diet recipes open in. */
function Taste() {
  const { type } = useTheme();
  const { values, update } = useOnboarding();
  return (
    <>
      <Text style={type.muted}>Changes are saved on this phone right away.</Text>
      <Group title="WHAT ARE YOU HERE FOR?">
        <View style={{ padding: 12 }}>
          <InterestPicker value={values.interest} onChange={(interest) => update({ interest })} />
        </View>
      </Group>
      <Text style={type.muted}>{"You'll still see both. This only changes the mix on Home."}</Text>
      <Group title="HOW DO YOU EAT?">
        <View style={{ padding: 12 }}>
          <DietPicker value={values.diets} onToggle={(choice) => update({ diets: toggle_diet(values.diets, choice) })} />
        </View>
      </Group>
      <Text style={type.muted}>
        Vegetarian and vegan versions of the dishes on Home and Explore open on their own. For other diets, tap the diet under &quot;Make
        it…&quot; on a recipe.
      </Text>
    </>
  );
}

const FEEDBACK_ICONS: Record<FeedbackKind, "bulb-outline" | "bug-outline"> = { feature: "bulb-outline", bug: "bug-outline" };

/** Ported from Votic: two private forms, one for ideas and one for problems. */
function Feedback() {
  const { type } = useTheme();
  return (
    <>
      <Text style={type.muted}>Tell us what would make Recipeak better, or what went wrong. Only the Recipeak team sees it.</Text>
      <Group title="SEND US FEEDBACK">
        {FEEDBACK_KINDS.map((kind) => (
          <Row
            key={kind}
            label={FEEDBACK_TEXT[kind].title}
            detail={FEEDBACK_TEXT[kind].detail}
            icon={FEEDBACK_ICONS[kind]}
            onPress={() => router.push({ pathname: "/feedback/[kind]", params: { kind } })}
          />
        ))}
      </Group>
    </>
  );
}

function Account() {
  const { type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const { user, api, set_current } = useApp();
  const onboarding = useOnboarding();
  const [confirm, set_confirm] = useState(false);
  const [deleting, set_deleting] = useState(false);
  const [password, set_password] = useState("");
  const [delete_error, set_delete_error] = useState<string | null>(null);
  // Accounts made with Google or Apple have no password, so they confirm with that account instead.
  const method = confirm_method(user);
  // The plan line in the account card. Left out quietly if it can't load; Photo allowance shows the details.
  const [plan, set_plan] = useState<Allowance | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      api.allowance().then(
        (value) => live && set_plan(value),
        () => live && set_plan(null),
      );
      return () => {
        live = false;
      };
    }, [api]),
  );
  const [busy, set_busy] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [notice, set_notice] = useState<string | null>(null);
  const pending = useRef(false);
  const insets = useSafeAreaInsets();
  async function run(action: "reset" | "sign-out") {
    if (pending.current) return;
    pending.current = true;
    set_busy(true);
    set_error(null);
    set_notice(null);
    try {
      if (action === "reset") {
        if (!user?.email) throw new Error("No email");
        await firebase.reset_password(user.email);
        set_notice("Password reset requested. Check your email for the next steps.");
      } else {
        // The recipe on screen is closed first, so nothing of this account shows while the start screen opens.
        set_current(null);
        // Someone who signed out has an account, so the start screen offers Log in first.
        onboarding.update({ entry: "sign-in" });
        await firebase.sign_out();
        set_confirm(false);
      }
    } catch {
      set_error(
        action === "reset"
          ? "Couldn’t request a password reset. Check your connection and try again."
          : "Couldn’t sign out. Check your connection and try again.",
      );
    } finally {
      pending.current = false;
      set_busy(false);
    }
  }
  async function run_delete() {
    const uid = user?.uid;
    if (pending.current || !uid) return;
    pending.current = true;
    set_busy(true);
    set_delete_error(null);
    try {
      await delete_account({
        confirm: async () => {
          if (method !== "password") return firebase.confirm_with_provider(method);
          if (!password) throw new Error("Enter your password to delete your account.");
          await firebase.confirm_password(password);
        },
        delete_server_data: () => api.delete_account(uid),
        delete_sign_in: () => firebase.delete_sign_in(),
        clear_device: () => clear_account_device_data(AsyncStorage, uid, remove_photo),
      });
      set_password("");
      set_current(null);
      set_deleting(false);
    } catch (problem) {
      set_delete_error(delete_account_problem(problem));
    } finally {
      pending.current = false;
      set_busy(false);
    }
  }
  return (
    <>
      <View style={styles.accountCard}>
        <View style={styles.avatar} accessible={false}>
          <Text style={styles.avatarText}>{(user?.email ?? "R").slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.accountEmail}>{user?.email ?? "Signed-in account"}</Text>
          <Text style={type.muted}>{signed_in_with(user?.providers)}</Text>
          {plan && (
            <View style={styles.planLine}>
              <Text style={type.muted}>{plan.premium ? "Premium" : `Free · ${photos_left_line(plan)}`}</Text>
              {!plan.premium && (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="See Premium"
                  hitSlop={10}
                  onPress={() => router.push({ pathname: "/upgrade", params: { reason: "intro" } })}
                >
                  <Text style={styles.planLink}>See Premium</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
      {!confirm && error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}
      {method === "password" && (
        <Group>
          <Row
            label="Change password"
            detail="We’ll email you a link to set a new one"
            icon="lock-closed-outline"
            onPress={() => {
              if (!busy && user?.email) void run("reset");
            }}
          />
        </Group>
      )}
      <Group>
        <Row
          label="Sign out"
          detail="Your saved recipes stay with your account"
          icon="log-out-outline"
          onPress={() => {
            if (busy) return;
            set_error(null);
            set_confirm(true);
          }}
        />
      </Group>
      <Modal
        visible={confirm}
        transparent
        animationType="none"
        onRequestClose={() => {
          if (!busy) set_confirm(false);
        }}
      >
        <View style={[styles.overlay, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          <ScrollView accessibilityViewIsModal contentContainerStyle={styles.dialog}>
            <Text accessibilityRole="header" style={type.title}>
              Sign out?
            </Text>
            <Text style={type.body}>
              Your saved recipes stay with your account on this device. Nobody else who signs in here can see them, and they’re back when
              you sign in again. Signing out does not delete your account.
            </Text>
            {error && <Notice tone="error">{error}</Notice>}
            <Button label="Cancel" variant="secondary" disabled={busy} onPress={() => set_confirm(false)} />
            <Button label="Confirm sign out" busy={busy} onPress={() => void run("sign-out")} />
          </ScrollView>
        </View>
      </Modal>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete account"
        accessibilityHint="Permanently removes your account and saved recipes"
        disabled={busy}
        onPress={() => {
          set_delete_error(null);
          set_password("");
          set_deleting(true);
        }}
        style={({ pressed }) => [styles.deleteLink, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.deleteText}>Delete account</Text>
        <Text style={[type.muted, { textAlign: "center" }]}>Permanently removes your account and saved recipes</Text>
      </Pressable>
      <Modal
        visible={deleting}
        transparent
        animationType="none"
        onRequestClose={() => {
          if (!busy) set_deleting(false);
        }}
      >
        <View style={[styles.overlay, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          <ScrollView accessibilityViewIsModal keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dialog}>
            <Text accessibilityRole="header" style={type.title}>
              Delete your account?
            </Text>
            <Text style={type.body}>
              This can’t be undone. It deletes your sign-in, the feedback and ratings you sent, and your saved recipes, photos and settings
              on this phone.
            </Text>
            <Text style={type.body}>
              Deleting your account doesn’t cancel a Premium subscription. Cancel it first in your App Store or Google Play subscriptions.
            </Text>
            {method === "password" ? (
              <>
                <Text style={type.label}>PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={set_password}
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                  accessibilityLabel="Password"
                  accessibilityHint="Enter your password to confirm"
                  editable={!busy}
                />
              </>
            ) : (
              <Text style={type.body}>
                {`To confirm, choose your ${method === "google" ? "Google" : "Apple"} account again when asked.`}
              </Text>
            )}
            {delete_error && <Notice tone="error">{delete_error}</Notice>}
            <Button label="Cancel" variant="secondary" disabled={busy} onPress={() => set_deleting(false)} />
            <Button
              label={
                method === "password" ? "Delete account forever" : `Confirm with ${method === "google" ? "Google" : "Apple"} and delete`
              }
              busy={busy}
              disabled={method === "password" && !password}
              onPress={() => void run_delete()}
            />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Preferences() {
  const { type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const state = usePreferences();
  return (
    <>
      <Text style={type.muted}>
        These choices are saved for your account on this device. The app also respects your phone’s text size and Reduce Motion settings.
      </Text>
      {!state.ready && !state.error && <Notice>Loading preferences…</Notice>}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {!state.ready && state.error && <Button label="Retry loading preferences" onPress={state.reload} />}
      <Text accessibilityRole="header" style={type.label}>
        APPEARANCE
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={styles.card}>
        {APPEARANCES.map((choice) => (
          <AppearanceOption
            key={choice}
            choice={choice}
            selected={state.values.appearance === choice}
            disabled={!state.ready || state.busy}
            onPress={() => void state.update("appearance", choice)}
          />
        ))}
      </View>
      <Text accessibilityRole="header" style={type.label}>
        BUTTON COLOR
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Button color" style={styles.card}>
        {ACCENT_COLORS.map((choice) => (
          <AccentOption
            key={choice}
            choice={choice}
            selected={state.values.accent === choice}
            disabled={!state.ready || state.busy}
            onPress={() => void state.update("accent", choice)}
          />
        ))}
      </View>
      <Text accessibilityRole="header" style={type.label}>
        PHOTOS
      </Text>
      <View style={styles.card}>
        <Toggle
          label="Pause photo wall"
          detail="Keep the Home photo wall still. Your phone’s Reduce Motion setting always pauses it."
          value={state.values.pausePhotoWall}
          disabled={!state.ready || state.busy}
          onChange={(v) => void state.update("pausePhotoWall", v)}
        />
        <Toggle
          label="Keep offline cover photos"
          detail="Keep a cover photo with newly saved recipes. Turning this off keeps existing photos and still saves recipe text."
          value={state.values.saveCoverPhotos}
          disabled={!state.ready || state.busy}
          onChange={(v) => void state.update("saveCoverPhotos", v)}
        />
      </View>
      {state.busy ? <Notice>Saving preference…</Notice> : state.notice ? <Notice>{state.notice}</Notice> : null}
      <Text style={type.muted}>The camera always stays dark. Recipe measurements use US units.</Text>
    </>
  );
}
export const APPEARANCE_LABELS: Record<Appearance, { label: string; detail: string }> = {
  system: { label: "Match phone", detail: "Light or dark, following your phone’s setting" },
  light: { label: "Light", detail: "A light background, always" },
  dark: { label: "Dark", detail: "A dark background, always" },
};

export const ACCENT_LABELS: Record<AccentColor, { label: string; detail: string }> = {
  coral: { label: "Coral", detail: "Recipeak’s own color" },
  blue: { label: "Blue", detail: "Blue buttons and highlights" },
};

/** One button-color choice, with a swatch of that color so it can be seen before choosing. */
function AccentOption({
  choice,
  selected,
  disabled,
  onPress,
}: {
  choice: AccentColor;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, scheme, type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const { label, detail } = ACCENT_LABELS[choice];
  const swatch = palette_for(scheme, choice).accent;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.toggle, pressed && { backgroundColor: colors.raised }, disabled && { opacity: 0.6 }]}
    >
      <View style={[styles.swatch, { backgroundColor: swatch }]} accessible={false} />
      <View style={styles.copy}>
        <Text style={type.body}>{label}</Text>
        <Text style={type.muted}>{detail}</Text>
      </View>
      <View style={[styles.radio, selected && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
        {selected && <Ionicons name="checkmark" size={14} color={colors.accentText} />}
      </View>
    </Pressable>
  );
}

function AppearanceOption({
  choice,
  selected,
  disabled,
  onPress,
}: {
  choice: Appearance;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const { label, detail } = APPEARANCE_LABELS[choice];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.toggle, pressed && { backgroundColor: colors.raised }, disabled && { opacity: 0.6 }]}
    >
      <View style={styles.copy}>
        <Text style={type.body}>{label}</Text>
        <Text style={type.muted}>{detail}</Text>
      </View>
      <View style={[styles.radio, selected && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
        {selected && <Ionicons name="checkmark" size={14} color={colors.accentText} />}
      </View>
    </Pressable>
  );
}

function Toggle({
  label,
  detail,
  value,
  disabled,
  onChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors, type } = useTheme();
  const styles = useThemedStyles(create_styles);
  return (
    <View style={styles.toggle}>
      <View style={styles.copy}>
        <Text style={type.body}>{label}</Text>
        <Text style={type.muted}>{detail}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={detail}
        accessibilityState={{ disabled, checked: value }}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.raised }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function Usage() {
  const { type } = useTheme();
  const { api } = useApp();
  const [value, set_value] = useState<Allowance | null>(null);
  const [error, set_error] = useState<string | null>(null);
  const [notice, set_notice] = useState<string | null>(null);
  const [attempt, set_attempt] = useState(0);
  const [busy, set_busy] = useState(false);
  const [restoring, set_restoring] = useState(false);
  useFocusEffect(
    useCallback(() => {
      // Reading the retry token starts a fresh request when Refresh is pressed.
      void attempt;
      let live = true;
      set_busy(true);
      set_error(null);
      set_value(null);
      api
        .allowance()
        .then(
          (next) => {
            if (live) set_value(next);
          },
          () => {
            if (live) set_error("Couldn’t load your plan. Check your connection and try again.");
          },
        )
        .finally(() => {
          if (live) set_busy(false);
        });
      return () => {
        live = false;
      };
    }, [api, attempt]),
  );
  async function restore() {
    if (restoring) return;
    set_restoring(true);
    set_error(null);
    set_notice(null);
    const outcome = await subscriptions.restore();
    set_restoring(false);
    if (outcome.kind === "failed") set_error(outcome.message);
    else if (outcome.kind === "purchased") {
      set_notice("Premium is on for this account.");
      set_attempt((n) => n + 1);
    }
  }
  const open_page = (url: string) => {
    set_error(null);
    Linking.openURL(url).catch(() => set_error("Couldn’t open that page. Check your connection and try again."));
  };
  return (
    <>
      {busy && <Notice>Checking your plan…</Notice>}
      {value && (
        <Text style={type.body}>
          {value.premium
            ? "You have Premium: unlimited photos, every saved recipe, and vegetarian, vegan, or meat and dairy versions of any dish."
            : value.free_photos_left == null
              ? "Free plan. Your photo count is unavailable right now."
              : `Free plan: ${value.free_photos_left} of ${value.free_photos_total} free photos left.`}
        </Text>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}
      {value && !value.premium && (
        <Button label="See Premium" onPress={() => router.push({ pathname: "/upgrade", params: { reason: "intro" } })} />
      )}
      <Group>
        {value?.premium && (
          <Row
            label="Manage subscription"
            detail={`Change or cancel in ${Platform.OS === "ios" ? "the App Store" : "Google Play"}`}
            icon="card-outline"
            trailing="open-outline"
            onPress={() => open_page(manage_subscription_url(Platform.OS))}
          />
        )}
        <Row
          label="Restore purchase"
          detail={restoring ? "Checking with the store…" : "Bought Premium on another phone"}
          icon="refresh-outline"
          onPress={() => void restore()}
        />
        <Row label="Refresh" detail="Check your plan and photos again" icon="sync-outline" onPress={() => set_attempt((n) => n + 1)} />
      </Group>
      <Text style={type.muted}>
        A photo counts when it returns a meal or drink. Failed requests and photos that aren’t food or drink don’t use a free photo. Opening
        a Home photo-wall recipe is free.
      </Text>
      <Text style={type.muted}>
        {`The free plan also keeps up to ${FREE_SAVED_RECIPES} recipes in Saved, from photos or the Home photo wall. Saving another opens Premium.`}
      </Text>
    </>
  );
}

function Help() {
  const { type } = useTheme();
  const tips = useTips();
  const [tips_reset, set_tips_reset] = useState(false);
  return (
    <>
      <Button
        label={tips_reset ? "Tips will show again" : "Show tips again"}
        variant="secondary"
        onPress={() => {
          tips.reset();
          set_tips_reset(true);
        }}
      />
      <Text accessibilityRole="header" style={type.heading}>
        Find a recipe
      </Text>
      <Text style={type.body}>
        Tap Snap, take a photo or choose one from your gallery, then tap Send. Choose another match if needed. Open a recipe to adjust
        servings, request a diet version, save it, or share its text.
      </Text>
      <Text accessibilityRole="header" style={type.heading}>
        Photos &amp; AI
      </Text>
      <Text style={type.body}>
        Sending a photo shares it with our recipe server and OpenAI to identify the dish. The server requests that OpenAI not store the
        response. Your original photo isn’t added to Saved. Cover photos come from the shared dish library.
      </Text>
      <Text accessibilityRole="header" style={type.heading}>
        Your data
      </Text>
      <Text style={type.body}>
        Firebase handles sign-in, with email, Google or Apple. The recipe server tracks usage and costs to enforce limits. Each account’s
        saved recipes and offline cover photos are kept separately on this device. Signing out keeps them for when you sign in again.
        Feedback you send is stored privately on our server for up to a year.
      </Text>
      <Text accessibilityRole="header" style={type.heading}>
        Recipe guidance
      </Text>
      <Text style={type.body}>
        Recipes represent the kind of dish or drink, rather than the restaurant’s exact recipe. Photos cannot reveal every ingredient. Check
        ingredients and labels when allergies matter. Leaving out an ingredient doesn’t remove traces of it from shared kitchens or packaged
        foods.
      </Text>
    </>
  );
}
const create_styles = (colors: Palette) =>
  StyleSheet.create({
    card: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, overflow: "hidden" },
    toggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    copy: { flex: 1, gap: 8 },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.control,
      alignItems: "center",
      justifyContent: "center",
    },
    swatch: { width: 28, height: 28, borderRadius: 14 },
    overlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: "center", paddingHorizontal: 20 },
    accountCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentTint, alignItems: "center", justifyContent: "center" },
    avatarText: { color: colors.accentInk, fontSize: 20, fontWeight: "600" },
    accountEmail: { color: colors.text, fontSize: 16, fontWeight: "600" },
    planLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 },
    planLink: { color: colors.accentInk, fontSize: 14, fontWeight: "600" },
    deleteLink: { marginTop: 24, alignItems: "center", gap: 4, paddingVertical: 12, minHeight: 48 },
    deleteText: { color: colors.danger, fontSize: 16, fontWeight: "600" },
    input: {
      minHeight: 54,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      color: colors.text,
      fontSize: 16,
      paddingHorizontal: 14,
    },
    dialog: { padding: 24, gap: 12, backgroundColor: colors.surface, borderRadius: 18, maxWidth: 600, width: "100%", alignSelf: "center" },
  });
