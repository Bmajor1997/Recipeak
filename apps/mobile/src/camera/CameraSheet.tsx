// A camera that slides up from the bottom, modelled on the ChatGPT app's camera:
// big white shutter in the middle, back on the left, a three-dot menu on the right.
import Ionicons from "@expo/vector-icons/Ionicons";
import { type CameraType, CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, type } from "../ui/theme";
import { type FlashSetting, flashLabel, nextFlash, SHEET_CLOSE_MS, SHEET_SPRING, shouldDismiss, shutterFlash } from "./cameraOptions";

export type Photo = { uri: string; width: number; height: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called with the photo; the sheet shows it with "Finding your recipe…" until this finishes. */
  onPhoto: (photo: Photo) => Promise<void>;
  /** A problem to show inside the sheet, such as "That doesn't look like food", so people can retake straight away. */
  message?: string | null;
  /** Shown under the shutter, for example "2 free photos left". */
  footnote?: string | null;
};

export function CameraSheet({ visible, onClose, onPhoto, message, footnote }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [mounted, setMounted] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [flash, setFlash] = useState<FlashSetting>("off");
  const [facing, setFacing] = useState<CameraType>("back");
  const [ready, setReady] = useState(false);
  const [taken, setTaken] = useState<Photo | null>(null);

  // Animated values and the drag gesture are created once and kept for the sheet's lifetime.
  const [slide] = useState(() => new Animated.Value(height));
  const [backdrop] = useState(() => new Animated.Value(0));
  const [glow] = useState(() => new Animated.Value(0));
  // A drag-to-close is recorded as state, then handed to onClose after render.
  const [dragClosed, setDragClosed] = useState(0);
  useEffect(() => {
    if (dragClosed) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragClosed]);

  // When the sheet is asked to open, show it straight away with a fresh state (React's "adjust state on prop change" pattern).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setMounted(true);
      setTaken(null);
      setMenuOpen(false);
    }
  }

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion, () => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  // Open: slide up with a gentle spring (or fade in with Reduce Motion). Close: slide back down, then unmount.
  useEffect(() => {
    if (visible) {
      slide.setValue(reduceMotion ? 0 : height);
      Animated.parallel([
        reduceMotion ? Animated.delay(0) : Animated.spring(slide, { toValue: 0, useNativeDriver: true, ...SHEET_SPRING }),
        Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      return;
    }
    Animated.parallel([
      Animated.timing(slide, {
        toValue: reduceMotion ? 0 : height,
        duration: SHEET_CLOSE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, { toValue: 0, duration: SHEET_CLOSE_MS, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setMounted(false);
      setReady(false);
    });
    // Only react to opening and closing, not to every size or setting change while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Drag the sheet down to close it, like a native bottom sheet.
  const [drag] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => slide.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (shouldDismiss(g.dy, g.vy)) setDragClosed((n) => n + 1);
        else Animated.spring(slide, { toValue: 0, useNativeDriver: true, ...SHEET_SPRING }).start();
      },
    }),
  );

  function playFlash() {
    const f = shutterFlash(reduceMotion);
    glow.setValue(0);
    Animated.sequence([
      Animated.timing(glow, { toValue: f.peak, duration: f.riseMs, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: f.fadeMs, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }

  async function finish(photo: Photo) {
    setTaken(photo);
    AccessibilityInfo.announceForAccessibility("Photo taken. Finding your recipe.");
    try {
      await onPhoto(photo);
    } finally {
      setTaken(null);
    }
  }

  async function takePhoto() {
    if (!camera.current || !ready || taken) return;
    setMenuOpen(false);
    // Three signals that the photo was taken: a light tap, the shutter sound, and a soft white flash.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    playFlash();
    const photo = await camera.current.takePictureAsync({ quality: 0.9, shutterSound: true }).catch(() => null);
    if (photo) await finish({ uri: photo.uri, width: photo.width, height: photo.height });
  }

  async function chooseFromPhotos() {
    setMenuOpen(false);
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.9 });
    const asset = picked.canceled ? null : picked.assets[0];
    if (asset) await finish({ uri: asset.uri, width: asset.width, height: asset.height });
  }

  if (!mounted) return null;
  const sheetHeight = Math.min(height * 0.82, height - insets.top - 24);

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close camera" accessibilityRole="button" />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          { height: sheetHeight, bottom: insets.bottom + 12, transform: [{ translateY: slide }], opacity: reduceMotion ? backdrop : 1 },
        ]}
        {...drag.panHandlers}
      >
        <View style={styles.handle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />

        <View style={styles.preview}>
          {permission?.granted ? (
            taken ? (
              <Image
                source={{ uri: taken.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                accessibilityLabel="The photo you took"
              />
            ) : (
              <CameraView
                ref={camera}
                style={StyleSheet.absoluteFill}
                facing={facing}
                flash={flash}
                animateShutter={false}
                onCameraReady={() => setReady(true)}
                accessibilityLabel="Camera preview. Point it at a meal or a drink."
              />
            )
          ) : (
            <View style={styles.permission}>
              <Text style={[type.body, { textAlign: "center" }]}>Allow camera access to photograph a meal or a cocktail.</Text>
              <Pressable accessibilityRole="button" onPress={requestPermission} style={styles.allow}>
                <Text style={styles.allowText}>Allow camera</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={chooseFromPhotos} style={{ marginTop: 16, padding: 8 }}>
                <Text style={[type.body, { textDecorationLine: "underline" }]}>Or choose from your photos</Text>
              </Pressable>
            </View>
          )}

          {taken && (
            <View style={styles.working} accessibilityLiveRegion="polite">
              <ActivityIndicator color="#FFFFFF" size="large" />
              <Text style={[type.body, { marginTop: 12 }]}>Finding your recipe…</Text>
            </View>
          )}

          {/* The soft "photo taken" flash. Not focusable, and it never blocks touches. */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow, { opacity: glow }]} />
        </View>

        {menuOpen && (
          <View style={styles.menu} accessibilityRole="menu">
            <MenuItem icon="images-outline" label="Choose from photos" onPress={chooseFromPhotos} />
            <MenuItem icon="flash-outline" label={flashLabel(flash)} onPress={() => setFlash(nextFlash(flash))} />
            <MenuItem
              icon="camera-reverse-outline"
              label={facing === "back" ? "Use front camera" : "Use back camera"}
              onPress={() => setFacing(facing === "back" ? "front" : "back")}
            />
          </View>
        )}

        {!!message && !taken && (
          <View style={styles.message} accessibilityLiveRegion="assertive">
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        <View style={styles.controls}>
          <RoundButton icon="chevron-back" label="Close camera" onPress={onClose} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            accessibilityHint="Takes a photo and finds a recipe for it"
            accessibilityState={{ disabled: !ready || Boolean(taken) }}
            disabled={!permission?.granted || !ready || Boolean(taken)}
            onPress={takePhoto}
            style={({ pressed }) => [styles.shutterRing, pressed && { transform: [{ scale: 0.92 }] }]}
          >
            <View style={[styles.shutter, (!ready || taken) && { opacity: 0.5 }]} />
          </Pressable>
          <RoundButton
            icon="ellipsis-vertical"
            label="More options"
            hint="Choose from photos, flash, and switch camera"
            expanded={menuOpen}
            onPress={() => setMenuOpen(!menuOpen)}
          />
        </View>
        {!!footnote && <Text style={styles.footnote}>{footnote}</Text>}
      </Animated.View>
    </Modal>
  );
}

function RoundButton({
  icon,
  label,
  hint,
  expanded,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  expanded?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.round, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icon} size={30} color="#FFFFFF" />
    </Pressable>
  );
}

function MenuItem({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icon} size={24} color="#FFFFFF" />
      <Text style={styles.menuText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { position: "absolute", left: 10, right: 10, borderRadius: 32, backgroundColor: "#000000", overflow: "hidden" },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.35)",
    marginTop: 10,
    marginBottom: 8,
  },
  preview: { flex: 1, marginHorizontal: 10, borderRadius: 24, overflow: "hidden", backgroundColor: "#111111" },
  glow: { backgroundColor: "#FFFFFF" },
  working: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  permission: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center" },
  allow: {
    marginTop: 20,
    minHeight: 52,
    paddingHorizontal: 24,
    borderRadius: 26,
    backgroundColor: colors.accent,
    justifyContent: "center",
  },
  allowText: { color: colors.accentText, fontSize: 18, fontWeight: "700" },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 12,
  },
  footnote: { color: "#D9D9D9", fontSize: 15, textAlign: "center", paddingBottom: 14 },
  message: { marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: "#3A1F1A" },
  messageText: { color: colors.danger, fontSize: 17, lineHeight: 24 },
  round: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  shutterRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutter: { width: 74, height: 74, borderRadius: 37, backgroundColor: "#FFFFFF" },
  menu: { position: "absolute", right: 22, bottom: 118, minWidth: 230, borderRadius: 18, backgroundColor: "#262626", paddingVertical: 6 },
  menuItem: { flexDirection: "row", alignItems: "center", minHeight: 52, paddingHorizontal: 16 },
  menuText: { color: "#FFFFFF", fontSize: 17, marginLeft: 14 },
});
