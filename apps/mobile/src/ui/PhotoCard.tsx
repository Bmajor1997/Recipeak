// A rounded photo card with the title written over the picture, in the style of CREME's cocktail cards.
// Without a photo, it shows the app's drink-and-plate art on a warm colour instead.
import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { format_minutes } from "../recipes/format";
import type { Kind } from "../recipes/types";
import { fonts } from "./theme";

const heroArt = require("../../assets/hero.png");
const FALLBACK = { meal: "#6E3B22", cocktail: "#6B2531" } as const;

export function PhotoCard({
  title,
  kind,
  minutes,
  photoUri,
  width,
  height,
  onPress,
}: {
  title: string;
  kind: Kind;
  minutes: number;
  photoUri: string | null;
  width: number;
  height: number;
  onPress: () => void;
}) {
  const label = kind === "cocktail" ? "Drink" : "Meal";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${label}. ${format_minutes(minutes)}.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { width, height, backgroundColor: FALLBACK[kind] },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={styles.fallback}>
          <Image source={heroArt} style={{ width: width * 0.8, height: width * 0.64 }} resizeMode="contain" />
        </View>
      )}
      <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.82)"]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.pill}>
        <Text style={styles.pillText}>{label}</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.meta}>{format_minutes(minutes)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, overflow: "hidden" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 30 },
  pill: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
  footer: { position: "absolute", left: 12, right: 12, bottom: 12 },
  title: { color: "#FFFFFF", fontSize: 15, lineHeight: 19, fontFamily: fonts.display },
  meta: { color: "#D4D4D8", fontSize: 12, marginTop: 2 },
});
