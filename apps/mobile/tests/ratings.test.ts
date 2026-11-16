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
  it("keeps one rating per dish on the phone and sends it", async () => {
    const sent: unknown[] = [];
    const ratings = create_ratings(memory(), "alice", async (r) => void sent.push(r));
    await ratings.save("meal", "Beef Pho", input);
    await ratings.save("meal", "beef pho", { ...input, stars: 5 });
    expect(await ratings.get("meal", "BEEF PHO")).toMatchObject({ stars: 5, note: "Lovely broth.", sent: false });
    await ratings.send_pending();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: "meal", dish: "beef pho", stars: 5 });
    expect((await ratings.get("meal", "Beef Pho"))?.sent).toBe(true);
  });

  it("saves at once even when the server is slow, and sends later", async () => {
    let online = false;
    const sent: unknown[] = [];
    const ratings = create_ratings(memory(), "bob", async (r) => {
      if (!online) throw new Error("offline");
      sent.push(r);
    });
    await ratings.save("cocktail", "Mojito", input);
    await ratings.send_pending();
    expect((await ratings.get("cocktail", "Mojito"))?.sent).toBe(false);
    online = true;
    await ratings.send_pending();
    expect(sent).toHaveLength(1);
    expect((await ratings.get("cocktail", "Mojito"))?.sent).toBe(true);
  });

  it("doesn't mark a rating sent if it changed while sending", async () => {
    let release: () => void = () => {};
    let clock = 0;
    const ratings = create_ratings(
      memory(),
      "dana",
      () => new Promise<void>((r) => (release = r)),
      () => new Date(++clock * 1000),
    );
    await ratings.save("meal", "Pho", input);
    const sending = ratings.send_pending();
    await new Promise((r) => setTimeout(r, 0));
    await ratings.save("meal", "Pho", { ...input, stars: 1 });
    release();
    await sending;
    expect(await ratings.get("meal", "Pho")).toMatchObject({ stars: 1, sent: false });
  });

  it("keeps each account's ratings apart and ignores damaged data", async () => {
    const storage = memory();
    await create_ratings(storage, "alice", async () => {}).save("meal", "Pho", input);
    expect(await create_ratings(storage, "bob", async () => {}).get("meal", "Pho")).toBeNull();
    storage.data.set("mealsandmixers.ratings.v1.carol", JSON.stringify({ [rating_key("meal", "Pho")]: { stars: 9, made: true } }));
    expect(await create_ratings(storage, "carol", async () => {}).get("meal", "Pho")).toBeNull();
  });

  it("offers tags that fit meals and drinks", () => {
    expect(tags_for("meal")).not.toContain("too_strong");
    expect(tags_for("cocktail")).not.toContain("took_longer");
  });
});
