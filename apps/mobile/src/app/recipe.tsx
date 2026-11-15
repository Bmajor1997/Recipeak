// Recipe page, modelled on CREME's cocktail page: the photo fills the top with the title written over it.
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../AppContext";
import { ApiError } from "../api/client";
import { formatIngredient, formatMinutes, recipeAsText } from "../recipes/format";
import { scaleAmount } from "../recipes/scale";
import { DIETS, type Diet, type Recipe } from "../recipes/types";
import { Chip, colors, fonts, Notice, type } from "../ui/theme";

const heroArt = require("../../assets/hero.png");

export default function RecipeScreen() {
  const { current, setCurrent, api, saved } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [savedId, setSavedId] = useState<string | null>(current?.savedId ?? null);
  const [selected, setSelected] = useState(0);
  const [diet, setDiet] = useState<Diet | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [servings, setServings] = useState(current?.recipe.servings || 1);
  const [shownRecipe, setShownRecipe] = useState(current?.recipe);

  // A new version (other guess or diet) starts at its own serving size.
  if (current && current.recipe !== shownRecipe) {
    setShownRecipe(current.recipe);
    setServings(current.recipe.servings || 1);
  }

  useEffect(() => {
    if (!current) router.back();
  }, [current]);
  if (!current) return null;
  const { recipe, kind, guesses, photoUri } = current;
  const factor = servings / (recipe.servings || 1);
  const headerHeight = Math.min(Math.round(height * 0.42), 400);

  async function loadVersion(index: number, nextDiet: Diet | null) {
    setBusy(true);
    setProblem(null);
    try {
      const next: Recipe = await api.recipe(guesses[index]?.name ?? recipe.title, kind, nextDiet ?? undefined);
      setSelected(index);
      setDiet(nextDiet);
      setSavedId(null);
      setCurrent({ kind, guesses, recipe: next, photoUri, savedId: null });
    } catch (error) {
      if (error instanceof ApiError && error.needsUpgrade) router.push("/upgrade");
      else setProblem(error instanceof ApiError ? error.message : "Couldn't load that version. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSave() {
    try {
      if (savedId) {
        await saved.remove(savedId);
        setSavedId(null);
      } else {
        setSavedId((await saved.save(kind, recipe, photoUri)).id);
      }
    } catch (error) {
      setProblem((error as Error).message);
    }
  }

  const diets = DIETS.filter((d) => kind === "cocktail" || d !== "non-alcoholic");

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        {/* Full-width photo, kept clean: the title sits just below it */}
        <View style={{ width, height: headerHeight }}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel="Your photo" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.artBackdrop]}>
              <Image source={heroArt} style={{ width: width * 0.75, height: width * 0.6 }} resizeMode="contain" accessible={false} />
            </View>
          )}
          {/* A light shade at the top keeps the round buttons visible on bright photos. */}
          <LinearGradient colors={["rgba(0,0,0,0.4)", "rgba(0,0,0,0)"]} locations={[0, 0.3]} style={StyleSheet.absoluteFill} />
        </View>

        <View style={styles.body}>
          <Text style={styles.kicker}>{kind === "cocktail" ? "Drink" : "Meal"}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {recipe.title}
          </Text>
          <Text style={[type.body, { marginTop: 8 }]}>{recipe.description}</Text>

          <View style={styles.stats}>
            <Stat label="Prep" value={formatMinutes(recipe.prep_minutes)} />
            <Stat label="Cook" value={formatMinutes(recipe.cook_minutes)} />
            <Stat label="Serves" value={String(servings)} />
          </View>

          {guesses.length > 1 && (
            <>
              <Text style={[type.label, { marginTop: 20 }]}>NOT QUITE RIGHT? IT MIGHT BE</Text>
              <View style={styles.wrap}>
                {guesses.map((g, i) => (
                  <Chip key={g.name} label={g.name} selected={i === selected} onPress={() => i !== selected && loadVersion(i, diet)} />
                ))}
              </View>
            </>
          )}

          {busy && <Notice>Getting that version…</Notice>}
          {problem && <Notice tone="error">{problem}</Notice>}

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
            const amount = [scaleAmount(ingredient.amount, factor), ingredient.unit].filter((p) => p.trim()).join(" ");
            return (
              <View
                key={i}
                style={styles.ingredient}
                accessible
                accessibilityLabel={formatIngredient({ ...ingredient, amount: scaleAmount(ingredient.amount, factor) })}
              >
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

          <Text style={type.heading}>Make it…</Text>
          <View style={styles.wrap}>
            {diets.map((d) => (
              <Chip key={d} label={d} selected={d === diet} onPress={() => loadVersion(selected, d === diet ? null : d)} />
            ))}
          </View>

          <Text style={[type.muted, { marginTop: 24 }]}>
            This is a representative recipe for this {kind === "cocktail" ? "drink" : "dish"}, not the exact recipe from the restaurant or
            bar.
          </Text>
        </View>
      </ScrollView>

      {/* Round buttons over the photo */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <RoundButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <RoundButton icon="share-outline" label="Share recipe" onPress={() => Share.share({ message: recipeAsText(recipe) })} />
      </View>

      {/* Servings counter and Save, always within reach */}
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
          accessibilityLabel={savedId ? "Saved. Tap to remove from Saved" : "Save recipe"}
          onPress={toggleSave}
          style={({ pressed }) => [styles.save, savedId && styles.saved, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name={savedId ? "bookmark" : "bookmark-outline"} size={20} color={savedId ? colors.text : colors.accentText} />
          <Text style={[styles.saveText, savedId && { color: colors.text }]}>{savedId ? "Saved" : "Save"}</Text>
        </Pressable>
      </View>
    </View>
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
  const size = small ? 44 : 48;
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
  artBackdrop: { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 18 },
  title: { color: colors.text, fontSize: 28, lineHeight: 34, fontFamily: fonts.display, marginTop: 4 },
  body: { paddingHorizontal: 20 },
  stats: { flexDirection: "row", marginTop: 20, backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 14 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { color: colors.text, fontSize: 16, fontWeight: "600", marginTop: 4 },
  wrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
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
