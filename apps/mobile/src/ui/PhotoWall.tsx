import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { usePreferences } from "../settings/PreferencesProvider";
import { useTips } from "../tips/TipsProvider";
import { TipBubble } from "./TipBubble";
import { useOpenWallDish } from "../recipes/useOpenWallDish";
import { fonts, useTheme, useThemedStyles, type Palette } from "./theme";
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
  held,
  on_hold,
  onOpen,
}: {
  photos: WallPhoto[];
  reverse: boolean;
  still: boolean;
  /** A finger is on the wall: both rows pause where they are, so a photo is easy to tap. */
  held: boolean;
  on_hold: (down: boolean) => void;
  onOpen: (dish: WallPhoto) => void;
}) {
  const styles = useThemedStyles(create_styles);
  const motion = row_motion(photos.length, reverse);
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (still) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }
    if (held) {
      progress.stopAnimation();
      return;
    }
    // Carry on from wherever the row stopped, then loop as usual.
    let live = true;
    let running: Animated.CompositeAnimation | null = null;
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: motion.durationMs, easing: Easing.linear, useNativeDriver: true }),
    );
    progress.stopAnimation((value) => {
      if (!live) return;
      const left = 1 - value;
      if (value <= 0 || left <= 0) {
        progress.setValue(0);
        running = loop;
        loop.start();
        return;
      }
      running = Animated.timing(progress, {
        toValue: 1,
        duration: motion.durationMs * left,
        easing: Easing.linear,
        useNativeDriver: true,
      });
      running.start(({ finished }) => {
        if (!finished || !live) return;
        progress.setValue(0);
        running = loop;
        loop.start();
      });
    });
    return () => {
      live = false;
      running?.stop();
    };
  }, [progress, still, held, motion.durationMs]);

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
            onPressIn={() => on_hold(true)}
            onPressOut={() => on_hold(false)}
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
  const { type } = useTheme();
  const styles = useThemedStyles(create_styles);
  const systemReduceMotion = useReduceMotion();
  const preferences = usePreferences();
  const still = systemReduceMotion || !preferences.ready || preferences.values.pausePhotoWall;
  const open_dish = useOpenWallDish();
  const tips = useTips();
  const [held, set_held] = useState(false);
  const open = (dish: WallPhoto) => {
    tips.mark_seen("photo-wall");
    open_dish(dish);
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.wall}>
        <View style={{ marginLeft: -40 }}>
          <Row photos={WALL_ROWS[0]} reverse={false} still={still} held={held} on_hold={set_held} onOpen={open} />
        </View>
        <View style={{ marginLeft: -100 }}>
          <Row photos={WALL_ROWS[1]} reverse still={still} held={held} on_hold={set_held} onOpen={open} />
        </View>
      </View>
      {tips.is_due("photo-wall") && (
        <TipBubble text="Tap any photo to see its recipe." arrow="up" on_dismiss={() => tips.mark_seen("photo-wall")} style={styles.tip} />
      )}
      <View style={styles.caption}>
        <Text style={styles.captionTitle}>{CURATED_COUNT} meals and drinks, and counting</Text>
        <Text style={type.muted}>Tap one for the recipe, or snap your own</Text>
      </View>
    </View>
  );
}

const create_styles = (colors: Palette) =>
  StyleSheet.create({
    wrap: { marginTop: 18 },
    wall: { height: 2 * WALL_TILE + WALL_GAP, overflow: "hidden" },
    row: { flexDirection: "row", gap: WALL_GAP, marginBottom: WALL_GAP },
    tile: { width: WALL_TILE, height: WALL_TILE, borderRadius: 16, backgroundColor: colors.surface },
    caption: { paddingHorizontal: 20, marginTop: 12 },
    tip: { marginHorizontal: 16, marginTop: 10 },
    captionTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.display },
  });
