import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../../AppContext";
import { ApiError } from "../../api/client";
import { CameraSheet, type Photo } from "../../camera/CameraSheet";
import { preparePhoto } from "../../photos/prepare";
import { colors, type } from "../../ui/theme";

const heroArt = require("../../../assets/hero.png");

export default function HomeScreen() {
  const { api, setCurrent, user } = useApp();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [photosLeft, setPhotosLeft] = useState<number | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      api.allowance().then(
        (a) => setPhotosLeft(a.premium ? null : a.free_photos_left),
        () => setPhotosLeft(undefined),
      );
    }, [api, user]),
  );

  async function findRecipe(photo: Photo) {
    setProblem(null);
    try {
      const result = await api.identify(await preparePhoto(photo.uri, photo.width, photo.height));
      setPhotosLeft(result.premium ? null : result.free_photos_left);
      if (result.kind === "not_food") {
        // Keep the camera open so they can try again right away.
        setProblem("That doesn't look like a meal or a drink. Try again, closer up and in good light.");
        return;
      }
      setCurrent({ kind: result.kind, recipe: result.recipe, guesses: result.guesses });
      setCameraOpen(false);
      router.push("/recipe");
    } catch (error) {
      if (error instanceof ApiError && error.needsUpgrade) {
        setCameraOpen(false);
        router.push("/upgrade");
      } else setProblem(error instanceof ApiError ? error.message : "That photo couldn't be read. Please try another one.");
    }
  }

  const allowance = photosLeft == null ? null : photosLeft === 1 ? "1 free photo left" : `${photosLeft} free photos left`;

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Image source={heroArt} style={styles.art} resizeMode="contain" accessible={false} />
        <Text style={[type.title, { textAlign: "center", marginTop: 20 }]} accessibilityRole="header">
          What are you having?
        </Text>
        <Text style={[type.muted, { textAlign: "center", marginTop: 8 }]}>
          Take a photo of a meal or a cocktail and get a recipe to make it.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Camera"
        accessibilityHint="Opens the camera"
        onPress={() => {
          setProblem(null);
          setCameraOpen(true);
        }}
        style={({ pressed }) => [styles.cameraButton, pressed && { transform: [{ scale: 0.97 }] }]}
      >
        <Ionicons name="camera" size={30} color={colors.accentText} />
        <Text style={styles.cameraLabel}>Camera</Text>
      </Pressable>
      {allowance && <Text style={[type.muted, { textAlign: "center", marginTop: 12 }]}>{allowance}</Text>}

      <CameraSheet visible={cameraOpen} onClose={() => setCameraOpen(false)} onPhoto={findRecipe} message={problem} footnote={allowance} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: "center" },
  hero: { alignItems: "center", marginBottom: 36 },
  art: { width: 260, height: 208 },
  cameraButton: {
    minHeight: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraLabel: { color: colors.accentText, fontSize: 22, fontWeight: "700", marginLeft: 12 },
});
