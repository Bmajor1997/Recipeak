// Checks every bundled recipe's diet labels and "Make it…" options (see src/recipes/diets.ts and dietReview.json).
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../../../data/curated-photos/manifest.json";
import recipes from "../src/recipes/collection.json";
import variants from "../src/recipes/collectionVariants.json";
import review from "../src/recipes/dietReview.json";
import { bundled_diet_profile } from "../src/recipes/dietProfile";
import { parse_recipe } from "../src/recipes/parse";
import { diet_profile } from "../src/recipes/diets";
import type { Diet, Kind, Recipe } from "../src/recipes/types";

const kinds = Object.fromEntries(manifest.photos.map((p) => [p.file.replace(/\.[a-z]+$/, ""), p.kind as Kind]));
const all = Object.entries(recipes as Record<string, unknown>).map(([id, raw]) => {
  const recipe = parse_recipe(raw);
  return { id, recipe, kind: kinds[id], profile: bundled_diet_profile(id, recipe, kinds[id]) };
});

describe("diet options for the bundled recipes", () => {
  it("never offers a diet the recipe already meets, and offers non-alcoholic only for alcoholic drinks", () => {
    for (const { id, kind, recipe, profile } of all) {
      for (const d of profile.options) expect(profile.fits, `${id} ${d}`).not.toContain(d);
      if (kind === "meal") expect(profile.options, id).not.toContain("non-alcoholic");
      if (kind === "cocktail" && !recipe.cocktail?.alcoholic) expect(profile.options, id).not.toContain("non-alcoholic");
      if (profile.fits.includes("vegan")) expect(profile.fits, id).toContain("vegetarian");
    }
  });

  it("agrees with the hand-written vegetarian and vegan versions", () => {
    const wrong: string[] = [];
    for (const [id, v] of Object.entries(variants as Record<string, Record<string, unknown>>)) {
      const { profile } = all.find((r) => r.id === id)!;
      for (const diet of ["vegetarian", "vegan"] as Diet[]) {
        const want = v[diet] === "same" ? "fits" : "option";
        const got = profile.status[diet];
        // "Same" with wine or beer in it depends on the brand's fining, so it waits for a person to check.
        const ok = got?.status === want || (want === "fits" && got?.status === "review");
        if (!ok) wrong.push(`${id} ${diet}: ${got?.status} (${got?.why})`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("keeps amaretto allergen information consistent with the specified nut-free product", () => {
    for (const id of ["godfather", "alabama-slammer", "french-connection", "amaretto-sour"]) {
      const recipe = parse_recipe((recipes as Record<string, unknown>)[id]);
      expect(recipe.ingredients.some((i) => /nut-free amaretto/i.test(i.item))).toBe(true);
      expect(recipe.allergens).not.toContain("tree nuts");
    }
    const vegan = (variants as Record<string, Record<string, unknown>>)["amaretto-sour"].vegan;
    expect(parse_recipe(vegan).allergens).not.toContain("tree nuts");
  });

  it("only keeps audit decisions for dishes that exist", () => {
    for (const id of Object.keys(review)) expect(Object.keys(recipes), id).toContain(id);
  });

  // DIET_AUDIT=path writes the full table, for reviewing the rules by hand.
  it.runIf(process.env.DIET_AUDIT)("writes the audit table", () => {
    const rows = all.map(({ id, kind, recipe, profile }) => ({
      id,
      kind,
      title: recipe.title,
      fits: profile.fits,
      options: profile.options,
      other: Object.fromEntries(
        Object.entries(profile.status)
          .filter(([, s]) => s.status === "none" || s.status === "review" || s.status === "option")
          .map(([d, s]) => [d, `${s.status}: ${s.why}`]),
      ),
    }));
    writeFileSync(process.env.DIET_AUDIT!, JSON.stringify(rows, null, 1));
  });
});

const dish = (title: string, items: string[], extra: Partial<Recipe> = {}): Recipe => ({
  title,
  description: "",
  servings: 4,
  prep_minutes: 5,
  cook_minutes: 5,
  ingredients: items.map((item) => ({ amount: "1", unit: "cup", item })),
  steps: ["Cook."],
  allergens: [],
  cocktail: null,
  note: "",
  ...extra,
});

describe("diet rules", () => {
  it("labels what a recipe already meets and offers only what needs a change", () => {
    const p = diet_profile(dish("Lentil Soup", ["brown lentils", "vegetable broth", "olive oil", "onion"]), "meal");
    expect(p.fits).toEqual(expect.arrayContaining(["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"]));
    expect(p.options).not.toContain("vegan");
    expect(p.status["low-carb"]?.status).toBe("none");
  });

  it("offers meat-free versions even when meat is in the dish name", () => {
    const p = diet_profile(dish("Beef Stew", ["beef chuck, cubed", "carrots", "flour"]), "meal");
    expect(p.status.vegetarian?.status).toBe("option");
    expect(p.status.vegan?.status).toBe("option");
    expect(p.options).toContain("gluten-free");
  });

  it("offers a change for an ingredient that can be swapped or left out", () => {
    const p = diet_profile(dish("Tomato Soup", ["tomatoes", "butter", "chicken broth"]), "meal");
    expect(p.options).toEqual(expect.arrayContaining(["vegetarian", "vegan", "dairy-free"]));
  });

  it("counts an 'or' choice only when it names a real substitute", () => {
    expect(diet_profile(dish("Rice", ["butter or oil"]), "meal").options).toContain("dairy-free");
    expect(diet_profile(dish("Rice", ["water or chicken broth"]), "meal").options).toContain("vegetarian");
    expect(diet_profile(dish("Stew", ["chicken breasts or thighs"]), "meal").fits).not.toContain("vegetarian");
    expect(diet_profile(dish("Pie", ["pizza or bread dough"]), "meal").fits).not.toContain("gluten-free");
  });

  it("sends brand-dependent and unspecific ingredients to review instead of guessing", () => {
    const p = diet_profile(dish("Soup", ["broth", "onion"]), "meal");
    expect(p.status.vegetarian?.status).toBe("review");
    expect(p.fits).not.toContain("vegetarian");
    expect(p.options).not.toContain("vegetarian");
    const m = diet_profile(
      dish("Gin Martini", ["gin", "dry vermouth"], {
        cocktail: { glass: "coupe", garnish: "olive", alcoholic: true, non_alcoholic_version: null },
      }),
      "cocktail",
    );
    expect(m.status.vegan?.status).toBe("review");
  });

  it("counts coconut and peanut butter as nuts, but not butternut squash or nutmeg", () => {
    expect(diet_profile(dish("Curry", ["coconut milk", "tofu"]), "meal").fits).not.toContain("nut-free");
    expect(diet_profile(dish("Toast", ["peanut butter"]), "meal").fits).not.toContain("nut-free");
    expect(diet_profile(dish("Soup", ["butternut squash", "nutmeg"]), "meal").fits).toContain("nut-free");
    expect(diet_profile(dish("Curry", ["coconut milk", "tofu"]), "meal").fits).toContain("dairy-free");
  });

  it("treats distilled spirits and ginger beer as gluten-free, and beer and soy sauce as not", () => {
    const drink = { cocktail: { glass: "mug", garnish: "lime", alcoholic: true, non_alcoholic_version: null } };
    expect(diet_profile(dish("Mule", ["vodka", "ginger beer", "lime juice"], drink), "cocktail").fits).toContain("gluten-free");
    expect(diet_profile(dish("Shandy", ["lager", "lemonade"], drink), "cocktail").options).toContain("gluten-free");
    expect(diet_profile(dish("Stir-fry", ["soy sauce", "broccoli"]), "meal").options).toContain("gluten-free");
  });

  it("offers low-carb when the carbs are sugar, a coating or a side, not when a starch is the dish", () => {
    expect(diet_profile(dish("Steak", ["ribeye", "butter"]), "meal").fits).toContain("low-carb");
    const glazed = dish("Glazed Salmon", ["salmon"], {
      ingredients: [
        { amount: "1 1/2", unit: "lb", item: "salmon" },
        { amount: "2", unit: "tbsp", item: "brown sugar" },
      ],
    });
    expect(diet_profile(glazed, "meal").options).toContain("low-carb");
    expect(diet_profile(dish("Curry", ["chicken", "steamed rice, to serve"]), "meal").options).toContain("low-carb");
    expect(diet_profile(dish("Fried Rice", ["cooked rice", "eggs"]), "meal").status["low-carb"]?.status).toBe("none");
    const sour = { cocktail: { glass: "coupe", garnish: "", alcoholic: true, non_alcoholic_version: null } };
    expect(diet_profile(dish("Gimlet", ["gin", "lime juice", "simple syrup"], sour), "cocktail").options).toContain("low-carb");
    expect(diet_profile(dish("Sidecar", ["cognac", "Cointreau", "lemon juice"], sour), "cocktail").status["low-carb"]?.status).toBe("none");
  });

  it("offers non-alcoholic only for alcoholic drinks", () => {
    const na = { cocktail: { glass: "highball", garnish: "", alcoholic: false, non_alcoholic_version: null } };
    expect(diet_profile(dish("Lemonade", ["lemon juice", "water", "sugar"], na), "cocktail").fits).toContain("non-alcoholic");
    expect(diet_profile(dish("Stew", ["beef", "dry red wine"]), "meal").status["non-alcoholic"]).toBeUndefined();
  });

  it("reads a qualifier word only for its own diet, so AI recipes can say an item fits", () => {
    const drink = { cocktail: { glass: "coupe", garnish: "", alcoholic: true, non_alcoholic_version: null } };
    expect(diet_profile(dish("Manhattan", ["rye", "vegan sweet vermouth"], drink), "cocktail").fits).toContain("vegan");
    expect(diet_profile(dish("Toast", ["vegan bread"]), "meal").fits).not.toContain("gluten-free");
    expect(diet_profile(dish("Stir-fry", ["gluten-free soy sauce", "tofu"]), "meal").fits).toContain("gluten-free");
    expect(diet_profile(dish("Mix", ["vegan butter and eggs"]), "meal").fits).not.toContain("vegan");
    const gimlet = dish("Gimlet", ["gin", "lime juice", "sugar-free simple syrup"], drink);
    expect(diet_profile(gimlet, "cocktail").fits).toContain("low-carb");
  });

  it("does not hide incompatible ingredients after an ampersand or a sugar-free qualifier", () => {
    expect(diet_profile(dish("Snack", ["nut-free chocolate & almonds"]), "meal").fits).not.toContain("nut-free");
    expect(diet_profile(dish("Toast", ["sugar-free bread"]), "meal").fits).not.toContain("low-carb");
    expect(diet_profile(dish("Mix", ["gluten-free flour & breadcrumbs"]), "meal").fits).not.toContain("gluten-free");
  });

  it("treats parmesan and pecorino as not vegetarian, with a vegetarian hard cheese as the swap", () => {
    const pesto = diet_profile(dish("Pesto Pasta", ["basil", "grated parmesan", "olive oil"]), "meal");
    expect(pesto.options).toContain("vegetarian");
    const veg = diet_profile(dish("Pesto Pasta", ["basil", "vegetarian hard cheese", "olive oil"]), "meal");
    expect(veg.fits).toContain("vegetarian");
    expect(diet_profile(dish("Eggplant Parmesan", ["eggplant", "parmesan"]), "meal").options).toContain("vegetarian");
  });

  it("doesn't read a brand suggestion in brackets as another ingredient", () => {
    const spritz = { cocktail: { glass: "wine glass", garnish: "", alcoholic: true, non_alcoholic_version: null } };
    const p = diet_profile(dish("St-Germain", ["vegan dry sparkling wine (such as Mionetto Organic Prosecco)"], spritz), "cocktail");
    expect(p.fits).toContain("vegan");
  });
});

