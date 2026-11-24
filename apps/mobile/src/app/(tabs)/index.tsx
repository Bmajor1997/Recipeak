import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../AppContext";
import { photos_left_text, useCamera } from "../../camera/CameraProvider";
import { COLLECTION, type CollectionDish } from "../../recipes/collectionPhotos";
import { dish_minutes, explore_collage, home_shelves, local_day, type Pairing, tonights_pick } from "../../recipes/shelves";
import { type SavedRecipe } from "../../recipes/types";
import { generated_as_current, saved_photo_of, type ViewedItem, viewed_items } from "../../recipes/recentItems";
import { useOpenWallDish } from "../../recipes/useOpenWallDish";
import { useOnboarding } from "../../onboarding/OnboardingProvider";
import { greeting } from "../../ui/greeting";
import { PhotoCard } from "../../ui/PhotoCard";
import { SavedCard } from "../../saved/SavedCard";
import { useTheme, useThemedStyles, type Palette } from "../../ui/theme";
import { PhotoWall } from "../../ui/PhotoWall";

/**
 * A recently viewed recipe's small photo: the bundled one, or for a recipe made with AI its copy in Saved (the same
 * cover Saved shows), then its library photo.
 */
function RecentPhoto({ item, saved_photo, style }: { item: ViewedItem; saved_photo: string | null; style: object }) {
  const { api } = useApp();
  const [failed, set_failed] = useState<string | null>(null);
  const library = item.entry?.image_url ? api.image_uri(item.entry.image_url) : null;
  const uri = [saved_photo, library].find((u) => u && u !== failed) ?? null;
  if (item.dish) return <Image source={item.dish.source} style={style} accessible={false} />;
  if (uri) return <Image source={{ uri }} style={style} accessible={false} onError={() => set_failed(uri)} />;
  return <Image source={HERO_ART} style={[style, { opacity: 0.85 }]} resizeMode="contain" accessible={false} />;
}

const HERO_ART = require("../../../assets/hero.png");

export default function HomeScreen() {
  const { colors, type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const { saved, set_current, recent: recently_viewed } = useApp();
  const open = useOpenWallDish();
  const day = local_day();
  const pick = useMemo(() => tonights_pick(day), [day]);
  // More of what the person chose in the first-launch tour: cocktails, meals, or an even mix.
  const mix = useOnboarding().values.interest;
  const shelves = useMemo(() => home_shelves(day, 10, mix), [day, mix]);
  const collage = useMemo(() => explore_collage(day, mix), [day, mix]);
  const cell = Math.floor((useWindowDimensions().width - 20 * 2 - 12 * 2 - 8 * 3) / 4);
  const [viewed, set_viewed] = useState<ViewedItem[]>([]);
  const { photosLeft, refresh_allowance } = useCamera();
  const insets = useSafeAreaInsets();
  const [all_saved, set_all_saved] = useState<SavedRecipe[]>([]);
  const recent = all_saved.slice(0, 8);

  useFocusEffect(
    useCallback(() => {
      refresh_allowance();
      recently_viewed?.list().then(
        (entries) => set_viewed(viewed_items(entries).slice(0, 8)),
        () => set_viewed([]),
      );
      saved.list().then(set_all_saved, () => set_all_saved([]));
    }, [saved, refresh_allowance, recently_viewed]),
  );

  const allowance = photos_left_text(photosLeft);
  const evening = new Date().getHours() >= 17;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}>
      <View style={styles.pad}>
        <Text style={type.muted}>{greeting(new Date().getHours())}</Text>
        <Text style={[type.display, { marginTop: 4 }]} accessibilityRole="header">
          {evening ? "What are you having tonight?" : "What are you having?"}
        </Text>
        {allowance && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{allowance}</Text>
          </View>
        )}
      </View>

      <PhotoWall />

      <TonightsPick pairing={pick} on_open={open} />

      {shelves.map((shelf) => (
        <View key={shelf.id}>
          <SectionHeader
            title={shelf.title}
            see_all={`See all ${shelf.title.toLowerCase()}`}
            on_see_all={() => router.navigate({ pathname: "/explore", params: { shelf: shelf.id } })}
          />
          <FlatList
            horizontal
            data={shelf.dishes}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            renderItem={({ item }) => (
              <PhotoCard
                title={item.name}
                kind={item.kind}
                minutes={dish_minutes(item)}
                photoUri={null}
                photoSource={item.source}
                width={150}
                height={180}
                onPress={() => void open(item)}
              />
            )}
          />
        </View>
      ))}

      {viewed.length > 0 && (
        <>
          <SectionHeader title="Recently viewed" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
            {viewed.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.name} recipe, ${item.kind === "meal" ? "meal" : "drink"}`}
                onPress={() => {
                  if (item.dish) return void open(item.dish);
                  if (!item.entry) return;
                  // A recipe made with AI reopens as it was kept: no AI request and no allowance used.
                  set_current(generated_as_current(item.entry));
                  router.push("/recipe");
                }}
                style={({ pressed }) => [styles.recentChip, pressed && { opacity: 0.7 }]}
              >
                <RecentPhoto item={item} saved_photo={saved_photo_of(item, all_saved)} style={styles.recentPhoto} />
                <Text style={[type.body, { maxWidth: 140 }]} numberOfLines={1}>
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      <SectionHeader title="Explore the collection" />
      <View style={styles.pad}>
        <View style={styles.exploreCard}>
          <View style={styles.collage}>
            {collage.map((dish) => (
              <Pressable
                key={dish.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${dish.name} recipe, ${dish.kind === "meal" ? "meal" : "drink"}`}
                onPress={() => void open(dish)}
                style={[styles.collageCell, { width: cell, height: cell }]}
              >
                <Image source={dish.source} style={{ width: cell, height: cell }} resizeMode="cover" accessible={false} />
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="search"
            accessibilityLabel={`Search ${COLLECTION.length} recipes`}
            accessibilityHint="Opens Explore with the search box ready"
            onPress={() => router.navigate({ pathname: "/explore", params: { search: String(Date.now()) } })}
            style={({ pressed }) => [styles.searchBar, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="search" size={20} color={colors.muted} />
            <Text style={[type.muted, { fontSize: 16 }]}>Search {COLLECTION.length} recipes</Text>
          </Pressable>
        </View>
      </View>

      {recent.length > 0 && (
        <>
          <View style={[styles.pad, styles.sectionHeader]}>
            <Text style={[type.heading, { marginTop: 0, marginBottom: 0 }]} accessibilityRole="header">
              Recently saved
            </Text>
            <Pressable accessibilityRole="link" hitSlop={10} onPress={() => router.navigate("/saved")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <FlatList
            horizontal
            data={recent}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            renderItem={({ item }) => <SavedCard item={item} width={160} height={200} />}
          />
        </>
      )}
    </ScrollView>
  );
}

/** A section title with an optional "See all" link. */
function SectionHeader({ title, see_all, on_see_all }: { title: string; see_all?: string; on_see_all?: () => void }) {
  const { type } = useTheme();
  const styles = useThemedStyles(create_styles);
  return (
    <View style={[styles.pad, styles.sectionHeader]}>
      <Text style={[type.heading, { marginTop: 0, marginBottom: 0, flexShrink: 1 }]} accessibilityRole="header">
        {title}
      </Text>
      {on_see_all && (
        <Pressable accessibilityRole="link" accessibilityLabel={see_all} hitSlop={10} onPress={on_see_all}>
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Tonight's pick: a meal and a drink that go together, changing every day. Each half opens its own recipe. */
function TonightsPick({ pairing, on_open }: { pairing: Pairing; on_open: (dish: CollectionDish) => void }) {
  const { type } = useTheme();
  // Exact sizes: Android otherwise sizes bundled photos from the picture itself, and they spill over the text.
  const half = Math.floor((useWindowDimensions().width - 20 * 2 - 2) / 2);
  const styles = useThemedStyles(create_styles);
  const { meal, drink, line } = pairing;
  return (
    <>
      <SectionHeader title="Tonight's pick" />
      <View style={styles.pad}>
        <View style={styles.pickCard}>
          <View style={styles.pickPhotos}>
            {[meal, drink].map((dish) => (
              <Pressable
                key={dish.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${dish.name} recipe, ${dish.kind === "meal" ? "meal" : "drink"}`}
                onPress={() => on_open(dish)}
                style={({ pressed }) => [{ width: half, height: PICK_HEIGHT, overflow: "hidden" }, pressed && { opacity: 0.8 }]}
              >
                <Image source={dish.source} style={{ width: half, height: PICK_HEIGHT }} resizeMode="cover" accessible={false} />
              </Pressable>
            ))}
          </View>
          <View style={{ padding: 14, gap: 2 }}>
            <Text style={type.title}>
              {meal.name} + {drink.name}
            </Text>
            <Text style={type.muted}>{line}. Tap either photo for its recipe.</Text>
          </View>
        </View>
      </View>
    </>
  );
}

const PICK_HEIGHT = 190;

const create_styles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    pad: { paddingHorizontal: 20 },
    badge: {
      alignSelf: "flex-start",
      marginTop: 10,
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: colors.surface,
    },
    badgeText: { color: colors.accentInk, fontSize: 13, fontWeight: "600" },
    sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 28, marginBottom: 12 },
    exploreCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 12, gap: 12 },
    collage: { flexDirection: "row", gap: 8 },
    collageCell: { borderRadius: 10, overflow: "hidden" },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    pickCard: { backgroundColor: colors.surface, borderRadius: 18, overflow: "hidden" },
    pickPhotos: { flexDirection: "row", height: PICK_HEIGHT, gap: 2 },
    recentChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 6,
      paddingRight: 14,
      borderRadius: 14,
      backgroundColor: colors.surface,
    },
    recentPhoto: { width: 44, height: 44, borderRadius: 10 },
    seeAll: { color: colors.accentInk, fontSize: 14, fontWeight: "600" },
  });
