// Photos of saved recipes stay on this phone only, in the app's private storage.
// They are never uploaded again; the server already discarded its copy.
import { Directory, File, Paths } from "expo-file-system";

const folder = () => {
  const dir = new Directory(Paths.document, "recipe-photos");
  dir.create({ intermediates: true, idempotent: true });
  return dir;
};

/** Copies a temporary photo into private storage and returns its new address. */
export async function keepPhoto(sourceUri: string, id: string): Promise<string> {
  const destination = new File(folder(), `${id.replace(/[^a-zA-Z0-9-]/g, "")}.jpg`);
  if (destination.exists) destination.delete();
  await new File(sourceUri).copy(destination);
  return destination.uri;
}

/** Deletes a kept photo. Only touches files inside the app's own photo folder. */
export function removePhoto(uri: string): void {
  try {
    const file = new File(uri);
    if (file.uri.startsWith(folder().uri) && file.exists) file.delete();
  } catch {
    // Already gone; nothing to clean up.
  }
}
