// Explore: every dish and drink with a hand-picked photo. The collection and its recipes ship inside the app,
// so this works offline and opens recipes instantly.
import { useState } from "react";
import { FlatList, Image, Pressable, Text, TextInput, View } from "react-native";
import { COLLECTION } from "../recipes/collectionPhotos";
import type { Kind } from "../recipes/types";
import { useOpenWallDish } from "../recipes/useOpenWallDish";
import { Chip, useTheme } from "../ui/theme";

const SORTED = [...COLLECTION].sort((a, b) => a.name.localeCompare(b.name));

export default function ExploreScreen() {
  const { colors, type } = useTheme();
  const open = useOpenWallDish();
  const [query, set_query] = useState("");
  const [filter, set_filter] = useState<"all" | Kind>("all");
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const visible = SORTED.filter(
    (dish) =>
      (filter === "all" || dish.kind === filter) &&
      words.every((word) => [dish.name, ...dish.aliases].join(" ").toLowerCase().includes(word)),
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 }}>
      <TextInput
        accessibilityLabel="Search meals and cocktails"
        placeholder="Search meals and cocktails"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={set_query}
        style={{
          minHeight: 48,
          fontSize: 16,
          color: colors.text,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          padding: 14,
          marginTop: 12,
        }}
      />
      <View style={{ flexDirection: "row", marginVertical: 8 }}>
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
        ListEmptyComponent={<Text style={type.muted}>No matches. Try another search.</Text>}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.name} recipe`}
            onPress={() => void open(item)}
            style={({ pressed }) => [
              { flex: 1, maxWidth: "50%", backgroundColor: colors.surface, borderRadius: 16, overflow: "hidden" },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Image source={item.source} style={{ width: "100%", aspectRatio: 1 }} accessible={false} />
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
