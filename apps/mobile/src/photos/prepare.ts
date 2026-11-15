// Shrinks a photo before upload: faster on mobile data, cheaper to process, and well under the server's 4 MB limit.
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export const MAX_PHOTO_EDGE = 1280;

/** Returns the upload (a JPEG data URL) and a file of the same smaller photo, for keeping with a saved recipe. */
export async function preparePhoto(uri: string, width: number, height: number): Promise<{ dataUrl: string; fileUri: string }> {
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_PHOTO_EDGE) {
    context.resize(width >= height ? { width: MAX_PHOTO_EDGE } : { height: MAX_PHOTO_EDGE });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!result.base64) throw new Error("The photo could not be prepared.");
  return { dataUrl: `data:image/jpeg;base64,${result.base64}`, fileUri: result.uri };
}
