import { describe, expect, it } from "vitest";
import { create_ratings, rating_key, tags_for } from "../src/recipes/ratings";

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k: string) => data.get(k) ?? null,
    setItem: async (k: string, v: string) => void data.set(k, v),
    removeItem: async (k: string) => void data.delete(k),
  };
}

const input = { stars: 4, made: true, tags: ["too_salty" as const], note: "  Lovely broth.  " };

describe("recipe ratings", () => {
  it("keeps one rating per dish and sends it", async () => {
    const sent: unknown[] = [];
    const ratings = create_ratings(memory(), "alice", async (r) => void sent.push(r));
    expect(await ratings.rate("meal", "Beef Pho", input)).toBe(true);
    expect(await ratings.rate("meal", "beef pho", { ...input, stars: 5 })).toBe(true);
    expect(sent).toHaveLength(2);
    expect(await ratings.get("meal", "BEEF PHO")).toMatchObject({ stars: 5, note: "Lovely broth.", sent: true });
  });

  it("keeps a rating made offline and sends it later", async () => {
    const storage = memory();
    let online = false;
    const sent: unknown[] = [];
    const ratings = create_ratings(storage, "bob", async (r) => {
      if (!online) throw new Error("offline");
      sent.push(r);
    });
    expect(await ratings.rate("cocktail", "Mojito", input)).toBe(false);
    expect((await ratings.get("cocktail", "Mojito"))?.sent).toBe(false);
    online = true;
    await ratings.send_pending();
    expect(sent).toHaveLength(1);
    expect((await ratings.get("cocktail", "Mojito"))?.sent).toBe(true);
  });

  it("keeps each account's ratings apart and ignores damaged data", async () => {
    const storage = memory();
    await create_ratings(storage, "alice", async () => {}).rate("meal", "Pho", input);
    expect(await create_ratings(storage, "bob", async () => {}).get("meal", "Pho")).toBeNull();
    storage.data.set("mealsandmixers.ratings.v1.carol", JSON.stringify({ [rating_key("meal", "Pho")]: { stars: 9, made: true } }));
    expect(await create_ratings(storage, "carol", async () => {}).get("meal", "Pho")).toBeNull();
  });

  it("offers tags that fit meals and drinks", () => {
    expect(tags_for("meal")).not.toContain("too_strong");
    expect(tags_for("cocktail")).not.toContain("took_longer");
  });
});
