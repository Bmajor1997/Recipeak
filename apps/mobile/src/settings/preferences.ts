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

/** The look of the app (light, dark or match phone, and the button colour): the part of the preferences shown even
 * when nobody is signed in, such as on the start and sign-in screens. */
export type Look = Pick<Preferences, "appearance" | "accent">;
/** The last signed-in account's look, kept on the device so signing out (or opening the app signed out) keeps it. */
export const DEVICE_LOOK_KEY = "mealsandmixers.look.v1";

export function create_device_look(storage: KeyValueStorage) {
  return {
    async load(): Promise<Look | null> {
      try {
        const data: unknown = JSON.parse((await storage.getItem(DEVICE_LOOK_KEY)) ?? "null");
        if (!data || typeof data !== "object" || Array.isArray(data)) return null;
        const value = data as Record<string, unknown>;
        if (!is_appearance(value.appearance)) return null;
        return { appearance: value.appearance, accent: is_accent(value.accent) ? value.accent : "coral" };
      } catch {
        return null;
      }
    },
    async save(look: Look): Promise<void> {
      await storage.setItem(DEVICE_LOOK_KEY, JSON.stringify({ appearance: look.appearance, accent: look.accent }));
    },
  };
}
