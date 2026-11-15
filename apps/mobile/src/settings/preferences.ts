import type { KeyValueStorage } from "../saved/savedRecipes";

export type Preferences = { pausePhotoWall: boolean; saveCoverPhotos: boolean };
export const DEFAULT_PREFERENCES: Preferences = { pausePhotoWall: false, saveCoverPhotos: true };

/** Preferences belong to this sign-in on this device; saved recipes remain device-wide. */
export function create_preferences(storage: KeyValueStorage, uid: string) {
  const key = `mealsandmixers.preferences.v1.${encodeURIComponent(uid)}`;
  return {
    async load(): Promise<Preferences> {
      const raw = await storage.getItem(key);
      if (!raw) return { ...DEFAULT_PREFERENCES };
      const data: unknown = JSON.parse(raw);
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid preferences");
      const value = data as Record<string, unknown>;
      return {
        pausePhotoWall: typeof value.pausePhotoWall === "boolean" ? value.pausePhotoWall : false,
        saveCoverPhotos: typeof value.saveCoverPhotos === "boolean" ? value.saveCoverPhotos : true,
      };
    },
    async save(value: Preferences): Promise<void> {
      await storage.setItem(key, JSON.stringify(value));
    },
  };
}
