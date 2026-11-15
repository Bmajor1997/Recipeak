import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, TextInput, View } from "react-native";
import { useApp } from "../AppContext";
import type { Kind } from "../recipes/types";
import { useOpenWallDish } from "../recipes/useOpenWallDish";
import { Button, Chip, useTheme } from "../ui/theme";

type Dish = { name: string; kind: Kind; aliases: string[]; image: string | null };

export default function ExploreScreen() {
  const { api } = useApp();
  const { colors, type } = useTheme();
  const open = useOpenWallDish();
  const [dishes, set_dishes] = useState<Dish[]>([]);
  const [query, set_query] = useState("");
  const [filter, set_filter] = useState<"all" | Kind>("all");
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState(false);
  const [attempt, set_attempt] = useState(0);
  useEffect(() => {
    let live = true;
    api
      .explore()
      .then(
        (result) => {
          if (live) set_dishes(result);
        },
        () => {
          if (live) set_error(true);
        },
      )
      .finally(() => {
        if (live) set_loading(false);
      });
    return () => {
      live = false;
    };
  }, [api, attempt]);
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const visible = dishes.filter(
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
      {loading ? (
        <ActivityIndicator color={colors.accentInk} />
      ) : error ? (
        <Button
          label="Couldn't load collection. Try again"
          onPress={() => {
            set_loading(true);
            set_error(false);
            set_attempt(attempt + 1);
          }}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => `${item.kind}:${item.name}`}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
          ListEmptyComponent={<Text style={type.muted}>No matches. Try another search.</Text>}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.name} recipe`}
              onPress={() => open(item)}
              style={{ flex: 1, maxWidth: "50%", backgroundColor: colors.surface, borderRadius: 16, overflow: "hidden" }}
            >
              {item.image && <Image source={{ uri: api.image_uri(item.image) ?? undefined }} style={{ width: "100%", aspectRatio: 1 }} />}
              <View style={{ padding: 12 }}>
                <Text style={type.body}>{item.name}</Text>
                <Text style={type.muted}>{item.kind === "meal" ? "Meal" : "Cocktail"}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
