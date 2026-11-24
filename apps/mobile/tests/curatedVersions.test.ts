// Every bundled cocktail's written alcohol-free version can be shown without the AI, and never drops an allergen.
import { describe, expect, it } from "vitest";
import recipes from "../src/recipes/collection.json";
import { COLLECTION } from "../src/recipes/collectionPhotos";
import { curated_non_alcoholic, curated_version } from "../src/recipes/curatedVersions";
import { diet_profile } from "../src/recipes/diets";
import { parse_recipe } from "../src/recipes/parse";
import { camera_area } from "../src/camera/cameraOptions";
import shared_words from "../../../data/allergen-word-cases.json";

// Checked independently of curatedVersions.ts: any of these left in a version would be alcohol.
const ALCOHOL =
  /\b(?:vodka|gin|rum|tequila|mezcal|whiske?y|bourbon|rye|scotch|brandy|cognac|vermouth|liqueur|campari|aperol|prosecco|champagne|wine|beer|lager|absinthe|amaro|sake|pisco|cacha[cç]a|bitters|cointreau|triple sec|kahl[uú]a|amaretto|irish cream|sherry|spirit|brandied|rhum|allspice dram|applejack|aquavit|b[ée]n[ée]dictine|calvados|chambord|cr[eè]me de [a-zûèé]+|cynar|drambuie|dubonnet|falernum|fernet|galliano|grand marnier|guinness|single malt|j[äa]germeister|pimm'?s|southern comfort)\b/i;
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
      // The garnish too, also for a version shown as written.
      for (const text of [...version.ingredients.map((i) => i.item), ...rest, version.cocktail!.garnish])
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
    // A brandied cherry garnish becomes a plain cherry.
    expect(by("Mary Pickford").cocktail!.garnish).toBe("cherry");
    // "Use alcohol-free sparkling wine" for a drink with Champagne and bitters can't be matched safely: shown as written.
    expect(by("Champagne Cocktail")).toMatchObject({
      ingredients: [],
      steps: ["Use alcohol-free sparkling wine.", "From the original, without the alcohol: 1 sugar cube."],
    });
  });

  it("shows a drink written as a sentence as written, and adds allergens a new drink brings", () => {
    const gimlet = written.find((r) => r.title === "Gimlet")!;
    const na = curated_version(gimlet, "non-alcoholic")!;
    expect(na.ingredients).toEqual([]);
    expect(na.steps).toEqual([
      "Shake lime juice, syrup and a few cucumber slices and top with tonic water.",
      "From the original, without the alcohol: 3/4 oz fresh lime juice; 3/4 oz simple syrup.",
    ]);
    // It stays a valid recipe, so it can be saved and read back.
    expect(parse_recipe(JSON.parse(JSON.stringify(na)))).toEqual(na);
    const sour = {
      ...gimlet,
      title: "Sour",
      cocktail: { ...gimlet.cocktail!, non_alcoholic_version: "Shake lemon, orgeat and an egg white." },
    };
    expect(curated_non_alcoholic(sour)!.allergens).toEqual(expect.arrayContaining(["tree nuts", "eggs"]));
    for (const ingredient of ["soy milk", "soy cream"]) {
      const drink = {
        ...gimlet,
        allergens: [],
        cocktail: { ...gimlet.cocktail!, non_alcoholic_version: `Shake coffee, ${ingredient} and syrup.` },
      };
      expect(curated_non_alcoholic(drink)!.allergens).toContain("soy");
      expect(curated_non_alcoholic(drink)!.allergens).not.toContain("milk");
    }
    // Only an alcohol-free drink may have no ingredient list.
    expect(() => parse_recipe({ ...na, cocktail: { ...na.cocktail!, alcoholic: true } })).toThrow();
    expect(() => parse_recipe({ ...na, cocktail: null })).toThrow();
  });

  it("claims no diet for a version written only as a method, so orgeat, cream or egg white can't hide", () => {
    const method_only = written.map((r) => curated_non_alcoholic(r)!).filter((v) => !v.ingredients.length);
    expect(method_only.length).toBeGreaterThan(100);
    for (const version of method_only) {
      const profile = diet_profile(version, "cocktail");
      expect(profile.fits, version.title).toEqual(["non-alcoholic"]);
      // Every other diet is shown as needing a check, not dropped, so it can still be asked for.
      for (const diet of ["vegan", "dairy-free", "nut-free"] as const) expect(profile.status[diet]?.status).toBe("review");
    }
    for (const title of ["Mai Tai", "White Russian", "Whiskey Sour"]) {
      const version = curated_non_alcoholic(written.find((r) => r.title === title)!)!;
      expect(diet_profile(version, "cocktail").fits, title).toEqual(["non-alcoholic"]);
    }
  });

  it("isn't offered for drinks without a written version, or for other diets", () => {
    const plain = written[0];
    expect(curated_non_alcoholic({ ...plain, cocktail: { ...plain.cocktail!, non_alcoholic_version: null } })).toBeNull();
    expect(curated_version(plain, "low-carb")).toBeNull();
  });
});

describe("allergen words in a written version", () => {
  const gimlet = parse_recipe((recipes as Record<string, unknown>).gimlet);
  const found = (text: string) =>
    curated_non_alcoholic({
      ...gimlet,
      allergens: [],
      cocktail: { ...gimlet.cocktail!, non_alcoholic_version: `Shake lime, ${text} and syrup.` },
    })!.allergens;

  it("reads every shared case the same way as the server", () => {
    for (const { text, has = [], not = [] } of shared_words.cases as { text: string; has?: string[]; not?: string[] }[]) {
      for (const allergen of has) expect(found(text), `${text} contains ${allergen}`).toContain(allergen);
      for (const allergen of not) expect(found(text), `${text} is not ${allergen}`).not.toContain(allergen);
    }
  });

  it("doesn't call a ginger beer drink wheat, as the regular Moscow Mule isn't", () => {
    const cocktails = COLLECTION.filter((d) => d.kind === "cocktail").map((d) => parse_recipe((recipes as Record<string, unknown>)[d.id]));
    const ginger = cocktails.filter(
      (r) => /ginger (?:beer|ale)/i.test(r.cocktail?.non_alcoholic_version ?? "") && !r.allergens.includes("wheat"),
    );
    expect(ginger.map((r) => r.title)).toEqual(expect.arrayContaining(["Moscow Mule", "Dark 'n' Stormy"]));
    for (const regular of ginger) expect(curated_non_alcoholic(regular)!.allergens, regular.title).not.toContain("wheat");
  });
});

describe("written versions that lean on the original", () => {
  const recipe_of = (id: string) => parse_recipe((recipes as Record<string, unknown>)[id]);
  const cocktails = COLLECTION.filter((d) => d.kind === "cocktail").map((d) => recipe_of(d.id));

  it("a version written as a sentence keeps the original's other ingredients and amounts in the method", () => {
    const colada = curated_non_alcoholic(recipe_of("pina-colada"))!;
    expect(colada.steps[0]).toBe("Blend without the rum for a virgin piña colada.");
    expect(colada.steps[1]).toMatch(/^From the original, without the alcohol: 3 oz pineapple juice; 1 1\/2 oz cream of coconut/);
    expect(colada.ingredients).toEqual([]); // so no diet is claimed from it
    // A version with its own amounts is complete: nothing is added that could contradict it.
    expect(curated_non_alcoholic(recipe_of("gin-fizz"))!.steps).toEqual([
      "Shake 1 oz lemon juice and 3/4 oz simple syrup with ice, strain, and top with 3 oz soda water.",
    ]);
    // …except what it points back to ("the same spices") and doesn't name.
    const mulled = curated_non_alcoholic(recipe_of("mulled-wine"))!.steps;
    expect(mulled[1]).toMatch(/cinnamon sticks.*cloves.*star anise/);
    expect(mulled[1]).not.toMatch(/orange|wine/i);
    // Liqueurs the word list once missed are never carried over (Brandy Alexander, Penicillin, B-52).
    for (const id of ["brandy-alexander", "penicillin", "b-52"])
      expect(curated_non_alcoholic(recipe_of(id))!.steps.join(" ")).not.toMatch(/crème de cacao|single malt|grand marnier/i);
    // Never alcohol in what's carried over, for every drink shown as written.
    for (const r of cocktails.filter((c) => c.cocktail?.alcoholic && c.cocktail.non_alcoholic_version)) {
      const v = curated_non_alcoholic(r)!;
      if (!v.ingredients.length) for (const step of v.steps.slice(1)) expect(alcoholic(step), `${r.title}: ${step}`).toBe(false);
    }
  });

  it("applies the parts of a change that aren't about alcohol to the ingredients and steps", () => {
    const toddy = curated_non_alcoholic(recipe_of("hot-buttered-rum"))!;
    expect(toddy.ingredients.map((i) => i.item)).toContain("hot apple cider");
    expect(toddy.ingredients.map((i) => i.item).join(" ")).not.toMatch(/water/);
    expect(toddy.steps.slice(1).join(" ")).toContain("pour in the hot apple cider");
    const mojito = curated_non_alcoholic(recipe_of("mojito"))!;
    // An added amount is its own line, so it scales with the servings.
    expect(mojito.ingredients).toEqual(
      expect.arrayContaining([
        { amount: "1/2", unit: "oz", item: "fresh lime juice (more)" },
        expect.objectContaining({ item: "chilled soda water (extra)" }),
      ]),
    );
    const punch = curated_non_alcoholic(recipe_of("hibiscus-citrus-rum-punch"))!;
    expect(punch.ingredients[1]).toEqual({ amount: "1½", unit: "oz", item: "chilled unsweetened hibiscus tea (more)" });
    // "Add soda water" is the soda, not the watermelon juice.
    const cooler = curated_non_alcoholic(recipe_of("watermelon-mint-rum-cooler"))!;
    expect(cooler.ingredients.map((i) => i.item)).toContain("soda water (more)");
    expect(cooler.ingredients.map((i) => i.item)).not.toContain("strained fresh watermelon juice (more)");
    const coffee = curated_non_alcoholic(recipe_of("irish-coffee"))!;
    expect(coffee.ingredients.map((i) => i.item)).toContain("drop of vanilla");
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
