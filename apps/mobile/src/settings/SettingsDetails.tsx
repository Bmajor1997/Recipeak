import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../AppContext";
import { clear_account_device_data, delete_account, delete_account_problem } from "../auth/deleteAccount";
import { firebase } from "../auth/firebase";
import { remove_photo } from "../saved/photoStore";
import { FREE_SAVED_RECIPES } from "../paywall/plans";
import { recipe_as_text } from "../recipes/format";
import type { Allowance, SavedRecipe } from "../recipes/types";
import { Button, Notice, useTheme, useThemedStyles, type Palette } from "../ui/theme";
import { FEEDBACK_KINDS, FEEDBACK_TEXT, type FeedbackKind } from "../feedback/feedback";
import { DietPicker, InterestPicker } from "../onboarding/Choices";
import { toggle_diet } from "../onboarding/onboarding";
import { useOnboarding } from "../onboarding/OnboardingProvider";
import { legal_page_urls, SUPPORT_EMAIL, support_mail_url } from "./legalLinks";
import { usePreferences } from "./PreferencesProvider";
import { APPEARANCES, type Appearance } from "./preferences";
import { CATEGORIES, type Category, Group, Row, SettingsScreen } from "./SettingsUI";

export function SettingsDetails({ category }: { category: Category }) {
  return (
    <SettingsScreen title={CATEGORIES[category]} back>
      {category === "account" ? (
        <Account />
      ) : category === "preferences" ? (
        <Preferences />
      ) : category === "taste" ? (
        <Taste />
      ) : category === "library" ? (
        <Library />
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
  const [confirm, set_confirm] = useState(false);
  const [deleting, set_deleting] = useState(false);
  const [password, set_password] = useState("");
  const [delete_error, set_delete_error] = useState<string | null>(null);
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
        await firebase.sign_out();
        set_current(null);
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
      await delete_account(password, {
        confirm_password: (value) => firebase.confirm_password(value),
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
      <Text style={type.body}>{user?.email ?? "Signed-in account"}</Text>
      <Text style={type.muted}>
        Your sign-in lets the recipe service check your photo allowance. Your saved recipes belong to this account.
      </Text>
      {!confirm && error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}
      <Button label="Reset password" variant="secondary" disabled={busy || !user?.email} onPress={() => void run("reset")} />
      <Button
        label="Sign out"
        variant="secondary"
        disabled={busy}
        onPress={() => {
          set_error(null);
          set_confirm(true);
        }}
      />
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
      <Button
        label="Delete account"
        variant="secondary"
        disabled={busy}
        onPress={() => {
          set_delete_error(null);
          set_password("");
          set_deleting(true);
        }}
      />
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
            {delete_error && <Notice tone="error">{delete_error}</Notice>}
            <Button label="Cancel" variant="secondary" disabled={busy} onPress={() => set_deleting(false)} />
            <Button label="Delete account forever" busy={busy} disabled={!password} onPress={() => void run_delete()} />
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
      <Text style={type.muted}>
        Both looks use Recipeak’s grapefruit accent. The camera always stays dark. Recipe measurements use US units.
      </Text>
    </>
  );
}
export const APPEARANCE_LABELS: Record<Appearance, { label: string; detail: string }> = {
  system: { label: "Match phone", detail: "Light or dark, following your phone’s setting" },
  light: { label: "Light", detail: "A light background, always" },
  dark: { label: "Dark", detail: "A dark background, always" },
};

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

function Library() {
  const { type } = useTheme();
  const { saved } = useApp();
  const [items, set_items] = useState<SavedRecipe[] | null>(null);
  const [error, set_error] = useState<string | null>(null);
  const [busy, set_busy] = useState(false);
  const sharing = useRef(false);
  const [attempt, set_attempt] = useState(0);
  useFocusEffect(
    useCallback(() => {
      // Reading the retry token starts a fresh request when Refresh is pressed.
      void attempt;
      let live = true;
      set_items(null);
      set_error(null);
      saved.list().then(
        (list) => {
          if (live) set_items(list);
        },
        () => {
          if (live) set_error("Couldn’t read saved recipes. Try again.");
        },
      );
      return () => {
        live = false;
      };
    }, [saved, attempt]),
  );
  async function share() {
    if (!items?.length || sharing.current) return;
    sharing.current = true;
    set_busy(true);
    set_error(null);
    try {
      await Share.share({
        title: "My Recipeak recipes",
        message: items.map((item) => recipe_as_text(item.recipe)).join("\n\n—\n\n"),
      });
    } catch {
      set_error("Couldn’t open sharing. Please try again.");
    } finally {
      sharing.current = false;
      set_busy(false);
    }
  }
  return (
    <>
      <Text style={type.body}>
        {items ? `${items.length} saved ${items.length === 1 ? "recipe" : "recipes"}` : "Loading saved recipes…"}
      </Text>
      {items && <Text style={type.muted}>{items.filter((item) => item.photo_uri).length} with an offline cover photo.</Text>}
      <Text style={type.muted}>
        Your recipes and their offline cover photos belong to your account and are kept on this device. Other accounts on this phone can’t
        see them. They aren’t synced or backed up yet, so they don’t follow you to another phone. Remove a recipe from its recipe screen to
        remove its saved photo too.
      </Text>
      {error && <Notice tone="error">{error}</Notice>}
      <Button label="Refresh saved recipes" variant="secondary" disabled={busy} onPress={() => set_attempt((n) => n + 1)} />
      <Button label="Share saved recipe text" disabled={!items?.length} busy={busy} onPress={() => void share()} />
      <Text style={type.muted}>Sharing includes recipe text only, without photos. It is not a restorable app backup.</Text>
      <Group title="YOUR LIBRARY">
        <Row
          label="Manage saved recipes"
          detail="Search, open, and remove recipes"
          icon="bookmark-outline"
          onPress={() => router.push("/(tabs)/saved")}
        />
      </Group>
    </>
  );
}

function Usage() {
  const { type } = useTheme();
  const { api } = useApp();
  const [value, set_value] = useState<Allowance | null>(null);
  const [error, set_error] = useState<string | null>(null);
  const [attempt, set_attempt] = useState(0);
  const [busy, set_busy] = useState(false);
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
            if (live) set_error("Couldn’t load your photo allowance. Check your connection and try again.");
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
  return (
    <>
      {busy && <Notice>Checking your photo allowance…</Notice>}
      {value && (
        <Text style={type.body}>
          {value.premium
            ? "Paid access is active."
            : value.free_photos_left == null
              ? "Free-photo balance is unavailable."
              : `${value.free_photos_left} of ${value.free_photos_total} free photos left.`}
        </Text>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <Text style={type.muted}>
        A photo counts when it returns a meal or drink. Failed requests and photos that aren’t food or drink don’t use a free photo. Opening
        a Home photo-wall recipe is free.
      </Text>
      <Text style={type.muted}>
        {`The free plan also keeps up to ${FREE_SAVED_RECIPES} recipes in Saved, from photos or the Home photo wall. Saving another opens the paid plan.`}
      </Text>
      <Button label="Refresh photo allowance" variant="secondary" disabled={busy} onPress={() => set_attempt((n) => n + 1)} />
      <Text style={type.muted}>Purchasing and managing a paid plan in the app are not available yet.</Text>
    </>
  );
}

function Help() {
  const { type } = useTheme();
  const pages = legal_page_urls(process.env.EXPO_PUBLIC_API_BASE_URL);
  const [link_problem, set_link_problem] = useState<string | null>(null);
  const open_link = (url: string) => {
    set_link_problem(null);
    Linking.openURL(url).catch(() => set_link_problem(`Couldn’t open that link. You can email ${SUPPORT_EMAIL}.`));
  };
  return (
    <>
      <Group title="PRIVACY & SUPPORT">
        {pages && (
          <Row
            label="Privacy policy"
            detail="What Recipeak keeps and why"
            icon="shield-checkmark-outline"
            onPress={() => open_link(pages.privacy)}
          />
        )}
        {pages && (
          <Row
            label="Terms of use"
            detail="The rules for using Recipeak"
            icon="document-text-outline"
            onPress={() => open_link(pages.terms)}
          />
        )}
        <Row label="Contact support" detail={SUPPORT_EMAIL} icon="mail-outline" onPress={() => open_link(support_mail_url())} />
      </Group>
      {link_problem && <Notice tone="error">{link_problem}</Notice>}
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
        Firebase handles email sign-in. The recipe server tracks usage and costs to enforce limits. Each account’s saved recipes and offline
        cover photos are kept separately on this device. Signing out keeps them for when you sign in again. Feedback you send is stored
        privately on our server for up to a year.
      </Text>
      <Text accessibilityRole="header" style={type.heading}>
        Recipe guidance
      </Text>
      <Text style={type.body}>
        Recipes represent the kind of dish or drink, rather than the restaurant’s exact recipe. Photos cannot reveal every ingredient. Check
        ingredients and labels when allergies matter. Leaving out an ingredient doesn’t remove traces of it from shared kitchens or packaged
        foods.
      </Text>
      <Text accessibilityRole="header" style={type.heading}>
        About
      </Text>
      <Text style={type.muted}>Recipeak · Early release · Made by Benjamin Major</Text>
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
    overlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: "center", paddingHorizontal: 20 },
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
