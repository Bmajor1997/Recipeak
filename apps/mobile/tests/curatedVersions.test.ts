// Every bundled cocktail's written alcohol-free version can be shown without the AI, and never drops an allergen.
import { describe, expect, it } from "vitest";
import recipes from "../src/recipes/collection.json";
import { COLLECTION } from "../src/recipes/collectionPhotos";
import { curated_non_alcoholic, curated_version } from "../src/recipes/curatedVersions";
import { parse_recipe } from "../src/recipes/parse";
import { camera_area } from "../src/camera/cameraOptions";

// Checked independently of curatedVersions.ts: any of these left in a version would be alcohol.
const ALCOHOL =
  /\b(?:vodka|gin|rum|tequila|mezcal|whiske?y|bourbon|rye|scotch|brandy|cognac|vermouth|liqueur|campari|aperol|prosecco|champagne|wine|beer|lager|absinthe|amaro|sake|pisco|cacha[cç]a|bitters|cointreau|triple sec|kahl[uú]a|amaretto|irish cream|sherry|spirit)\b/i;
const OK = /\b(?:alcohol-free|non-alcoholic)(?: [a-z'-]+){0,4}|\b(?:ginger|root) beer\b|\bwine glass\b|\bwithout alcohol\b/gi;
const alcoholic = (text: string) => ALCOHOL.test(text.replace(OK, " "));

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

  it("never lists or instructs alcohol: every change is applied to ingredients and steps, or the version is shown as written", () => {
    for (const regular of written) {
      const version = curated_non_alcoholic(regular)!;
      // The first step is the written change itself ("skip the vodka"); everything after it must be alcohol-free.
      const rest = version.ingredients.length ? version.steps.slice(1) : [];
      for (const text of [...version.ingredients.map((i) => i.item), ...rest])
        expect(alcoholic(text), `${regular.title}: ${text}`).toBe(false);
    }
  });

  it("swaps a named alcohol-free product in, leaves the spirit out, and falls back to the written version when unsure", () => {
    const by = (title: string) => curated_non_alcoholic(written.find((r) => r.title === title)!)!;
    // "Use a non-alcoholic gin alternative…": the gin's amount stays, with the alternative.
    expect(by("Gin and Tonic").ingredients[0]).toMatchObject({ amount: "2", unit: "oz", item: "non-alcoholic gin alternative" });
    expect(by("Gin and Tonic").steps.join(" ")).toContain("Add the non-alcoholic gin alternative and top with tonic.");
    // "Leave out the spirit": the bourbon or rum goes, and the step no longer stirs it in.
    expect(
      by("Eggnog")
        .ingredients.map((i) => i.item)
        .join(" "),
    ).not.toMatch(/bourbon|rum/);
    expect(by("Eggnog").steps.join(" ")).toContain("Cool and stir in the vanilla.");
    // "Use alcohol-free sparkling wine" for a drink with Champagne and bitters can't be matched safely: shown as written.
    expect(by("Champagne Cocktail")).toMatchObject({ ingredients: [], steps: ["Use alcohol-free sparkling wine."] });
  });

  it("shows a drink written as a sentence as written, and adds allergens a new drink brings", () => {
    const gimlet = written.find((r) => r.title === "Gimlet")!;
    const na = curated_version(gimlet, "non-alcoholic")!;
    expect(na.ingredients).toEqual([]);
    expect(na.steps).toEqual(["Shake lime juice, syrup and a few cucumber slices and top with tonic water."]);
    // It stays a valid recipe, so it can be saved and read back.
    expect(parse_recipe(JSON.parse(JSON.stringify(na)))).toEqual(na);
    const sour = {
      ...gimlet,
      title: "Sour",
      cocktail: { ...gimlet.cocktail!, non_alcoholic_version: "Shake lemon, orgeat and an egg white." },
    };
    expect(curated_non_alcoholic(sour)!.allergens).toEqual(expect.arrayContaining(["tree nuts", "eggs"]));
    // Only an alcohol-free drink may have no ingredient list.
    expect(() => parse_recipe({ ...na, cocktail: { ...na.cocktail!, alcoholic: true } })).toThrow();
    expect(() => parse_recipe({ ...na, cocktail: null })).toThrow();
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
