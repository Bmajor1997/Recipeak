// A rounded photo card with the title written over the picture, in the style of CREME's cocktail cards.
// Without a photo, it shows the app's drink-and-plate art on a warm colour instead.
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
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
  photoSource,
  fallbackUri = null,
  width,
  height,
  onPress,
}: {
  title: string;
  kind: Kind;
  minutes: number;
  photoUri: string | null;
  /** A photo bundled with the app, used instead of photoUri. */
  photoSource?: number | null;
  /** Tried when photoUri can't be shown (a kept copy that's gone), before the app's art. */
  fallbackUri?: string | null;
  width: number;
  height: number;
  onPress: () => void;
}) {
  // Said by screen readers only: the photo already shows whether it is a meal or a drink (Ben, 2026-11-20).
  const label = kind === "cocktail" ? "Drink" : "Meal";
  // Addresses that failed to load, so a missing photo falls back instead of leaving an empty card.
  const [failed, set_failed] = useState<string[]>([]);
  const uri = [photoUri, fallbackUri].find((u): u is string => !!u && !failed.includes(u)) ?? null;
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
      {photoSource ? (
        <Image source={photoSource} style={[StyleSheet.absoluteFill, { width, height }]} resizeMode="cover" />
      ) : uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => set_failed((list) => [...list, uri])} />
      ) : (
        <View style={styles.fallback}>
          <Image source={heroArt} style={{ width: width * 0.8, height: width * 0.64 }} resizeMode="contain" />
        </View>
      )}
      <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.82)"]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
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
  footer: { position: "absolute", left: 12, right: 12, bottom: 12 },
  title: { color: "#FFFFFF", fontSize: 15, lineHeight: 19, fontFamily: fonts.display },
  meta: { color: "#D4D4D8", fontSize: 12, marginTop: 2 },
});
