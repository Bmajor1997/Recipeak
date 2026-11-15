import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Modal, ScrollView, Share, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../AppContext";
import { firebase } from "../auth/firebase";
import { recipeAsText } from "../recipes/format";
import type { Allowance, SavedRecipe } from "../recipes/types";
import { Button, colors, Notice, type } from "../ui/theme";
import { usePreferences } from "./PreferencesProvider";
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
      ) : (
        <Help />
      )}
    </SettingsScreen>
  );
}

function Account() {
  const { user, setCurrent } = useApp();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef(false);
  const insets = useSafeAreaInsets();
  async function run(action: "reset" | "sign-out") {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (action === "reset") {
        if (!user?.email) throw new Error("No email");
        await firebase.resetPassword(user.email);
        setNotice("Password reset requested. Check your email for the next steps.");
      } else {
        await firebase.signOut();
        setCurrent(null);
        setConfirm(false);
      }
    } catch {
      setError(
        action === "reset"
          ? "Couldn’t request a password reset. Check your connection and try again."
          : "Couldn’t sign out. Check your connection and try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Text style={type.body}>{user?.email ?? "Signed-in account"}</Text>
      <Text style={type.muted}>Your sign-in lets the recipe service check your photo allowance. Saved recipes stay on this device.</Text>
      {!confirm && error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}
      <Button label="Reset password" variant="secondary" disabled={busy || !user?.email} onPress={() => void run("reset")} />
      <Button
        label="Sign out"
        variant="secondary"
        disabled={busy}
        onPress={() => {
          setError(null);
          setConfirm(true);
        }}
      />
      <Modal
        visible={confirm}
        transparent
        animationType="none"
        onRequestClose={() => {
          if (!busy) setConfirm(false);
        }}
      >
        <View style={[styles.overlay, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          <ScrollView accessibilityViewIsModal contentContainerStyle={styles.dialog}>
            <Text accessibilityRole="header" style={type.title}>
              Sign out?
            </Text>
            <Text style={type.body}>
              Your saved recipes and their photos will stay on this device. Anyone using this app on this device can view them after signing
              in. Signing out does not delete your account.
            </Text>
            {error && <Notice tone="error">{error}</Notice>}
            <Button label="Cancel" variant="secondary" disabled={busy} onPress={() => setConfirm(false)} />
            <Button label="Confirm sign out" busy={busy} onPress={() => void run("sign-out")} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Preferences() {
  const state = usePreferences();
  return (
    <>
      <Text style={type.muted}>
        These choices are saved for your account on this device. The app also respects your phone’s text size and Reduce Motion settings.
      </Text>
      {!state.ready && !state.error && <Notice>Loading preferences…</Notice>}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {!state.ready && state.error && <Button label="Retry loading preferences" onPress={state.reload} />}
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
        Appearance uses Meals &amp; Mixers’ dark background and grapefruit accent. Recipe measurements use US units.
      </Text>
    </>
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
      />
    </View>
  );
}

function Library() {
  const { saved } = useApp();
  const [items, setItems] = useState<SavedRecipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sharing = useRef(false);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(
    useCallback(() => {
      // Reading the retry token starts a fresh request when Refresh is pressed.
      void attempt;
      let live = true;
      setItems(null);
      setError(null);
      saved.list().then(
        (list) => {
          if (live) setItems(list);
        },
        () => {
          if (live) setError("Couldn’t read saved recipes. Try again.");
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
    setBusy(true);
    setError(null);
    try {
      await Share.share({ title: "My Meals & Mixers recipes", message: items.map((item) => recipeAsText(item.recipe)).join("\n\n—\n\n") });
    } catch {
      setError("Couldn’t open sharing. Please try again.");
    } finally {
      sharing.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Text style={type.body}>
        {items ? `${items.length} saved ${items.length === 1 ? "recipe" : "recipes"}` : "Loading saved recipes…"}
      </Text>
      {items && <Text style={type.muted}>{items.filter((item) => item.photo_uri).length} with an offline cover photo.</Text>}
      <Text style={type.muted}>
        Recipes and their offline cover photos live on this device and are shared across sign-ins. They aren’t synced or backed up to your
        account. Remove a recipe from its recipe screen to remove its saved photo too.
      </Text>
      {error && <Notice tone="error">{error}</Notice>}
      <Button label="Refresh saved recipes" variant="secondary" disabled={busy} onPress={() => setAttempt((n) => n + 1)} />
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
  const { api } = useApp();
  const [value, setValue] = useState<Allowance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  useFocusEffect(
    useCallback(() => {
      // Reading the retry token starts a fresh request when Refresh is pressed.
      void attempt;
      let live = true;
      setBusy(true);
      setError(null);
      setValue(null);
      api
        .allowance()
        .then(
          (next) => {
            if (live) setValue(next);
          },
          () => {
            if (live) setError("Couldn’t load your photo allowance. Check your connection and try again.");
          },
        )
        .finally(() => {
          if (live) setBusy(false);
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
      <Button label="Refresh photo allowance" variant="secondary" disabled={busy} onPress={() => setAttempt((n) => n + 1)} />
      <Text style={type.muted}>Purchasing and managing a paid plan in the app are not available yet.</Text>
    </>
  );
}

function Help() {
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
        Firebase handles email sign-in. The recipe server tracks usage and costs to enforce limits. Saved recipe text and offline cover
        photos stay on this device. Signing out keeps them.
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
        Meals &amp; Mixers · Early release. Published privacy and terms pages, a support contact, and account deletion are not configured in
        this app yet.
      </Text>
    </>
  );
}
const styles = StyleSheet.create({
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
  overlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: "center", paddingHorizontal: 20 },
  dialog: { padding: 24, gap: 12, backgroundColor: colors.surface, borderRadius: 18, maxWidth: 600, width: "100%", alignSelf: "center" },
});
