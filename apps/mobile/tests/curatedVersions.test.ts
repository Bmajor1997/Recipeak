// Every bundled cocktail's written alcohol-free version can be shown without the AI, and never drops an allergen.
import { describe, expect, it } from "vitest";
import recipes from "../src/recipes/collection.json";
import { COLLECTION } from "../src/recipes/collectionPhotos";
import { curated_non_alcoholic, curated_version } from "../src/recipes/curatedVersions";
import { parse_recipe } from "../src/recipes/parse";
import { camera_area } from "../src/camera/cameraOptions";

const SPIRITS =
  /\b(?:vodka|gin|rum|tequila|mezcal|whiske?y|bourbon|rye|scotch|brandy|cognac|vermouth|liqueur|campari|aperol|prosecco|champagne|wine|beer|absinthe|amaro|sake|pisco|cacha[cç]a)\b/i;

describe("written non-alcoholic versions", () => {
  const cocktails = COLLECTION.filter((d) => d.kind === "cocktail").map((d) => parse_recipe((recipes as Record<string, unknown>)[d.id]));
  const written = cocktails.filter((r) => r.cocktail?.alcoholic && r.cocktail.non_alcoholic_version);

  it("covers the bundled cocktails that have one, including the Gimlet", () => {
    expect(written.length).toBeGreaterThan(100);
    expect(written.map((r) => r.title)).toContain("Gimlet");
  });

  it("is a full alcohol-free recipe for each, keeping every allergen of the regular drink", () => {
    for (const regular of written) {
      const version = curated_non_alcoholic(regular)!;
      expect(version.title).toBe(`${regular.title} (non-alcoholic)`);
      expect(version.cocktail).toMatchObject({ alcoholic: false, non_alcoholic_version: null });
      expect(version.steps.join(" ")).toContain(regular.cocktail!.non_alcoholic_version!.slice(1, 20));
      for (const allergen of regular.allergens) expect(version.allergens).toContain(allergen);
    }
  });

  it("removes or swaps the spirit a change names, and adds allergens a new drink brings", () => {
    const gimlet = written.find((r) => r.title === "Gimlet")!;
    const na = curated_version(gimlet, "non-alcoholic")!;
    expect(na.ingredients).toEqual([]);
    expect(na.steps).toEqual(["Shake lime juice, syrup and a few cucumber slices and top with tonic water."]);
    const sour = {
      ...gimlet,
      title: "Sour",
      cocktail: { ...gimlet.cocktail!, non_alcoholic_version: "Shake lemon, orgeat and an egg white." },
    };
    expect(curated_non_alcoholic(sour)!.allergens).toEqual(expect.arrayContaining(["tree nuts", "eggs"]));
    const changes = written.filter((r) => /^(?:replace|leave out|omit|skip)\b/i.test(r.cocktail!.non_alcoholic_version!.trim()));
    expect(changes.length).toBeGreaterThan(0);
    for (const regular of changes) {
      const version = curated_non_alcoholic(regular)!;
      const named = /\b(?:replace|leave out|omit|skip)(?: the)? ([a-z' -]+?)(?:[;.,]| with\b| for\b| and\b|$)/i.exec(
        regular.cocktail!.non_alcoholic_version!,
      )![1];
      for (const i of version.ingredients) if (SPIRITS.test(named)) expect(i.item.toLowerCase()).not.toBe(named.toLowerCase());
    }
  });

  it("isn't offered for drinks without a written version, or for other diets", () => {
    const plain = written[0];
    expect(curated_non_alcoholic({ ...plain, cocktail: { ...plain.cocktail!, non_alcoholic_version: null } })).toBeNull();
    expect(curated_version(plain, "low-carb")).toBeNull();
  });
});

describe("camera area", () => {
  const base = {
    permission: { granted: true, canAskAgain: true },
    taken: false,
    active: true,
    ready: false,
    failed: false,
    timed_out: false,
  };
  it("never leaves a black preview: starting, ready, failed, timed out, background and permissions each say what's happening", () => {
    expect(camera_area({ ...base, permission: null })).toBe("checking");
    expect(camera_area({ ...base, permission: { granted: false, canAskAgain: true } })).toBe("ask");
    expect(camera_area({ ...base, permission: { granted: false, canAskAgain: false } })).toBe("settings");
    expect(camera_area(base)).toBe("starting");
    expect(camera_area({ ...base, ready: true })).toBe("preview");
    expect(camera_area({ ...base, failed: true })).toBe("unavailable");
    expect(camera_area({ ...base, timed_out: true })).toBe("unavailable");
    expect(camera_area({ ...base, timed_out: true, ready: true })).toBe("preview");
    expect(camera_area({ ...base, active: false, ready: true })).toBe("paused");
    expect(camera_area({ ...base, taken: true, permission: null })).toBe("photo");
  });
});
