import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../AppContext";
import { photosLeftText, useCamera } from "../../camera/CameraProvider";
import { NO_IMAGE, type SavedRecipe } from "../../recipes/types";
import { totalMinutes } from "../../recipes/search";
import { greeting } from "../../ui/greeting";
import { PhotoCard } from "../../ui/PhotoCard";
import { colors, type } from "../../ui/theme";

const heroArt = require("../../../assets/hero.png");

export default function HomeScreen() {
  const { saved, setCurrent } = useApp();
  const { photosLeft, refreshAllowance } = useCamera();
  const insets = useSafeAreaInsets();
  const [recent, setRecent] = useState<SavedRecipe[]>([]);

  useFocusEffect(
    useCallback(() => {
      refreshAllowance();
      saved.list().then(
        (list) => setRecent(list.slice(0, 8)),
        () => setRecent([]),
      );
    }, [saved, refreshAllowance]),
  );

  const allowance = photosLeftText(photosLeft);
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

      <Image source={heroArt} style={styles.art} resizeMode="contain" accessible={false} />

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
            renderItem={({ item }) => (
              <PhotoCard
                title={item.recipe.title}
                kind={item.kind}
                minutes={totalMinutes(item)}
                photoUri={item.photo_uri}
                width={160}
                height={200}
                onPress={() => {
                  setCurrent({
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
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  pad: { paddingHorizontal: 20 },
  art: { width: 300, height: 240, alignSelf: "center", marginVertical: 8 },
  badge: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  badgeText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 28, marginBottom: 12 },
  seeAll: { color: colors.accent, fontSize: 14, fontWeight: "600" },
});
