import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { usePreferences } from "../settings/PreferencesProvider";
import { useOpenWallDish } from "../recipes/useOpenWallDish";
import { colors, fonts, type } from "./theme";
import { row_motion, WALL_GAP, WALL_TILE } from "./wallMotion";
import { CURATED_COUNT, WALL_ROWS, type WallPhoto } from "./wallPhotos";

/** Turns on the wall's motion unless the phone's "reduce motion" setting is on. */
function useReduceMotion() {
  const [reduce, set_reduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then(
      (on) => live && set_reduce(on),
      () => undefined,
    );
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", set_reduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

function Row({
  photos,
  reverse,
  still,
  onOpen,
}: {
  photos: WallPhoto[];
  reverse: boolean;
  still: boolean;
  onOpen: (dish: WallPhoto) => void;
}) {
  const motion = row_motion(photos.length, reverse);
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (still) {
      progress.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: motion.durationMs, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, still, motion.durationMs]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [motion.from, motion.to] });
  return (
    <Animated.View style={[styles.row, { transform: [{ translateX }] }]}>
      {[...photos, ...photos].map((dish, i) => {
        // The second copy only exists to make the loop seamless, so screen readers skip it.
        const copy = i >= photos.length;
        return (
          <Pressable
            key={i}
            onPress={() => onOpen(dish)}
            accessible={!copy}
            importantForAccessibility={copy ? "no-hide-descendants" : "auto"}
            accessibilityRole="button"
            accessibilityLabel={`${dish.name}. Open the recipe.`}
            style={({ pressed }) => pressed && { transform: [{ scale: 0.95 }], opacity: 0.85 }}
          >
            <Image source={dish.source} style={styles.tile} />
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

/** Two rows of dishes and drinks drifting past in opposite directions, like a menu going by. Tap one to open its recipe. */
export function PhotoWall() {
  const systemReduceMotion = useReduceMotion();
  const preferences = usePreferences();
  const still = systemReduceMotion || !preferences.ready || preferences.values.pausePhotoWall;
  const open = useOpenWallDish();
  return (
    <View style={styles.wall}>
      <View style={{ marginLeft: -40 }}>
        <Row photos={WALL_ROWS[0]} reverse={false} still={still} onOpen={open} />
      </View>
      <View style={{ marginLeft: -100 }}>
        <Row photos={WALL_ROWS[1]} reverse still={still} onOpen={open} />
      </View>
      <LinearGradient colors={["rgba(15,15,16,0)", colors.background]} locations={[0, 0.75]} style={styles.fade} pointerEvents="none" />
      <View style={styles.caption} pointerEvents="none">
        <Text style={styles.captionTitle}>{CURATED_COUNT} meals and drinks, and counting</Text>
        <Text style={type.muted}>Tap one for the recipe, or snap your own</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wall: { height: 300, marginTop: 18, overflow: "hidden" },
  row: { flexDirection: "row", gap: WALL_GAP, marginBottom: WALL_GAP },
  tile: { width: WALL_TILE, height: WALL_TILE, borderRadius: 16, backgroundColor: colors.surface },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 120 },
  caption: { position: "absolute", left: 20, right: 20, bottom: 14 },
  captionTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.display },
});
