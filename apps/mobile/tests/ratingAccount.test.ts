import { describe, expect, it } from "vitest";
import { create_api } from "../src/api/client";
import { account_token } from "../src/auth/accountToken";
import { create_ratings } from "../src/recipes/ratings";

describe("rating account isolation", () => {
  it("keeps a queued rating pending when another account signs in", async () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: async (key: string) => data.get(key) ?? null,
      setItem: async (key: string, value: string) => void data.set(key, value),
      removeItem: async (key: string) => void data.delete(key),
    };
    let user = { uid: "alice", get_token: async () => "alice-token" };
    const requests: string[] = [];
    const api = create_api({
      baseUrl: "https://example.test",
      id_token: (uid) => account_token(user, uid),
      fetch_impl: async (_url, options) => {
        requests.push((options?.headers as Record<string, string>).Authorization);
        return new Response("{}", { status: 200 });
      },
    });
    const ratings = create_ratings(storage, "alice", (input) => api.rate_recipe(input, "alice"));
    await ratings.save("meal", "Pho", { stars: 4, made: true, tags: [], note: "private" });
    user = { uid: "bob", get_token: async () => "bob-token" };
    await ratings.send_pending();
    expect(requests).toEqual([]);
    expect((await ratings.get("meal", "Pho"))?.sent).toBe(false);
    user = { uid: "alice", get_token: async () => "alice-token" };
    await ratings.send_pending();
    expect(requests).toEqual(["Bearer alice-token"]);
    expect((await ratings.get("meal", "Pho"))?.sent).toBe(true);
  });

  it("retains the captured account when the token resolves after a switch", async () => {
    let release: (token: string) => void = () => {};
    let user = { uid: "alice", get_token: () => new Promise<string>((resolve) => (release = resolve)) };
    const token = account_token(user, "alice");
    user = { uid: "bob", get_token: async () => "bob-token" };
    release("alice-token");
    expect(await token).toBe("alice-token");
    expect(await account_token(user, "alice")).toBeNull();
  });
});
