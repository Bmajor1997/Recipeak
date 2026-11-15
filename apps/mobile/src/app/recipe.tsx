// The recipe sheet. It slides up as soon as a photo is sent, shows "Finding your recipe…", then the closest match
// with a CREME-style cover photo from the shared library, the other matches to switch between, diet versions and Save.
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type CurrentRecipe, useApp } from "../AppContext";
import { ApiError } from "../api/client";
import { useCamera } from "../camera/CameraProvider";
import { FREE_SAVED_RECIPES } from "../paywall/plans";
import { formatIngredient, formatMinutes, recipeAsText } from "../recipes/format";
import { scaleAmount } from "../recipes/scale";
import { DIETS, type Diet, type Guess, type Kind } from "../recipes/types";
import { useDishImage } from "../recipes/useDishImage";
import { SavedLimitError } from "../saved/savedRecipes";
import { FocusedCover } from "../ui/FocusedCover";
import { Button, Chip, colors, fonts, Notice, type } from "../ui/theme";

const heroArt = require("../../assets/hero.png");
type Ready = Extract<CurrentRecipe, { status: "ready" }>;

export default function RecipeScreen() {
  const { current } = useApp();
  if (!current || current.status === "loading") return <Finding />;
  if (current.status === "problem") return <Problem message={current.message} />;
  return <RecipeView current={current} />;
}

function Sheet({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <View style={styles.handle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      {children}
      {footer}
      <View style={[styles.topBar, { top: 18 }]} pointerEvents="box-none">
        <RoundButton icon="chevron-down" label="Close recipe" onPress={() => router.back()} />
      </View>
      <View style={{ height: insets.bottom }} />
    </View>
  );
}

function Finding() {
  const { height } = useWindowDimensions();
  return (
    <Sheet>
      <View style={[styles.cover, styles.placeholder, { height: Math.min(Math.round(height * 0.42), 400) }]}>
        <Image source={heroArt} style={styles.placeholderArt} resizeMode="contain" accessible={false} />
      </View>
      <View style={styles.body} accessibilityLiveRegion="polite">
        <View style={styles.findingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={type.body}>Finding your recipe…</Text>
        </View>
        <View style={[styles.skeleton, { width: "70%", height: 28 }]} />
        <View style={[styles.skeleton, { width: "100%" }]} />
        <View style={[styles.skeleton, { width: "85%" }]} />
      </View>
    </Sheet>
  );
}

function Problem({ message }: { message: string }) {
  const { openCamera } = useCamera();
  return (
    <Sheet>
      <View style={[styles.body, { paddingTop: 90 }]}>
        <Text style={type.title} accessibilityRole="header">
          {"Let's try that again"}
        </Text>
        <Notice tone="error">{message}</Notice>
        <Button
          label="Retake photo"
          onPress={() => {
            router.back();
            openCamera();
          }}
        />
        <Button label="Close" variant="secondary" onPress={() => router.back()} />
      </View>
    </Sheet>
  );
}

function RecipeView({ current }: { current: Ready }) {
  const { setCurrent, api, saved } = useApp();
  const { photosLeft } = useCamera();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { recipe, kind, guesses, selected } = current;
  const dishName = guesses[selected]?.name ?? recipe.title;
  const [diet, setDiet] = useState<Diet | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [servings, setServings] = useState(recipe.servings || 1);
  const [shownRecipe, setShownRecipe] = useState(recipe);

  // A new version (another match or a diet) starts at its own serving size.
  if (recipe !== shownRecipe) {
    setShownRecipe(recipe);
    setServings(recipe.servings || 1);
  }

  const cover = useDishImage(api, kind, dishName, current.image, { lookUp: !current.localPhoto && current.image.status === "unavailable" });
  const coverUri = current.localPhoto ?? cover.uri;
  const factor = servings / (recipe.servings || 1);
  const coverHeight = Math.min(Math.round(height * 0.42), 400);

  async function loadVersion(index: number, nextDiet: Diet | null) {
    const guess = guesses[index];
    setBusy(true);
    setProblem(null);
    try {
      const next = await api.recipe(guess?.name ?? recipe.title, kind, nextDiet ?? undefined);
      setDiet(nextDiet);
      setCurrent({ ...current, recipe: next.recipe, selected: index, image: next.image, localPhoto: null, savedId: null });
    } catch (error) {
      if (error instanceof ApiError && error.needsUpgrade) router.push("/upgrade");
      else setProblem(error instanceof ApiError ? error.message : "Couldn't load that version. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSave() {
    try {
      if (current.savedId) {
        await saved.remove(current.savedId);
        setCurrent({ ...current, savedId: null });
      } else {
        // Saved with its cover photo, downloaded to the phone so Saved works offline. Free accounts keep up to 3
        // recipes, however they found them (a photo or the Home wall); photosLeft is null only for subscribers.
        const limit = (await isSubscriber()) ? undefined : FREE_SAVED_RECIPES;
        const entry = await saved.save(kind, recipe, coverUri, { limit });
        setCurrent({ ...current, savedId: entry.id });
      }
    } catch (error) {
      if (error instanceof SavedLimitError) router.push({ pathname: "/upgrade", params: { reason: "saved" } });
      else setProblem((error as Error).message);
    }
  }

  async function isSubscriber(): Promise<boolean> {
    if (photosLeft !== undefined) return photosLeft === null;
    // Not known yet: ask the server. If it can't be reached, let the save through rather than block a subscriber.
    return api.allowance().then(
      (a) => a.premium,
      () => true,
    );
  }

  const diets = DIETS.filter((d) => kind === "cocktail" || d !== "non-alcoholic");

  const footer = (
    <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.stepper}>
        <RoundButton icon="remove" label="Fewer servings" small onPress={() => setServings(Math.max(1, servings - 1))} />
        <Text style={styles.servings} accessibilityLiveRegion="polite">
          Serves {servings}
        </Text>
        <RoundButton icon="add" label="More servings" small onPress={() => setServings(Math.min(50, servings + 1))} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={current.savedId ? "Saved. Tap to remove from Saved" : "Save recipe"}
        onPress={toggleSave}
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
  );

  return (
    <Sheet footer={footer}>
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
                    onPress={() => i !== selected && loadVersion(i, diet)}
                  />
                ))}
              </View>
            </>
          )}

          <View style={styles.stats}>
            <Stat label="Prep" value={formatMinutes(recipe.prep_minutes)} />
            <Stat label="Cook" value={formatMinutes(recipe.cook_minutes)} />
            <Stat label="Serves" value={String(servings)} />
          </View>

          {busy && <Notice>Getting that version…</Notice>}
          {problem && <Notice tone="error">{problem}</Notice>}

          <Text style={type.heading}>Make it…</Text>
          <View style={styles.wrap}>
            {diets.map((d) => (
              <Chip key={d} label={d} selected={d === diet} onPress={() => loadVersion(selected, d === diet ? null : d)} />
            ))}
          </View>

          {recipe.cocktail && (
            <View style={styles.serve}>
              <Ionicons name="wine-outline" size={22} color={colors.accent} />
              <Text style={[type.body, { flex: 1 }]}>
                Serve in a {recipe.cocktail.glass.toLowerCase()}
                {recipe.cocktail.garnish ? `, garnished with ${recipe.cocktail.garnish.toLowerCase()}` : ""}.
              </Text>
            </View>
          )}

          <Text style={type.heading} accessibilityRole="header">
            Ingredients
          </Text>
          {recipe.ingredients.map((ingredient, i) => {
            const scaled = scaleAmount(ingredient.amount, factor);
            const amount = [scaled, ingredient.unit].filter((p) => p.trim()).join(" ");
            return (
              <View key={i} style={styles.ingredient} accessible accessibilityLabel={formatIngredient({ ...ingredient, amount: scaled })}>
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

          {recipe.cocktail?.non_alcoholic_version && (
            <>
              <Text style={type.heading}>Non-alcoholic version</Text>
              <Text style={type.body}>{recipe.cocktail.non_alcoholic_version}</Text>
            </>
          )}
          {!!recipe.note && (
            <>
              <Text style={type.heading}>Tip</Text>
              <Text style={type.body}>{recipe.note}</Text>
            </>
          )}

          <Text style={type.heading}>Allergens</Text>
          <Text style={type.body}>
            {recipe.allergens.length ? `Contains ${recipe.allergens.join(", ")}.` : "None of the major allergens are listed."}
          </Text>
          <Text style={[type.muted, { marginTop: 4 }]}>{"A photo can't show every ingredient. Check labels if allergies matter."}</Text>

          <View style={styles.shareRow}>
            <Button label="Share recipe" variant="secondary" onPress={() => Share.share({ message: recipeAsText(recipe) })} />
          </View>

          <Text style={[type.muted, { marginTop: 16 }]}>
            This is a representative recipe for this {kind === "cocktail" ? "drink" : "dish"}, not the exact recipe from the restaurant or
            bar.
          </Text>
        </View>
      </ScrollView>
    </Sheet>
  );
}

/** One of the closest matches, with its own cover photo. */
function MatchCard({ kind, guess, selected, onPress }: { kind: Kind; guess: Guess; selected: boolean; onPress: () => void }) {
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
      <Text style={[styles.matchName, selected && { color: colors.accent }]} numberOfLines={2}>
        {guess.name}
      </Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
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
  const size = small ? 44 : 46;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.round, { width: size, height: size, borderRadius: size / 2 }, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={small ? 22 : 26} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  kicker: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 18 },
  title: { color: colors.text, fontSize: 28, lineHeight: 34, fontFamily: fonts.display, marginTop: 4 },
  matches: { flexDirection: "row", gap: 10, marginTop: 10 },
  match: { flex: 1, borderRadius: 14, padding: 6, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: "transparent" },
  matchSelected: { borderColor: colors.accent },
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
  amount: { color: colors.accent, fontSize: 16, fontWeight: "700", minWidth: 76 },
  step: { flexDirection: "row", gap: 16, marginBottom: 20 },
  stepNumber: { color: colors.accent, fontSize: 24, lineHeight: 28, fontFamily: fonts.displayMedium, minWidth: 36 },
  shareRow: { marginTop: 16 },
  topBar: { position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
  round: { backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
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
