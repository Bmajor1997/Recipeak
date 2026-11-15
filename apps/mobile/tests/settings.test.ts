import { describe, expect, it } from "vitest";
import { createPreferences, DEFAULT_PREFERENCES } from "../src/settings/preferences";
import type { KeyValueStorage } from "../src/saved/savedRecipes";

function memory() {
  const data = new Map<string, string>();
  const storage: KeyValueStorage = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
  };
  return { data, storage };
}
describe("settings persistence", () => {
  it("keeps existing behavior until a preference is saved", async () => {
    const { storage } = memory();
    expect(await createPreferences(storage, "a").load()).toEqual(DEFAULT_PREFERENCES);
  });
  it("survives restart and keeps accounts separate", async () => {
    const { storage } = memory();
    await createPreferences(storage, "a").save({ pausePhotoWall: true, saveCoverPhotos: false });
    expect(await createPreferences(storage, "a").load()).toEqual({ pausePhotoWall: true, saveCoverPhotos: false });
    expect(await createPreferences(storage, "b").load()).toEqual(DEFAULT_PREFERENCES);
  });
  it("ignores unknown fields and defaults invalid individual values", async () => {
    const { storage, data } = memory();
    data.set("mealsandmixers.preferences.v1.a", JSON.stringify({ pausePhotoWall: "false", saveCoverPhotos: false, extra: 1 }));
    expect(await createPreferences(storage, "a").load()).toEqual({ pausePhotoWall: false, saveCoverPhotos: false });
  });
  it("reports unreadable data instead of silently overwriting it", async () => {
    const { storage, data } = memory();
    data.set("mealsandmixers.preferences.v1.a", "{broken");
    await expect(createPreferences(storage, "a").load()).rejects.toThrow();
    data.set("mealsandmixers.preferences.v1.a", "null");
    await expect(createPreferences(storage, "a").load()).rejects.toThrow();
  });
  it("propagates storage failures and leaves the prior saved choice intact", async () => {
    const { storage } = memory();
    const store = createPreferences(storage, "a");
    await store.save({ pausePhotoWall: true, saveCoverPhotos: true });
    const failed = createPreferences(
      {
        ...storage,
        setItem: async () => {
          throw new Error("disk full");
        },
      },
      "a",
    );
    await expect(failed.save({ pausePhotoWall: false, saveCoverPhotos: false })).rejects.toThrow("disk full");
    expect(await store.load()).toEqual({ pausePhotoWall: true, saveCoverPhotos: true });
    await expect(
      createPreferences(
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
