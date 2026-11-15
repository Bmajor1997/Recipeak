import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { colors, fonts, type } from "./theme";
import { rowMotion, WALL_GAP, WALL_TILE } from "./wallMotion";
import { CURATED_COUNT, WALL_ROWS } from "./wallPhotos";

/** Turns on the wall's motion unless the phone's "reduce motion" setting is on. */
function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then(
      (on) => live && setReduce(on),
      () => undefined,
    );
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

function Row({ photos, reverse, still }: { photos: number[]; reverse: boolean; still: boolean }) {
  const motion = rowMotion(photos.length, reverse);
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
      {[...photos, ...photos].map((source, i) => (
        <Image key={i} source={source} style={styles.tile} />
      ))}
    </Animated.View>
  );
}

/** Two rows of dishes and drinks drifting past in opposite directions, like a menu going by. */
export function PhotoWall() {
  const still = useReduceMotion();
  return (
    <View style={styles.wall} accessible accessibilityLabel={`Photos of ${CURATED_COUNT} meals and drinks.`}>
      <View style={{ marginLeft: -40 }}>
        <Row photos={WALL_ROWS[0]} reverse={false} still={still} />
      </View>
      <View style={{ marginLeft: -100 }}>
        <Row photos={WALL_ROWS[1]} reverse still={still} />
      </View>
      <LinearGradient colors={["rgba(15,15,16,0)", colors.background]} locations={[0, 0.75]} style={styles.fade} pointerEvents="none" />
      <View style={styles.caption}>
        <Text style={styles.captionTitle}>{CURATED_COUNT} meals and drinks, and counting</Text>
        <Text style={type.muted}>Snap one to get the recipe</Text>
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
