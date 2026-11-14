import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../../AppContext";
import type { SavedRecipe } from "../../recipes/types";
import { colors, type } from "../../ui/theme";

export default function SavedScreen() {
  const { saved, setCurrent } = useApp();
  const [items, setItems] = useState<SavedRecipe[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      saved.list().then(setItems, () => setItems([]));
    }, [saved]),
  );

  if (items && !items.length) {
    return (
      <View style={styles.empty}>
        <Text style={type.heading}>No saved recipes yet</Text>
        <Text style={type.muted}>When you find a recipe you like, tap Save and it will appear here.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.recipe.title}, ${item.kind === "cocktail" ? "drink" : "meal"}`}
          onPress={() => {
            setCurrent({ kind: item.kind, recipe: item.recipe, guesses: [] });
            router.push({ pathname: "/recipe", params: { savedId: item.id } });
          }}
          style={styles.row}
        >
          <Text style={type.body}>{item.recipe.title}</Text>
          <Text style={type.muted}>{item.kind === "cocktail" ? "Drink" : "Meal"}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, padding: 24, backgroundColor: colors.background },
  row: { minHeight: 64, padding: 16, borderRadius: 14, backgroundColor: colors.surface, marginBottom: 10 },
});
