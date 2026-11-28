import { describe, expect, it } from "vitest";
import { legal_page_urls, support_mail_url } from "../src/settings/legalLinks";
import { create_preferences, DEFAULT_PREFERENCES } from "../src/settings/preferences";
import type { KeyValueStorage } from "../src/saved/savedRecipes";
import { DARK_COLORS, LIGHT_COLORS } from "../src/ui/palette";

function memory() {
  const data = new Map<string, string>();
  const storage: KeyValueStorage = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
  };
  return { data, storage };
}
describe("settings persistence", () => {
  it("keeps existing behavior until a preference is saved", async () => {
    const { storage } = memory();
    expect(await create_preferences(storage, "a").load()).toEqual(DEFAULT_PREFERENCES);
  });
  it("survives restart and keeps accounts separate", async () => {
    const { storage } = memory();
    await create_preferences(storage, "a").save({ pausePhotoWall: true, saveCoverPhotos: false, appearance: "system", accent: "coral" });
    expect(await create_preferences(storage, "a").load()).toEqual({
      pausePhotoWall: true,
      saveCoverPhotos: false,
      appearance: "system",
      accent: "coral",
    });
    expect(await create_preferences(storage, "b").load()).toEqual(DEFAULT_PREFERENCES);
  });
  it("ignores unknown fields and defaults invalid individual values", async () => {
    const { storage, data } = memory();
    data.set("mealsandmixers.preferences.v1.a", JSON.stringify({ pausePhotoWall: "false", saveCoverPhotos: false, extra: 1 }));
    expect(await create_preferences(storage, "a").load()).toEqual({
      pausePhotoWall: false,
      saveCoverPhotos: false,
      appearance: "system",
      accent: "coral",
    });
  });
  it("reports unreadable data instead of silently overwriting it", async () => {
    const { storage, data } = memory();
    data.set("mealsandmixers.preferences.v1.a", "{broken");
    await expect(create_preferences(storage, "a").load()).rejects.toThrow();
    data.set("mealsandmixers.preferences.v1.a", "null");
    await expect(create_preferences(storage, "a").load()).rejects.toThrow();
  });
  it("propagates storage failures and leaves the prior saved choice intact", async () => {
    const { storage } = memory();
    const store = create_preferences(storage, "a");
    await store.save({ pausePhotoWall: true, saveCoverPhotos: true, appearance: "system", accent: "coral" });
    const failed = create_preferences(
      {
        ...storage,
        setItem: async () => {
          throw new Error("disk full");
        },
      },
      "a",
    );
    await expect(failed.save({ pausePhotoWall: false, saveCoverPhotos: false, appearance: "system", accent: "coral" })).rejects.toThrow(
      "disk full",
    );
    expect(await store.load()).toEqual({ pausePhotoWall: true, saveCoverPhotos: true, appearance: "system", accent: "coral" });
    await expect(
      create_preferences(
        {
          ...storage,
          getItem: async () => {
            throw new Error("unavailable");
          },
        },
        "a",
      ).load(),
    ).rejects.toThrow("unavailable");
  });
});

describe("appearance", () => {
  it("defaults to matching the phone and ignores unknown values", async () => {
    const { storage, data } = memory();
    expect((await create_preferences(storage, "a").load()).appearance).toBe("system");
    data.set("mealsandmixers.preferences.v1.a", JSON.stringify({ appearance: "purple" }));
    expect((await create_preferences(storage, "a").load()).appearance).toBe("system");
    await create_preferences(storage, "a").save({ ...DEFAULT_PREFERENCES, appearance: "light" });
    expect((await create_preferences(storage, "a").load()).appearance).toBe("light");
  });

  it("has a light and a dark theme with the same colour names", () => {
    expect(LIGHT_COLORS.background).not.toBe(DARK_COLORS.background);
    expect(Object.keys(LIGHT_COLORS).sort()).toEqual(Object.keys(DARK_COLORS).sort());
  });
});

describe("legal links", () => {
  it("builds the privacy and terms addresses from the server address", () => {
    expect(legal_page_urls("https://api.example.test/")).toEqual({
      privacy: "https://api.example.test/privacy",
      terms: "https://api.example.test/terms",
    });
    expect(legal_page_urls(undefined)).toBeNull();
    expect(support_mail_url()).toBe("mailto:turelapps@gmail.com?subject=Relish%20support");
  });
});

describe("button color", async () => {
  const { palette_for, LIGHT_COLORS, DARK_COLORS } = await import("../src/ui/palette");
  it("keeps coral by default and only changes the accent colours for blue", () => {
    expect(palette_for("light")).toBe(LIGHT_COLORS);
    expect(palette_for("dark", "coral")).toBe(DARK_COLORS);
    const blue = palette_for("light", "blue");
    expect(blue.accent).toBe("#2563EB");
    expect(blue.accentText).toBe("#FFFFFF");
    expect({ ...blue, accent: "", accentText: "", accentInk: "", accentTint: "" }).toEqual({
      ...LIGHT_COLORS,
      accent: "",
      accentText: "",
      accentInk: "",
      accentTint: "",
    });
  });
  it("falls back to coral when the saved choice is unreadable", async () => {
    const data = new Map([["mealsandmixers.preferences.v1.a", JSON.stringify({ accent: "purple" })]]);
    const storage = {
      getItem: async (key: string) => data.get(key) ?? null,
      setItem: async (key: string, value: string) => void data.set(key, value),
      removeItem: async (key: string) => void data.delete(key),
    };
    expect((await create_preferences(storage, "a").load()).accent).toBe("coral");
  });
});
