import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../AppContext";
import { firebase } from "../auth/firebase";
import { FREE_SAVED_RECIPES } from "../paywall/plans";
import { recipe_as_text } from "../recipes/format";
import type { Allowance, SavedRecipe } from "../recipes/types";
import { Button, Notice, useTheme, useThemedStyles, type Palette } from "../ui/theme";
import { FEEDBACK_KINDS, FEEDBACK_TEXT, type FeedbackKind } from "../feedback/feedback";
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

const FEEDBACK_ICONS: Record<FeedbackKind, "bulb-outline" | "bug-outline"> = { feature: "bulb-outline", bug: "bug-outline" };

/** Ported from Votic: two private forms, one for ideas and one for problems. */
function Feedback() {
  const { type } = useTheme();
  return (
    <>
      <Text style={type.muted}>Tell us what would make Recipeek better, or what went wrong. Only the Recipeek team sees it.</Text>
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
  const { user, set_current } = useApp();
  const [confirm, set_confirm] = useState(false);
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
        Both looks use Recipeek’s grapefruit accent. The camera always stays dark. Recipe measurements use US units.
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
        title: "My Recipeek recipes",
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
  return (
    <>
      <Text accessibilityRole="header" style={type.heading}>
        Find a recipe
      </Text>
      <Text style={type.body}>
        Tap Camera, take a photo or choose one from your gallery, then tap Send. Choose another match if needed. Open a recipe to adjust
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
        ingredients and labels when allergies matter.
      </Text>
      <Text accessibilityRole="header" style={type.heading}>
        About
      </Text>
      <Text style={type.muted}>
        Recipeek · Early release. Published privacy and terms pages, a support contact, and account deletion are not configured in this app
        yet.
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
    overlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: "center", paddingHorizontal: 20 },
    dialog: { padding: 24, gap: 12, backgroundColor: colors.surface, borderRadius: 18, maxWidth: 600, width: "100%", alignSelf: "center" },
  });
