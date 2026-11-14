import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useApp } from "../../AppContext";
import { ApiError } from "../../api/client";
import { preparePhoto } from "../../photos/prepare";
import { Button, colors, Notice, type } from "../../ui/theme";

export default function CameraScreen() {
  const { api, setCurrent, user } = useApp();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
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

  async function findRecipe(uri: string, width: number, height: number) {
    setBusy(true);
    setProblem(null);
    try {
      const result = await api.identify(await preparePhoto(uri, width, height));
      setPhotosLeft(result.premium ? null : result.free_photos_left);
      if (result.kind === "not_food") {
        setProblem("That doesn't look like a meal or a drink. Try another photo, closer up and in good light.");
        return;
      }
      setCurrent({ kind: result.kind, recipe: result.recipe, guesses: result.guesses });
      router.push("/recipe");
    } catch (error) {
      if (error instanceof ApiError && error.needsUpgrade) router.push("/upgrade");
      else setProblem(error instanceof ApiError ? error.message : "That photo couldn't be read. Please try another one.");
    } finally {
      setBusy(false);
    }
  }

  async function takePhoto() {
    const photo = await camera.current?.takePictureAsync({ quality: 0.9, shutterSound: false });
    if (photo) await findRecipe(photo.uri, photo.width, photo.height);
  }

  async function choosePhoto() {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.9 });
    const asset = picked.canceled ? null : picked.assets[0];
    if (asset) await findRecipe(asset.uri, asset.width, asset.height);
  }

  const allowanceText =
    photosLeft === null
      ? null
      : photosLeft === undefined
        ? null
        : photosLeft === 1
          ? "1 free photo left"
          : `${photosLeft} free photos left`;

  return (
    <View style={styles.screen}>
      <View style={styles.preview}>
        {permission?.granted ? (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" accessibilityLabel="Camera preview" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={[type.body, { textAlign: "center" }]}>Allow camera access to photograph a meal or a cocktail.</Text>
            <Button label="Allow camera" onPress={requestPermission} />
          </View>
        )}
      </View>
      <View style={styles.controls}>
        {allowanceText && <Text style={type.muted}>{allowanceText}</Text>}
        {problem && <Notice tone="error">{problem}</Notice>}
        {busy && <Notice>Finding your recipe… this can take a few seconds.</Notice>}
        <Button
          label="Take photo"
          onPress={takePhoto}
          busy={busy}
          disabled={!permission?.granted}
          hint="Takes a photo and finds a recipe for it"
        />
        <Button label="Choose from gallery" variant="secondary" onPress={choosePhoto} disabled={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  preview: { flex: 1, margin: 16, borderRadius: 20, overflow: "hidden", backgroundColor: colors.surface },
  placeholder: { flex: 1, padding: 24, justifyContent: "center" },
  controls: { paddingHorizontal: 16, paddingBottom: 16 },
});
