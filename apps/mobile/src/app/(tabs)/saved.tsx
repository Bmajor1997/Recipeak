import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Share, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../AppContext";
import { useCamera } from "../../camera/CameraProvider";
import { recipe_as_text } from "../../recipes/format";
import { filter_saved, type SavedFilter, total_minutes } from "../../recipes/search";
import { NO_IMAGE, type SavedRecipe } from "../../recipes/types";
import { PhotoCard } from "../../ui/PhotoCard";
import { Button, Chip, useTheme, useThemedStyles, type Palette } from "../../ui/theme";

const FILTERS: { value: SavedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "meal", label: "Meals" },
  { value: "cocktail", label: "Drinks" },
];

export default function SavedScreen() {
  const { colors, type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const { saved, set_current } = useApp();
  const { open_camera } = useCamera();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [items, set_items] = useState<SavedRecipe[] | null>(null);
  const [query, set_query] = useState("");
  const [filter, set_filter] = useState<SavedFilter>("all");

  useFocusEffect(
    useCallback(() => {
      saved.list().then(set_items, () => set_items([]));
    }, [saved]),
  );

  // Shares the text of every saved recipe (no photos), for example to keep a copy in notes or send to a friend.
  const sharing = useRef(false);
  async function share_all() {
    if (!items?.length || sharing.current) return;
    sharing.current = true;
    try {
      await Share.share({ title: "My Recipeak recipes", message: items.map((item) => recipe_as_text(item.recipe)).join("\n\n—\n\n") });
    } catch {
      // Closing the share sheet isn't a problem worth a message.
    } finally {
      sharing.current = false;
    }
  }

  const shown = useMemo(() => filter_saved(items ?? [], query, filter), [items, query, filter]);
  const cardWidth = (width - 20 * 2 - 12) / 2;

  const header = (
    <View style={{ paddingTop: insets.top + 16 }}>
      <View style={styles.titleRow}>
        <Text style={type.display} accessibilityRole="header">
          Saved
        </Text>
        {!!items?.length && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share all saved recipes"
            accessibilityHint="Shares the recipe text, without photos"
            hitSlop={8}
            onPress={() => void share_all()}
            style={styles.shareButton}
          >
            <Ionicons name="share-outline" size={22} color={colors.accentInk} />
          </Pressable>
        )}
      </View>
      {!!items?.length && (
        <>
          <View style={styles.search}>
            <Ionicons name="search" size={20} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={set_query}
              placeholder="Search your recipes"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              accessibilityLabel="Search your recipes"
              returnKeyType="search"
              autoCorrect={false}
            />
          </View>
          <View style={styles.filters} accessibilityRole="tablist">
            {FILTERS.map((f) => (
              <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => set_filter(f.value)} />
            ))}
          </View>
        </>
      )}
    </View>
  );

  if (items && !items.length) {
    return (
      <View style={[styles.screen, { paddingHorizontal: 20 }]}>
        {header}
        <Text style={type.heading}>Start your collection</Text>
        <Text style={type.muted}>Snap a meal or a cocktail, then tap Save on the recipe. It will show up here with its photo.</Text>
        <Button label="Open camera" onPress={open_camera} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={shown}
      keyExtractor={(item) => item.id}
      numColumns={2}
      ListHeaderComponent={header}
      ListEmptyComponent={items ? <Text style={[type.muted, { marginTop: 12 }]}>No saved recipes match that search.</Text> : undefined}
      columnWrapperStyle={{ gap: 12 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 12 }}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <PhotoCard
          title={item.recipe.title}
          kind={item.kind}
          minutes={total_minutes(item)}
          photoUri={item.photo_uri}
          width={cardWidth}
          height={cardWidth * 1.25}
          onPress={() => {
            set_current({
              status: "ready",
              kind: item.kind,
              recipe: item.recipe,
              guesses: [],
              selected: 0,
              image: NO_IMAGE,
              localPhoto: item.photo_uri,
              savedId: item.id,
            });
            router.push("/recipe");
          }}
        />
      )}
    />
  );
}

const create_styles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    shareButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    search: {
      marginTop: 16,
      minHeight: 50,
      borderRadius: 14,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      gap: 10,
    },
    searchInput: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 10 },
    filters: { flexDirection: "row", marginTop: 14, marginBottom: 4 },
  });
