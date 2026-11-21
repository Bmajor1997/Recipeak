import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from "react-native";
import { COLLECTION } from "../recipes/collectionPhotos";
import { useReduceMotion } from "./PhotoWall";
import { useTheme } from "./theme";

/** Well-known dishes and drinks for the sign-in wall, mixed so each column has both. */
const COLUMNS = [
  ["aperol-spritz", "pho", "tiramisu", "negroni", "bibimbap"],
  ["tacos-al-pastor", "espresso-martini", "paella", "cacio-e-pepe", "cosmopolitan"],
  ["margarita", "ramen", "mojito", "shakshuka", "old-fashioned"],
];
const GAP = 8;
const SIDE = 12;
/** One full trip through a column takes this long, so the movement is slow enough to stay in the background. */
const DRIFT_MS = 60_000;

function Column({ sources, width, still, reverse }: { sources: number[]; width: number; still: boolean; reverse: boolean }) {
  const tile = Math.round(width * 1.35);
  const span = sources.length * (tile + GAP);
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.timing(progress, { toValue: 1, duration: DRIFT_MS, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [progress, still]);
  // The photos are listed twice, so the column loops without a visible jump.
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: reverse ? [-span, 0] : [0, -span] });
  return (
    <Animated.View style={{ width, gap: GAP, transform: [{ translateY: still ? (reverse ? -span / 3 : -span / 6) : translateY }] }}>
      {[...sources, ...sources].map((source, index) => (
        <Image key={index} source={source} style={{ width, height: tile, borderRadius: 16 }} accessible={false} />
      ))}
    </Animated.View>
  );
}

/**
 * The sign-in screen's background: columns of Recipeak's own cover photos drifting slowly upward and downward,
 * fading into the page behind the buttons. Decorative only: screen readers skip it, and it holds still when the
 * phone's Reduce Motion setting is on.
 */
export function SignInWall({ height }: { height: number }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const still = useReduceMotion();
  const column_width = (width - SIDE * 2 - GAP * 2) / 3;
  const sources = useMemo(() => {
    const by_id = new Map(COLLECTION.map((dish) => [dish.id, dish.source]));
    return COLUMNS.map((ids) => ids.map((id) => by_id.get(id)).filter((source): source is number => source !== undefined));
  }, []);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.wall, { height }]}
    >
      <View style={styles.columns}>
        {sources.map((column, index) => (
          <Column key={index} sources={column} width={column_width} still={still} reverse={index === 1} />
        ))}
      </View>
      <LinearGradient
        colors={[`${colors.background}00`, `${colors.background}00`, colors.background]}
        locations={[0, 0.45, 0.95]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wall: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
  columns: { flexDirection: "row", gap: GAP, paddingHorizontal: SIDE },
});
