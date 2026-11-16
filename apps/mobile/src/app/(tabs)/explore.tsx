// Explore: every dish and drink with a hand-picked photo. The collection and its recipes ship inside the app,
// so this works offline and opens recipes instantly. Home's rows open it on one shelf ("See all").
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import { FlatList, Image, Pressable, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLLECTION } from "../../recipes/collectionPhotos";
import { is_shelf_id, SHELVES, type ShelfId } from "../../recipes/shelves";
import type { Kind } from "../../recipes/types";
import { useOpenWallDish } from "../../recipes/useOpenWallDish";
import { Chip, useTheme } from "../../ui/theme";

const by_name = <T extends { name: string }>(list: T[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));
const SORTED = by_name(COLLECTION);

export default function ExploreScreen() {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  // Photos get an exact size: Android otherwise sizes them from the picture itself and crops them tall.
  const tile = Math.floor((useWindowDimensions().width - 20 * 2 - 12) / 2);
  const open = useOpenWallDish();
  const params = useLocalSearchParams<{ shelf?: string; search?: string }>();
  const [query, set_query] = useState("");
  const [filter, set_filter] = useState<"all" | Kind>("all");
  const [shelf, set_shelf] = useState<ShelfId | null>(null);
  const [opened_with, set_opened_with] = useState<string | undefined>(undefined);
  const search_box = useRef<ComponentRef<typeof TextInput>>(null);

  // Opening Explore from a Home row ("See all") shows just that shelf.
  const asked = `${params.shelf ?? ""}|${params.search ?? ""}`;
  if (asked !== opened_with) {
    set_opened_with(asked);
    if (is_shelf_id(params.shelf)) {
      set_shelf(params.shelf);
      set_filter("all");
      set_query("");
    }
  }
  // Opening it from the search bar on Home puts the cursor straight in the search box.
  useEffect(() => {
    if (params.search) search_box.current?.focus();
  }, [params.search]);

  const source = shelf ? by_name(SHELVES[shelf].dishes) : SORTED;
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const visible = source.filter(
    (dish) =>
      (filter === "all" || dish.kind === filter) &&
      words.every((word) => [dish.name, ...dish.aliases].join(" ").toLowerCase().includes(word)),
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: insets.top + 16 }}>
      <Text style={type.display} accessibilityRole="header">
        Explore
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          paddingHorizontal: 14,
          marginTop: 12,
        }}
      >
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput
          ref={search_box}
          accessibilityLabel="Search meals and cocktails"
          placeholder={`Search ${COLLECTION.length} recipes`}
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={set_query}
          returnKeyType="search"
          autoCorrect={false}
          style={{ flex: 1, minHeight: 48, fontSize: 16, color: colors.text }}
        />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 8 }}>
        {shelf && (
          <Chip
            label={`${SHELVES[shelf].title}  ✕`}
            selected
            onPress={() => {
              set_shelf(null);
              router.setParams({ shelf: undefined });
            }}
          />
        )}
        {(
          [
            ["all", "All"],
            ["meal", "Meals"],
            ["cocktail", "Cocktails"],
          ] as const
        ).map(([value, label]) => (
          <Chip key={value} label={label} selected={filter === value} onPress={() => set_filter(value)} />
        ))}
      </View>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        initialNumToRender={8}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={type.muted}>No matches. Try another search.</Text>}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.name} recipe`}
            onPress={() => void open(item)}
            style={({ pressed }) => [
              { width: tile, backgroundColor: colors.surface, borderRadius: 16, overflow: "hidden" },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Image source={item.source} style={{ width: tile, height: tile }} resizeMode="cover" accessible={false} />
            <View style={{ padding: 12 }}>
              <Text style={type.body}>{item.name}</Text>
              <Text style={type.muted}>{item.kind === "meal" ? "Meal" : "Cocktail"}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
