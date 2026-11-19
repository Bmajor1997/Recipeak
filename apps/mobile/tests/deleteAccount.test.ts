import { describe, expect, it } from "vitest";
import { clear_account_device_data, delete_account, delete_account_problem } from "../src/auth/deleteAccount";
import { saved_storage_name } from "../src/saved/savedRecipes";

function memory_storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => void data.set(key, value),
    removeItem: async (key: string) => void data.delete(key),
  };
}

describe("delete_account", () => {
  it("checks the password, then deletes server data, the sign-in and this phone's copy, in that order", async () => {
    const order: string[] = [];
    await delete_account("secret", {
      confirm_password: async (p) => void order.push(`password:${p}`),
      delete_server_data: async () => void order.push("server"),
      delete_sign_in: async () => void order.push("sign-in"),
      clear_device: async () => void order.push("device"),
    });
    expect(order).toEqual(["password:secret", "server", "sign-in", "device"]);
  });

  it("stops before deleting anything when the password is wrong", async () => {
    const order: string[] = [];
    const wrong = Object.assign(new Error("bad"), { code: "auth/wrong-password" });
    const attempt = delete_account("nope", {
      confirm_password: async () => {
        throw wrong;
      },
      delete_server_data: async () => void order.push("server"),
      delete_sign_in: async () => void order.push("sign-in"),
      clear_device: async () => void order.push("device"),
    });
    await expect(attempt).rejects.toBe(wrong);
    expect(order).toEqual([]);
    expect(delete_account_problem(wrong)).toBe("That password isn't right. Try again.");
  });

  it("clears only the deleted account's data from the phone, photos included", async () => {
    const saved = [
      {
        id: "a",
        saved_at: "2026-11-19T00:00:00.000Z",
        kind: "meal",
        recipe: {
          title: "Soup",
          description: "",
          servings: 2,
          prep_minutes: 5,
          cook_minutes: 10,
          ingredients: [],
          steps: ["Cook."],
          allergens: [],
          note: "",
        },
        photo_uri: "file:///photos/a.jpg",
      },
    ];
    const storage = memory_storage({
      [saved_storage_name("gone")]: JSON.stringify(saved),
      "mealsandmixers.ratings.v1.gone": "{}",
      "mealsandmixers.recent.v1.gone": "[]",
      "mealsandmixers.preferences.v1.gone": "{}",
      [saved_storage_name("other")]: "[]",
    });
    const removed: string[] = [];
    await clear_account_device_data(storage, "gone", (uri) => removed.push(uri));
    expect([...storage.data.keys()]).toEqual([saved_storage_name("other")]);
    expect(removed).toEqual(["file:///photos/a.jpg"]);
  });
});
