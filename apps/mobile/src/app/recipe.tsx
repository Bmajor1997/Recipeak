// The recipe sheet. It slides up as soon as a photo is sent, shows "Finding your recipe…", then the closest match
// with a CREME-style cover photo from the shared library, the other matches to switch between, diet versions and Save.
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type CurrentRecipe, useApp } from "../AppContext";
import { ApiError } from "../api/client";
import { useCamera } from "../camera/CameraProvider";
import { diets_for_kind, or_list } from "../onboarding/onboarding";
import { useOnboarding } from "../onboarding/OnboardingProvider";
import { FREE_SAVED_RECIPES } from "../paywall/plans";
import { bundled_recipe, bundled_version } from "../recipes/bundled";
import { NO_IMAGE } from "../recipes/types";
import { COLLECTION } from "../recipes/collectionPhotos";
import { bundled_diet_profile } from "../recipes/dietProfile";
import { diet_profile } from "../recipes/diets";
import { format_ingredient, format_minutes, recipe_as_text } from "../recipes/format";
import { scale_amount } from "../recipes/scale";
import { ReportRecipe } from "../recipes/ReportRecipe";
import { ADDITION_HINTS, type Addition, additions_for, is_premium_diet } from "../recipes/premiumVersions";
import { RateRecipe } from "../recipes/RateRecipe";
import { DIETS, type Diet, type Guess, type Kind, type Recipe } from "../recipes/types";
import { useDishImage } from "../recipes/useDishImage";
import { usePreferences } from "../settings/PreferencesProvider";
import { SavedLimitError } from "../saved/savedRecipes";
import { STORE_URL } from "../settings/legalLinks";
import { useTips } from "../tips/TipsProvider";
import { FocusedCover } from "../ui/FocusedCover";
import { TipBubble } from "../ui/TipBubble";
import { Button, Chip, fonts, Notice, useTheme, useThemedStyles, type Palette } from "../ui/theme";
import { useStoreReviewPrompt } from "../review/useStoreReviewPrompt";

const heroArt = require("../../assets/hero.png");
type Ready = Extract<CurrentRecipe, { status: "ready" }>;

export default function RecipeScreen() {
  const { current } = useApp();
  if (!current || current.status === "loading") return <Finding photo={current?.status === "loading" ? current.photo : undefined} />;
  if (current.status === "photo-choice") return <PhotoChoice current={current} />;
  if (current.status === "problem") return <Problem message={current.message} source={current.source ?? "photo"} />;
  return <RecipeView current={current} />;
}

/** Choose a trusted bundled recipe before accepting an AI-generated suggestion. */
function PhotoChoice({ current }: { current: Extract<CurrentRecipe, { status: "photo-choice" }> }) {
  const { set_current } = useApp();
  const { type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const [busy, set_busy] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const open_suggestion = () => set_current({
    status: "ready", kind: current.kind, recipe: current.suggested, guesses: current.guesses,
    selected: 0, image: current.guesses[0]?.image ?? NO_IMAGE, localPhoto: null, savedId: null,
  });
  async function open_existing(id: string) {
    if (busy) return;
    set_busy(true);
    set_error(null);
    try {
      const dish = COLLECTION.find((item) => item.id === id && item.kind === current.kind);
      const recipe = dish && bundled_recipe(dish);
      if (!dish || !recipe) throw new Error("The saved recipe could not be opened.");
      set_current({
        status: "ready", kind: current.kind, recipe, guesses: [{ name: dish.name, confidence: "high", image: NO_IMAGE }],
        selected: 0, image: NO_IMAGE, localPhoto: null, savedId: null, picked: true, bundledId: dish.id,
      });
    } catch {
      set_error("Couldn't open that collection recipe. You can still use the AI suggestion.");
    } finally {
      set_busy(false);
    }
  }
  return (
    <Sheet>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: 90, paddingBottom: 40 }]}>
        <Text style={type.title} accessibilityRole="header">Choose your recipe</Text>
        {current.matches.length > 0 ? (
          <>
            <Text style={[type.body, { marginVertical: 14 }]}>We found these recipes in Recipeak's collection. Choose one to open it without another AI request.</Text>
            {current.matches.map((match) => (
              <View key={match.id} style={{ marginBottom: 10 }}>
                <Button label={match.name} disabled={busy} onPress={() => void open_existing(match.id)} />
              </View>
            ))}
          </>
        ) : (
          <Text style={[type.body, { marginVertical: 14 }]}>We couldn't find an exact recipe in the collection.</Text>
        )}
        <Text style={[type.body, { marginVertical: 12 }]}>
          The photo analysis also prepared a representative AI recipe for {current.guesses[0]?.name ?? "this dish"}.
          It may not match hidden ingredients or the original preparation.
        </Text>
        <Button label="Review AI recipe" variant="secondary" disabled={busy} onPress={open_suggestion} />
        <Text style={[type.muted, { marginTop: 12 }]}>
          Check all ingredients and allergens before cooking or serving. A photo cannot establish hidden allergens or cross-contact.
        </Text>
        {error && <Notice tone="error">{error}</Notice>}
      </ScrollView>
    </Sheet>
  );
}

function Sheet({
  children,
  footer,
  on_share,
  share_tip,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Shows a share button at the top right, beside the close button. */
  on_share?: () => void;
  /** The one-time "you can share this" tip, shown under the share button after a first save. */
  share_tip?: React.ReactNode;
}) {
  const styles = useThemedStyles(create_styles);
  const insets = useSafeAreaInsets();
  // On Android the recipe fills the screen, so a solid band keeps scrolled text out from under the clock and icons.
  // On iOS it's a sheet below the status bar and needs no band.
  const status_space = Platform.OS === "android" ? insets.top : 0;
  return (
    <View style={styles.screen}>
      <View
        style={[styles.handle, { top: 8 + status_space }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      {children}
      {footer}
      {status_space > 0 && <View style={[styles.statusBand, { height: status_space }]} pointerEvents="none" />}
      <View style={[styles.topBar, { top: 18 + status_space }]} pointerEvents="box-none">
        <RoundButton icon="chevron-down" label="Close recipe" onPress={() => router.back()} />
        {on_share && <RoundButton icon="share-outline" label="Share recipe" onPress={on_share} />}
      </View>
      {share_tip && (
        <View style={[styles.shareTip, { top: 18 + status_space + 52 }]} pointerEvents="box-none">
          {share_tip}
        </View>
      )}
      <View style={{ height: insets.bottom }} />
    </View>
  );
}

/** Shown while a recipe loads: the tapped dish's photo when there is one, otherwise the app's art. */
function Finding({ photo }: { photo?: number }) {
  const { colors, type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const { height } = useWindowDimensions();
  return (
    <Sheet>
      <View style={[styles.cover, styles.placeholder, { height: Math.min(Math.round(height * 0.42), 400) }]}>
        {photo ? (
          <Image source={photo} style={StyleSheet.absoluteFill} resizeMode="cover" accessible={false} />
        ) : (
          <Image source={heroArt} style={styles.placeholderArt} resizeMode="contain" accessible={false} />
        )}
      </View>
      <View style={styles.body} accessibilityLiveRegion="polite">
        <View style={styles.findingRow}>
          <ActivityIndicator color={colors.accentInk} />
          <Text style={type.body}>Finding your recipe…</Text>
        </View>
        <View style={[styles.skeleton, { width: "70%", height: 28 }]} />
        <View style={[styles.skeleton, { width: "100%" }]} />
        <View style={[styles.skeleton, { width: "85%" }]} />
      </View>
    </Sheet>
  );
}

/** A recipe that couldn't be shown. After a photo it offers a retake or a typed name; after a Home wall tap, just Close. */
function Problem({ message, source }: { message: string; source: "photo" | "wall" }) {
  const { type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const { open_camera } = useCamera();
  return (
    <Sheet>
      <View style={[styles.body, { paddingTop: 90 }]}>
        <Text style={type.title} accessibilityRole="header">
          {source === "wall" ? "Couldn't open that recipe" : "Let's try that again"}
        </Text>
        <Notice tone="error">{message}</Notice>
        {source === "photo" && (
          <>
            <Button
              label="Retake photo"
              onPress={() => {
                router.back();
                open_camera();
              }}
            />
            <ManualCorrection initialKind="meal" correction />
          </>
        )}
        <Button label="Close" variant="secondary" onPress={() => router.back()} />
      </View>
    </Sheet>
  );
}

function RecipeView({ current }: { current: Ready }) {
  const { colors, type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const { set_current, api, saved, ratings } = useApp();
  const preferences = usePreferences();
  const saving = useRef(false);
  const { photosLeft } = useCamera();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { recipe, kind, guesses, selected } = current;
  const dishName = guesses[selected]?.name ?? recipe.title;
  const [diet, set_diet] = useState<Diet | null>(current.diet ?? null);
  const [busy, set_busy] = useState(false);
  const [problem, set_problem] = useState<string | null>(null);
  // Save problems show beside the Save button, not at the top of the page, so they're seen and announced.
  const [save_problem, set_save_problem] = useState<string | null>(null);
  const [just_saved, set_just_saved] = useState(false);
  const tips = useTips();
  // Shares the version on screen: its serving size, its diet version, the person's own note and, for a recipe from
  // their own photo, that photo. Android can't send text and a photo together, so it asks which one.
  const share_recipe = async () => {
    tips.mark_seen("share");
    const rating = await ratings?.get(kind, dishName).catch(() => null);
    const message = recipe_as_text(recipe, { servings, diet, note: rating?.note, store_url: STORE_URL });
    const photo = current.localPhoto;
    const share_text = () => void Share.share({ message }).catch(() => undefined);
    if (!photo) return share_text();
    if (Platform.OS === "ios") return void Share.share({ message, url: photo }).catch(() => undefined);
    Alert.alert("Share", "What would you like to share?", [
      { text: "The recipe", onPress: share_text },
      {
        text: "Your photo",
        onPress: () => void Sharing.shareAsync(photo, { mimeType: "image/jpeg", dialogTitle: recipe.title }).catch(() => undefined),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };
  const [notice, set_notice] = useState<string | null>(
    current.diet ? `Showing the ${current.diet} version, from your diet in Settings.` : null,
  );
  const [servings, set_servings] = useState(recipe.servings || 1);
  const [shownRecipe, set_shown_recipe] = useState(recipe);
  // "Make it non-vegetarian / non-vegan": which one is showing, and the recipe it was made from, so tapping it again
  // goes straight back without asking the server.
  const [addition, set_addition] = useState<Addition | null>(null);
  const [original, set_original] = useState<Recipe | null>(null);
  const base = addition && original ? original : recipe;

  // A new version (another match or a diet) starts at its own serving size.
  if (recipe !== shownRecipe) {
    set_shown_recipe(recipe);
    set_servings(recipe.servings || 1);
  }

  const cover = useDishImage(api, kind, dishName, current.image, { lookUp: !current.localPhoto && current.image.status === "unavailable" });
  const coverUri = current.localPhoto ?? cover.uri;
  const factor = servings / (recipe.servings || 1);
  const coverHeight = Math.min(Math.round(height * 0.42), 400);

  // The diets chosen in the first-launch tour (or later in Settings). Bundled dishes open in their vegetarian or vegan
  // version on their own (see useOpenWallDish); other diets come from the server and wait for a tap.
  const myDiets = diets_for_kind(useOnboarding().values.diets, kind);
  // Only diets that need a real change are offered; diets the recipe already meets are shown as labels instead.
  const profile = useMemo(() => {
    const dish = current.bundledId ? COLLECTION.find((d) => d.id === current.bundledId) : undefined;
    const regular = dish && bundled_recipe(dish);
    return diet === null && dish && regular ? bundled_diet_profile(dish.id, regular, kind) : diet_profile(base, kind);
  }, [current.bundledId, kind, diet, base]);
  // Only from the standard recipe: a vegetarian version of a meat dish doesn't get "Make it non-vegetarian".
  const additions = diet === null ? additions_for(profile, kind) : [];
  const tapHint = myDiets.filter((d) => d !== diet && (profile.options.includes(d) || profile.status[d]?.status === "review"));
  const dietUnverified = diet !== null && !profile.fits.includes(diet);

  async function load_version(index: number, nextDiet: Diet | null) {
    const guess = guesses[index];
    set_problem(null);
    set_notice(null);
    if (is_premium_diet(nextDiet) && !(await premium_or_problem())) return;
    // A dish from the bundled collection has hand-written vegetarian and vegan versions: shown at once, offline.
    const local = current.bundledId && index === selected ? bundled_version(current.bundledId, nextDiet) : null;
    if (local) {
      set_addition(null);
      set_original(null);
      set_diet(nextDiet);
      if (local.already && nextDiet) set_notice(`This recipe is already ${nextDiet}.`);
      set_current({ ...current, recipe: local.recipe, savedId: null });
      return;
    }
    set_busy(true);
    try {
      const next = await api.recipe(guess?.name ?? recipe.title, kind, nextDiet ?? undefined);
      // Keep the original and its undo action until the replacement has actually arrived.
      set_addition(null);
      set_original(null);
      set_diet(nextDiet);
      set_current({ ...current, recipe: next.recipe, selected: index, image: next.image, localPhoto: null, savedId: null });
    } catch (error) {
      if (error instanceof ApiError && error.needsUpgrade) router.push({ pathname: "/upgrade", params: { reason: error.upgradeReason } });
      else set_problem(error instanceof ApiError ? error.message : "Couldn't load that version. Please try again.");
    } finally {
      set_busy(false);
    }
  }

  /** True for subscribers. Opens the Premium screen for free accounts, or explains when the plan can't be checked. */
  async function premium_or_problem(): Promise<boolean> {
    try {
      if (await is_subscriber()) return true;
      router.push({ pathname: "/upgrade", params: { reason: "versions" } });
    } catch {
      set_problem("Couldn't check your plan. Please try again.");
    }
    return false;
  }

  async function load_addition(next: Addition) {
    set_problem(null);
    set_notice(null);
    // Tapping the one that's showing goes back to the recipe it was made from.
    if (next === addition && original) {
      set_addition(null);
      set_original(null);
      set_current({ ...current, recipe: original, savedId: null });
      return;
    }
    if (busy || !(await premium_or_problem())) return;
    set_busy(true);
    try {
      const from = original ?? recipe;
      const made = await api.recipe_addition(dishName, next, from);
      set_original(from);
      set_addition(next);
      set_current({ ...current, recipe: made, savedId: null });
    } catch (error) {
      if (error instanceof ApiError && error.needsUpgrade) router.push({ pathname: "/upgrade", params: { reason: error.upgradeReason } });
      else set_problem(error instanceof ApiError ? error.message : "Couldn't make that version. Please try again.");
    } finally {
      set_busy(false);
    }
  }

  const after_save = useStoreReviewPrompt();
  async function toggle_save() {
    // One save or removal at a time: a double tap must not save twice or leave an extra photo behind.
    if (preferences.busy || saving.current) return;
    saving.current = true;
    set_save_problem(null);
    try {
      if (current.savedId) {
        await saved.remove(current.savedId);
        set_current({ ...current, savedId: null });
      } else {
        // Saved with its cover photo, downloaded to the phone so Saved works offline. Free accounts keep up to 3
        // recipes, however they found them (a photo or the Home wall); photosLeft is null only for subscribers.
        const limit = (await is_subscriber()) ? undefined : FREE_SAVED_RECIPES;
        const entry = await saved.save(kind, recipe, preferences.ready && preferences.values.saveCoverPhotos ? coverUri : null, { limit });
        set_current({ ...current, savedId: entry.id });
        set_just_saved(true);
        after_save();
      }
    } catch (error) {
      if (error instanceof SavedLimitError) router.push({ pathname: "/upgrade", params: { reason: "saved" } });
      else
        set_save_problem(
          error instanceof ApiError ? "Couldn't check your plan to save this recipe. Please try again." : (error as Error).message,
        );
    } finally {
      saving.current = false;
    }
  }

  async function is_subscriber(): Promise<boolean> {
    if (photosLeft !== undefined) return photosLeft === null;
    // Not known yet: ask the server. If it can't be reached, the save stops with a "try again" message, so it
    // neither lets a free account past its limit nor wrongly shows a subscriber the paywall.
    return (await api.allowance()).premium;
  }

  const choices = DIETS.filter((d) => profile.options.includes(d) || profile.status[d]?.status === "review" || d === diet);

  const footer = (
    <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
      {save_problem && <Notice tone="error">{save_problem}</Notice>}
      <View style={styles.bottomRow}>
        <View style={styles.stepper}>
          <RoundButton icon="remove" label="Fewer servings" small onPress={() => set_servings(Math.max(1, servings - 1))} />
          <Text style={styles.servings} accessibilityLiveRegion="polite">
            Serves {servings}
          </Text>
          <RoundButton icon="add" label="More servings" small onPress={() => set_servings(Math.min(50, servings + 1))} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={current.savedId ? "Saved. Tap to remove from Saved" : "Save recipe"}
          accessibilityState={{ disabled: preferences.busy }}
          disabled={preferences.busy}
          onPress={toggle_save}
          style={({ pressed }) => [styles.save, current.savedId && styles.saved, pressed && { opacity: 0.8 }]}
        >
          <Ionicons
            name={current.savedId ? "bookmark" : "bookmark-outline"}
            size={20}
            color={current.savedId ? colors.text : colors.accentText}
          />
          <Text style={[styles.saveText, current.savedId && { color: colors.text }]}>{current.savedId ? "Saved" : "Save"}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Sheet
      footer={footer}
      on_share={share_recipe}
      share_tip={
        just_saved && tips.is_due("share") ? (
          <TipBubble
            text="Saved. Tap share to send it to a friend."
            arrow="up"
            arrow_at="right"
            on_dismiss={() => tips.mark_seen("share")}
          />
        ) : null
      }
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        {/* Cover photo from the shared library; the app's art shows while it's being created. */}
        <View style={[styles.cover, { width, height: coverHeight }]}>
          {coverUri ? (
            <FocusedCover uri={coverUri} width={width} height={coverHeight} label={`Photo of ${recipe.title}`} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
              <Image source={heroArt} style={styles.placeholderArt} resizeMode="contain" accessible={false} />
              {cover.pending && (
                <View style={styles.creating}>
                  <ActivityIndicator color={colors.muted} size="small" />
                  <Text style={type.muted}>Creating photo…</Text>
                </View>
              )}
            </View>
          )}
          <LinearGradient colors={["rgba(0,0,0,0.4)", "rgba(0,0,0,0)"]} locations={[0, 0.3]} style={StyleSheet.absoluteFill} />
          {coverUri && (
            <View style={styles.aiLabel}>
              <Text style={styles.aiLabelText}>AI-generated image</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.kicker}>{kind === "cocktail" ? "Drink" : "Meal"}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {recipe.title}
          </Text>
          <Text style={[type.body, { marginTop: 8 }]}>{recipe.description}</Text>

          {guesses.length > 1 && (
            <>
              <Text style={[type.label, { marginTop: 20 }]}>CLOSEST MATCHES</Text>
              <View style={styles.matches}>
                {guesses.map((g, i) => (
                  <MatchCard
                    key={g.name}
                    kind={kind}
                    guess={g}
                    selected={i === selected}
                    onPress={() => i !== selected && load_version(i, null)}
                  />
                ))}
              </View>
            </>
          )}

          {!!guesses.length && !current.picked && <ManualCorrection initialKind={kind} />}

          <View style={styles.stats}>
            <Stat label="Prep" value={format_minutes(recipe.prep_minutes)} />
            <Stat label="Cook" value={format_minutes(recipe.cook_minutes)} />
            <Stat label="Serves" value={String(servings)} />
          </View>

          {busy && <Notice>Getting that version…</Notice>}
          {problem && <Notice tone="error">{problem}</Notice>}
          {notice && <Notice>{notice}</Notice>}
          {dietUnverified && <Notice>Check the ingredients and labels: this version could not be confirmed as {diet}.</Notice>}
          {tapHint.length > 0 && <Notice>For your diet, tap {or_list(tapHint)} below.</Notice>}
          {preferences.error && (
            <Notice>
              Offline cover preferences could not load. You can still save recipe text. Retry loading preferences in Settings.
            </Notice>
          )}

          {/* The labels describe the standard recipe, so they're hidden while a meat or dairy version is showing. */}
          {profile.fits.length > 0 && !addition && (
            <View style={{ marginTop: 16 }}>
              <Text style={type.body}>
                <Text style={{ fontWeight: "700" }}>Already </Text>
                {profile.fits.join(" · ")}
              </Text>
              <Text style={[type.muted, { marginTop: 4 }]}>
                {"From the ingredients. Check packaged ingredients' labels; this can't rule out cross-contact."}
              </Text>
            </View>
          )}
          {(choices.length > 0 || additions.length > 0) && (
            <>
              <Text style={type.heading}>Make it…</Text>
              <View style={styles.wrap}>
                {choices.map((d) => (
                  <Chip key={d} label={d} selected={d === diet} onPress={() => load_version(selected, d === diet ? null : d)} />
                ))}
                {additions.map((a) => (
                  <Chip key={a} label={a} selected={a === addition} onPress={() => void load_addition(a)} />
                ))}
              </View>
              {addition && <Notice>{`${ADDITION_HINTS[addition]}. Tap ${addition} again for the original recipe.`}</Notice>}
              {photosLeft !== null && (choices.some(is_premium_diet) || additions.length > 0) && (
                <Text style={[type.muted, { marginTop: 4 }]}>
                  {"Vegetarian, vegan, non-vegetarian and non-vegan versions are part of Premium."}
                </Text>
              )}
            </>
          )}

          {recipe.cocktail && (
            <View style={styles.serve}>
              <Ionicons name="wine-outline" size={22} color={colors.accentInk} />
              <Text style={[type.body, { flex: 1 }]}>
                Serve in a {recipe.cocktail.glass.toLowerCase()}
                {recipe.cocktail.garnish ? `, garnished with ${recipe.cocktail.garnish.toLowerCase()}` : ""}.
              </Text>
            </View>
          )}

          <View style={{ marginTop: 20 }}>
            <Button
              label={kind === "cocktail" ? "Start mixing" : "Start cooking"}
              onPress={() => router.push({ pathname: "/cook", params: { servings: String(servings) } })}
            />
          </View>
          <Text style={type.heading} accessibilityRole="header">
            Ingredients
          </Text>
          {recipe.ingredients.map((ingredient, i) => {
            const scaled = scale_amount(ingredient.amount, factor);
            const amount = [scaled, ingredient.unit].filter((p) => p.trim()).join(" ");
            return (
              <View key={i} style={styles.ingredient} accessible accessibilityLabel={format_ingredient({ ...ingredient, amount: scaled })}>
                <Text style={styles.amount}>{amount || "•"}</Text>
                <Text style={[type.body, { flex: 1 }]}>{ingredient.item}</Text>
              </View>
            );
          })}

          <Text style={type.heading} accessibilityRole="header">
            Steps
          </Text>
          {recipe.steps.map((step, i) => (
            <View key={i} style={styles.step} accessible accessibilityLabel={`Step ${i + 1}. ${step}`}>
              <Text style={styles.stepNumber}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={[type.body, { flex: 1 }]}>{step}</Text>
            </View>
          ))}

          {!!recipe.tips?.length && (
            <>
              <Text style={type.heading} accessibilityRole="header">
                Tips for success
              </Text>
              {recipe.tips.map((tip, i) => (
                <View key={i} style={styles.tip}>
                  <Ionicons name="bulb-outline" size={20} color={colors.accentInk} accessible={false} />
                  <Text style={[type.body, { flex: 1 }]}>{tip}</Text>
                </View>
              ))}
            </>
          )}
          {!!recipe.make_ahead && (
            <>
              <Text style={type.heading} accessibilityRole="header">
                Make ahead and storage
              </Text>
              <Text style={type.body}>{recipe.make_ahead}</Text>
            </>
          )}
          {!!recipe.variations?.length && (
            <>
              <Text style={type.heading} accessibilityRole="header">
                Variations
              </Text>
              {recipe.variations.map((variation, i) => (
                <View key={i} style={styles.tip}>
                  <Ionicons name="swap-horizontal-outline" size={20} color={colors.accentInk} accessible={false} />
                  <Text style={[type.body, { flex: 1 }]}>{variation}</Text>
                </View>
              ))}
            </>
          )}

          {recipe.cocktail?.non_alcoholic_version && (
            <>
              <Text style={type.heading}>Non-alcoholic version</Text>
              <Text style={type.body}>{recipe.cocktail.non_alcoholic_version}</Text>
            </>
          )}
          {!!recipe.note && (
            <>
              <Text style={type.heading}>Note</Text>
              <Text style={type.body}>{recipe.note}</Text>
            </>
          )}

          <Text style={type.heading}>Allergens</Text>
          <Text style={type.body}>
            {recipe.allergens.length ? `Contains ${recipe.allergens.join(", ")}.` : "None of the major allergens are listed."}
          </Text>
          <Text style={[type.muted, { marginTop: 4 }]}>
            {
              "A photo can't show every ingredient. Check labels if allergies matter. Leaving an ingredient out doesn't remove traces of it from shared kitchens or packaged foods."
            }
          </Text>

          <RateRecipe key={`${kind}|${dishName}`} kind={kind} dish={dishName} />

          <View style={styles.shareRow}>
            <Button label="Share recipe" variant="secondary" onPress={share_recipe} />
          </View>

          <Text style={[type.muted, { marginTop: 16 }]}>
            This is a representative recipe for this {kind === "cocktail" ? "drink" : "dish"}, not the exact recipe from the restaurant or
            bar.
          </Text>

          <View style={{ marginTop: 16 }}>
            <ReportRecipe key={`${kind}|${dishName}|${diet ?? ""}`} kind={kind} dish={dishName} diet={diet} />
          </View>
        </View>
      </ScrollView>
    </Sheet>
  );
}

/**
 * "Not the right dish?": type its name instead. After a photo that couldn't be read (`correction`), the typed name
 * stands in for that photo and uses a free photo; on a recipe, it's a follow-up to the photo that worked.
 */
function ManualCorrection({ initialKind, correction = false }: { initialKind: Kind; correction?: boolean }) {
  const { api, set_current } = useApp();
  const { refresh_allowance } = useCamera();
  const { colors, type } = useTheme();
  const [expanded, set_expanded] = useState(false);
  const [name, set_name] = useState("");
  const [kind, set_kind] = useState<Kind>(initialKind);
  const [busy, set_busy] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  async function find_recipe() {
    const clean = name.trim();
    if (!clean || busy) return;
    set_busy(true);
    set_error(null);
    try {
      const result = await api.recipe(clean, kind, undefined, { correction });
      if (correction) refresh_allowance();
      set_current({
        status: "ready",
        kind,
        recipe: result.recipe,
        guesses: [{ name: clean, confidence: "high", image: result.image }],
        selected: 0,
        image: result.image,
        localPhoto: null,
        savedId: null,
      });
      set_expanded(false);
    } catch (problem) {
      if (problem instanceof ApiError && problem.needsUpgrade)
        router.push({ pathname: "/upgrade", params: { reason: problem.upgradeReason } });
      else set_error(problem instanceof ApiError ? problem.message : "Couldn't find that recipe. Please try again.");
    } finally {
      set_busy(false);
    }
  }
  return (
    <View style={{ marginTop: 18 }}>
      {!expanded ? (
        <Button label="Not the right dish? Enter its name" variant="secondary" onPress={() => set_expanded(true)} />
      ) : (
        <>
          <Text style={type.body}>Enter the name of your meal or cocktail</Text>
          <TextInput
            accessibilityLabel="Dish or cocktail name"
            value={name}
            onChangeText={set_name}
            maxLength={120}
            placeholder="e.g. chicken parmesan"
            placeholderTextColor={colors.muted}
            style={{
              minHeight: 48,
              fontSize: 16,
              color: colors.text,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 14,
              marginVertical: 8,
            }}
          />
          <View style={{ flexDirection: "row" }}>
            <Chip label="Meal" selected={kind === "meal"} onPress={() => set_kind("meal")} />
            <Chip label="Cocktail" selected={kind === "cocktail"} onPress={() => set_kind("cocktail")} />
          </View>
          {error && <Notice tone="error">{error}</Notice>}
          <Button label="Find recipe" disabled={!name.trim()} busy={busy} onPress={find_recipe} />
          <Button label="Cancel" variant="secondary" disabled={busy} onPress={() => set_expanded(false)} />
        </>
      )}
    </View>
  );
}

/** One of the closest matches, with its own cover photo. */
function MatchCard({ kind, guess, selected, onPress }: { kind: Kind; guess: Guess; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(create_styles);
  const { api } = useApp();
  const { uri } = useDishImage(api, kind, guess.name, guess.image);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={guess.name}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.match, selected && styles.matchSelected, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.matchImage}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Image source={heroArt} style={{ width: "80%", height: "80%" }} resizeMode="contain" />
        )}
      </View>
      <Text style={[styles.matchName, selected && { color: colors.accentInk }]} numberOfLines={2}>
        {guess.name}
      </Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { type } = useTheme();
  const styles = useThemedStyles(create_styles);
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={type.label}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  small,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  small?: boolean;
}) {
  const styles = useThemedStyles(create_styles);
  const size = small ? 44 : 46;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.round, { width: size, height: size, borderRadius: size / 2 }, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={small ? 22 : 26} color="#FFFFFF" />
    </Pressable>
  );
}

const create_styles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    handle: {
      position: "absolute",
      top: 8,
      alignSelf: "center",
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.4)",
      zIndex: 2,
    },
    cover: { backgroundColor: colors.surface, overflow: "hidden" },
    placeholder: { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
    placeholderArt: { width: "70%", height: "60%", opacity: 0.85 },
    creating: { position: "absolute", bottom: 14, flexDirection: "row", alignItems: "center", gap: 8 },
    aiLabel: {
      position: "absolute",
      right: 10,
      bottom: 10,
      backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    aiLabelText: { color: "#E4E4E7", fontSize: 11 },
    body: { paddingHorizontal: 20 },
    findingRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20, marginBottom: 18 },
    skeleton: { height: 16, borderRadius: 8, backgroundColor: colors.surface, marginBottom: 12 },
    kicker: { color: colors.accentInk, fontSize: 12, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 18 },
    title: { color: colors.text, fontSize: 28, lineHeight: 34, fontFamily: fonts.display, marginTop: 4 },
    matches: { flexDirection: "row", gap: 10, marginTop: 10 },
    match: { flex: 1, borderRadius: 14, padding: 6, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: "transparent" },
    matchSelected: { borderColor: colors.accentInk },
    matchImage: {
      aspectRatio: 1,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: colors.raised,
      alignItems: "center",
      justifyContent: "center",
    },
    matchName: { color: colors.text, fontSize: 13, fontWeight: "600", marginTop: 6, minHeight: 34 },
    stats: { flexDirection: "row", marginTop: 20, backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 14 },
    stat: { flex: 1, alignItems: "center" },
    statValue: { color: colors.text, fontSize: 16, fontWeight: "600", marginTop: 4 },
    wrap: { flexDirection: "row", flexWrap: "wrap" },
    serve: {
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
      marginTop: 20,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
    },
    ingredient: {
      flexDirection: "row",
      gap: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    amount: { color: colors.accentInk, fontSize: 16, fontWeight: "700", minWidth: 76 },
    step: { flexDirection: "row", gap: 16, marginBottom: 20 },
    tip: { flexDirection: "row", gap: 12, marginBottom: 12 },
    stepNumber: { color: colors.accentInk, fontSize: 24, lineHeight: 28, fontFamily: fonts.displayMedium, minWidth: 36 },
    shareRow: { marginTop: 16 },
    shareTip: { position: "absolute", left: 16, right: 16 },
    topBar: { position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
    round: { backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
    bottomBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    statusBand: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: colors.background },
    stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
    servings: { color: colors.text, fontSize: 15, fontWeight: "600", minWidth: 74, textAlign: "center" },
    save: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 24,
      minHeight: 48,
      paddingHorizontal: 20,
    },
    saved: { backgroundColor: colors.raised },
    saveText: { color: colors.accentText, fontSize: 16, fontWeight: "700" },
  });
