import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useApp } from "../AppContext";
import { ApiError } from "../api/client";
import { formatIngredient, formatMinutes, recipeAsText } from "../recipes/format";
import { DIETS, type Diet, type Recipe } from "../recipes/types";
import { Button, Chip, colors, Notice, type } from "../ui/theme";

export default function RecipeScreen() {
  const { current, setCurrent, api, saved } = useApp();
  const { savedId } = useLocalSearchParams<{ savedId?: string }>();
  const [savedEntry, setSavedEntry] = useState<string | null>(savedId ?? null);
  const [selected, setSelected] = useState(0);
  const [diet, setDiet] = useState<Diet | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!current) router.back();
  }, [current]);
  if (!current) return null;
  const { recipe, kind, guesses } = current;

  async function loadVersion(index: number, nextDiet: Diet | null) {
    setBusy(true);
    setProblem(null);
    try {
      const next: Recipe = await api.recipe(guesses[index]?.name ?? recipe.title, kind, nextDiet ?? undefined);
      setSelected(index);
      setDiet(nextDiet);
      setSavedEntry(null);
      setCurrent({ kind, guesses, recipe: next });
    } catch (error) {
      if (error instanceof ApiError && error.needsUpgrade) router.push("/upgrade");
      else setProblem(error instanceof ApiError ? error.message : "Couldn't load that version. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSave() {
    try {
      if (savedEntry) {
        await saved.remove(savedEntry);
        setSavedEntry(null);
      } else {
        setSavedEntry((await saved.save(kind, recipe)).id);
      }
    } catch (error) {
      setProblem((error as Error).message);
    }
  }

  const diets = DIETS.filter((d) => kind === "cocktail" || d !== "non-alcoholic");

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {guesses.length > 1 && (
        <View>
          <Text style={type.muted}>Not quite right? It might be:</Text>
          <View style={styles.wrap}>
            {guesses.map((g, i) => (
              <Chip key={g.name} label={g.name} selected={i === selected} onPress={() => i !== selected && loadVersion(i, diet)} />
            ))}
          </View>
        </View>
      )}

      <Text style={[type.title, { marginTop: 8 }]} accessibilityRole="header">
        {recipe.title}
      </Text>
      <Text style={[type.body, { marginTop: 8 }]}>{recipe.description}</Text>
      <Text style={[type.muted, { marginTop: 8 }]}>
        Serves {recipe.servings} · Prep {formatMinutes(recipe.prep_minutes)} · Cook {formatMinutes(recipe.cook_minutes)}
      </Text>

      {busy && <Notice>Getting that version…</Notice>}
      {problem && <Notice tone="error">{problem}</Notice>}

      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Button
            label={savedEntry ? "Saved ✓" : "Save"}
            onPress={toggleSave}
            hint={savedEntry ? "Removes it from Saved" : "Adds it to Saved"}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Share" variant="secondary" onPress={() => Share.share({ message: recipeAsText(recipe) })} />
        </View>
      </View>

      {recipe.cocktail && (
        <>
          <Text style={type.heading}>Serve</Text>
          <Text style={type.body}>Glass: {recipe.cocktail.glass}</Text>
          {!!recipe.cocktail.garnish && <Text style={type.body}>Garnish: {recipe.cocktail.garnish}</Text>}
        </>
      )}

      <Text style={type.heading} accessibilityRole="header">
        Ingredients
      </Text>
      {recipe.ingredients.map((ingredient, i) => (
        <Text key={i} style={[type.body, styles.item]}>
          • {formatIngredient(ingredient)}
        </Text>
      ))}

      <Text style={type.heading} accessibilityRole="header">
        Steps
      </Text>
      {recipe.steps.map((step, i) => (
        <Text key={i} style={[type.body, styles.item]}>
          {i + 1}. {step}
        </Text>
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
        This is a representative recipe for this {kind === "cocktail" ? "drink" : "dish"}, not the exact recipe from the restaurant or bar.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48 },
  wrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  row: { flexDirection: "row", marginTop: 8 },
  item: { marginBottom: 8 },
});
