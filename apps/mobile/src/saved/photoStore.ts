// Cover photos of saved recipes are kept on this phone, in the app's private storage, so Saved works offline.
// They are the shared library photos from the server, never the person's own photo.
import { Directory, File, Paths } from "expo-file-system";

const folder = () => {
  const dir = new Directory(Paths.document, "recipe-photos");
  dir.create({ intermediates: true, idempotent: true });
  return dir;
};

/** Downloads (or copies) a cover photo into private storage and returns its address on the phone. */
export async function keep_photo(sourceUri: string, id: string): Promise<string> {
  const destination = new File(folder(), `${id.replace(/[^a-zA-Z0-9-]/g, "")}.jpg`);
  if (destination.exists) destination.delete();
  if (/^https?:\/\//.test(sourceUri)) await File.downloadFileAsync(sourceUri, destination, { idempotent: true });
  else await new File(sourceUri).copy(destination);
  return destination.uri;
}

/** Deletes a kept photo. Only touches files inside the app's own photo folder. */
export function remove_photo(uri: string): void {
  try {
    const file = new File(uri);
    if (file.uri.startsWith(folder().uri) && file.exists) file.delete();
  } catch {
    // Already gone; nothing to clean up.
  }
}
