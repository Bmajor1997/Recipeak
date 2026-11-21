import type { KeyValueStorage } from "../saved/savedRecipes";
import { ACCENT_COLORS, type AccentColor } from "../ui/palette";

/** Light or dark look: "system" follows the phone's own setting. */
export type Appearance = "system" | "light" | "dark";
export const APPEARANCES: Appearance[] = ["system", "light", "dark"];

export type Preferences = { pausePhotoWall: boolean; saveCoverPhotos: boolean; appearance: Appearance; accent: AccentColor };
export const DEFAULT_PREFERENCES: Preferences = { pausePhotoWall: false, saveCoverPhotos: true, appearance: "system", accent: "coral" };

const is_appearance = (value: unknown): value is Appearance => APPEARANCES.includes(value as Appearance);
const is_accent = (value: unknown): value is AccentColor => ACCENT_COLORS.includes(value as AccentColor);

/** Preferences belong to this sign-in on this device, like saved recipes. */
export const preferences_storage_name = (uid: string) => `mealsandmixers.preferences.v1.${encodeURIComponent(uid)}`;

export function create_preferences(storage: KeyValueStorage, uid: string) {
  const key = preferences_storage_name(uid);
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
        appearance: is_appearance(value.appearance) ? value.appearance : "system",
        accent: is_accent(value.accent) ? value.accent : "coral",
      };
    },
    async save(value: Preferences): Promise<void> {
      await storage.setItem(key, JSON.stringify(value));
    },
  };
}
