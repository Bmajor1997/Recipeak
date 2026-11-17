// Which "Make it…" diet options a recipe gets, worked out from its ingredients and garnish (never its name alone).
//
// For each diet a recipe is one of:
//   fits    — nothing in the standard recipe breaks the diet, so it gets a label and no "Make it" option
//   option  — something breaks the diet and can be removed or swapped, so the option is offered
//   none    — what breaks the diet is the heart of the dish (named in its title, or a starch cooked into it for
//             low-carb), so no option is offered
//   review  — the only problem is an ingredient that depends on the brand or isn't specific enough (plain "broth",
//             wine and its fining, store-bought bread), so neither a label nor an option is shown until a person checks
//
// These are recipe checks, not allergy guarantees: removing an ingredient doesn't rule out cross-contact.
import { DIETS, type Diet, type Kind, type Recipe } from "./types";

export type DietStatus = "fits" | "option" | "none" | "review";
export type DietProfile = {
  /** Diets the standard recipe already meets: shown as labels. */
  fits: Diet[];
  /** Diets offered as "Make it…" options: each needs a real change to the recipe. */
  options: Diet[];
  /** Every diet that applies to this kind of dish, with the reason when it isn't a plain fit. */
  status: Partial<Record<Diet, { status: DietStatus; why: string }>>;
};
/** A hand decision for one bundled dish, made in the audit (see dietReview.json). */
export type DietOverride = { status: DietStatus; why: string };

type Rule = { bad: RegExp; unsure?: RegExp; core?: RegExp; raw?: boolean };

const words = (list: string[]) => new RegExp(`\\b(?:${list.join("|")})`, "i");

// Animal flesh and things made from it. Generic broth, stock and some pastes may or may not contain it.
const MEAT = [
  "chicken",
  "beef",
  "pork",
  "lamb",
  "mutton",
  "goat(?! cheese)",
  "veal",
  "duck",
  "turkey",
  "cornish hens?",
  "oxtail",
  "tripe",
  "brisket",
  "chuck",
  "sirloin",
  "ribeye",
  "tenderloin",
  "flank steak",
  "steaks?",
  "short ribs",
  "spareribs",
  "shank",
  "bacon",
  "pancetta",
  "guanciale",
  "prosciutto",
  "ham\\b",
  "pepperoni",
  "salami",
  "chorizo",
  "chouri[cç]o",
  "lingui[cç]a",
  "sausages?",
  "kielbasa",
  "andouille",
  "bratwurst",
  "lap cheong",
  "lard",
  "suet",
  "marrow",
  "bones?\\b",
  "doner",
  "meat",
  "gelatin",
  "fish",
  "salmon",
  "tuna",
  "albacore",
  "yellowfin",
  "cod\\b",
  "haddock",
  "catfish",
  "tilapia",
  "halibut",
  "mahi",
  "anchov",
  "sardine",
  "mackerel",
  "eel\\b",
  "unagi",
  "bonito",
  "katsuobushi",
  "dashi",
  "saltfish",
  "shrimp",
  "prawn",
  "crab",
  "clams?\\b",
  "clamato",
  "mussels?",
  "lobster",
  "scallops?",
  "oyster sauce",
  "squid",
  "octopus",
  "conch",
  "crayfish",
  "bagoong",
  "belacan",
  "terasi",
  "ikan bilis",
  "worcestershire",
  "nuoc cham",
  "ham hocks?",
];
const MEAT_UNSURE = [
  "broth",
  "stock\\b",
  "stock cubes?",
  "bouillon",
  "kimchi",
  "curry paste",
  "laksa paste",
  "nam prik pao",
  "chili paste",
  "sinigang",
  "fish-free",
];
// Kombu dashi, vegetable broth and the like are plant-based; "or" alternatives are handled separately.
const PLANT_WORDS =
  /\b(vegetable (?:broth|stock)|kombu dashi|mushroom dashi|vegan [a-z ]+|plant-based [a-z ]+|eggplant|butter beans|butternut|cocoa butter|peanut butter|cream of coconut|coconut (?:cream|milk)|honeydew|crème de [a-zûé]+|creme de [a-z]+|cream sherry|ginger beer|root beer)\b/g;

const DAIRY = [
  "butter",
  "buttermilk",
  "ghee",
  "smen",
  "kibbeh",
  "milk",
  "cream",
  "crema",
  "cheese",
  "cheddar",
  "mozzarella",
  "parmesan",
  "pecorino",
  "kefalotyri",
  "ricotta",
  "feta",
  "paneer",
  "queso",
  "quesillo",
  "oaxaca",
  "monterey jack",
  "gruy[eè]re",
  "provolone",
  "swiss",
  "yogh?urt",
  "irish cream",
  "mashed potatoes",
  "naan",
  "brioche",
];
const DAIRY_UNSURE = [
  "bread",
  "rolls",
  "buns",
  "pav",
  "english muffins",
  "puff pastry",
  "pie crusts?",
  "empanada dough",
  "paratha",
  "roti",
  "cornbread",
  "gingersnap",
  "chocolate(?! bitters)",
];
const CHEESE = [
  "cheese",
  "queso",
  "paneer",
  "mozzarella",
  "ricotta",
  "feta",
  "halloumi",
  "fondue",
  "parmesan",
  "parmigiana",
  "cacio",
  "provolone",
  "burrata",
];

const EGG = ["eggs?\\b", "egg (?:white|yolk)s?", "yolks?", "mayo", "mayonnaise", "tartar sauce", "egg noodles", "brioche", "challah"];
const EGG_UNSURE = ["lasagna noodles", "dumpling wrappers", "spring roll wrappers", "empanada dough", "tempura bits", "gingersnap"];
const HONEY = ["honey(?!dew|comb)", "gardenia mix"];
// Wine, beer and some aperitifs may be fined with egg, milk, gelatin or fish products: it depends on the brand.
const FINED = [
  "wine",
  "champagne",
  "prosecco",
  "vermouth",
  "sherry",
  "port\\b",
  "beer",
  "lager",
  "stout",
  "guinness",
  "lillet",
  "dubonnet",
  "marsala",
  "sake",
  "shaoxing",
];

const GLUTEN = [
  "flour",
  "atta",
  "semolina",
  "couscous",
  "bulgur",
  "bread",
  "breadcrumbs",
  "panko",
  "croutons",
  "pitas?",
  "pide",
  "naan",
  "roti",
  "paratha",
  "rougag",
  "flatbread",
  "baguettes?",
  "rolls",
  "buns",
  "pav",
  "brioche",
  "challah",
  "english muffins",
  "cornbread",
  "injera",
  "dough",
  "pastry",
  "pie crusts?",
  "wrappers",
  "mandarin pancakes",
  "gingersnap",
  "saltine",
  "crackers",
  "pasta",
  "spaghetti",
  "fettuccine",
  "linguine",
  "macaroni",
  "ziti",
  "rigatoni",
  "penne",
  "trofie",
  "lasagna",
  "noodles",
  "ramen",
  "udon",
  "soba",
  "lo mein",
  "vermicelli",
  "tortillas?",
  "oats",
  "soy sauce",
  "maggi",
  "hoisin",
  "oyster sauce",
  "kecap manis",
  "sweet soy",
  "sweet bean sauce",
  "doubanjiang",
  "gochujang",
  "black vinegar",
  "malt vinegar",
  "shaoxing",
  "tempura",
  "tonkatsu sauce",
  "okonomiyaki sauce",
  "takoyaki sauce",
  "beer",
  "lager",
  "stout",
  "guinness",
  "split pea fritters",
];
// Not wheat, barley or rye, though their names look like it.
const GLUTEN_FREE_WORDS =
  /\b(rice (?:flour|noodles|vermicelli|paper|cakes)|chickpea flour|corn (?:tortillas?|flour)|taco shells or corn tortillas|tortilla (?:chips|strips)|glass noodles|sweet potato starch noodles|flat rice noodles|fresh (?:flat|wide) rice noodles|rice vermicelli|thin rice vermicelli|dried flat rice noodles|tamari|ginger beer|root beer|bread and butter pickles|masa harina|cylindrical rice cakes|prawn crackers)\b/g;
const GLUTEN_UNSURE = [
  "worcestershire",
  "bouillon",
  "stock cubes?",
  "barbecue sauce",
  "taco seasoning",
  "fried onions",
  "fermented black beans",
  "fish cakes",
  "sausages?",
  "kielbasa",
  "andouille",
  "bratwurst",
  "lap cheong",
  "chinese sausage",
  "sambar powder",
  "prawn crackers",
  "chocolate syrup",
];

const NUTS = [
  "peanuts?",
  "almonds?",
  "walnuts?",
  "pecans?",
  "cashews?",
  "pistachios?",
  "pine nuts",
  "hazelnuts?",
  "macadamia",
  "brazil nuts?",
  "orgeat",
  "frangelico",
  "nocino",
  "praline",
  "marzipan",
  "pesto",
  "satay",
  "coconut",
  "kerisik",
  "malibu",
];
const NUTS_UNSURE = ["amaretto", "noyaux"];

// Low-carb: a starch cooked into the dish is its heart; sugar, a coating or a side can be cut or swapped.
const STARCH = [
  ...GLUTEN.filter((w) => !/sauce|vinegar|maggi|hoisin|kecap|sweet soy|doubanjiang|gochujang|shaoxing|beer|lager|stout|guinness/.test(w)),
  "rice",
  "potato(?:es)?",
  "hash browns",
  "french fries",
  "plantains?",
  "yams?\\b",
  "cassava",
  "yuca",
  "taro",
  "corn\\b",
  "cornmeal",
  "masarepa",
  "masa",
  "grits",
  "hominy",
  "polenta",
  "beans",
  "black-eyed peas",
  "chickpeas",
  "lentils",
  "dal\\b",
  "split peas",
  "quinoa",
  "farofa",
  "dosa batter",
  "idli batter",
  "tortilla chips",
  "tortilla strips",
  "taco shells",
  "tteok",
  "rice cakes",
  "plantain chips",
  "injera",
];
const SUGAR = [
  "sugar",
  "honey",
  "syrup",
  "molasses",
  "jam\\b",
  "marmalade",
  "chutney",
  "ketchup",
  "hoisin",
  "kecap manis",
  "sweet soy",
  "sweet chili sauce",
  "barbecue sauce",
  "mirin",
  "raisins",
  "dates",
  "prunes",
  "apricots",
  "jujubes",
  "grenadine",
  "cola",
  "soda\\b",
  "ginger ale",
  "ginger beer",
  "tonic",
  "lemonade",
  "falernum",
  "beer",
  "lager",
  "stout",
  "guinness",
];
// In a drink, these carry the flavor, so a low-carb version would be a different drink.
const DRINK_CARB_CORE = [
  "liqueur",
  "cura[cç]ao",
  "triple sec",
  "cointreau",
  "grand marnier",
  "chambord",
  "kahl[uú]a",
  "drambuie",
  "galliano",
  "b[eé]n[eé]dictine",
  "chartreuse",
  "st-germain",
  "aperol",
  "campari",
  "amaro",
  "amer picon",
  "cynar",
  "fernet",
  "j[aä]germeister",
  "southern comfort",
  "irish cream",
  "amaretto",
  "cr[eè]me de",
  "schnapps",
  "sloe gin",
  "allspice dram",
  "pernod",
  "sweet vermouth",
  "blanc vermouth",
  "dubonnet",
  "lillet",
  "port\\b",
  "cream sherry",
  "beer",
  "lager",
  "stout",
  "guinness",
  "juice(?<!lime juice|lemon juice)",
  "puree",
  "cream of coconut",
  "coconut rum",
  "spiced rum",
  "vanilla vodka",
  "chocolate(?! bitters)",
  "strawberries",
  "blackberries",
  "raspberries",
  "berries",
  "banana",
  "pineapple",
  "peach",
  "grapes",
  "sake",
  "orgeat",
  "sangrita",
  "lemonade",
  "midori",
  "maraschino",
  "absinthe",
  "apricot brandy",
  "peach brandy",
  "cherry heering",
];
const STARCH_CORE_TITLE = [
  "rice",
  "risotto",
  "paella",
  "biryani",
  "pilaf",
  "polo",
  "jollof",
  "pasta",
  "spaghetti",
  "lasagna",
  "macaroni",
  "noodles?",
  "ramen",
  "pho",
  "udon",
  "lo mein",
  "pad",
  "bread",
  "toast",
  "sandwich",
  "burger",
  "pizza",
  "potato(?:es)?",
  "fries",
  "tacos?",
  "burrito",
  "quesadilla",
  "enchiladas?",
  "tamales?",
  "empanadas?",
  "dumplings?",
  "pancakes?",
  "waffles?",
  "beans",
  "dal",
  "lentils?",
  "chickpeas?",
];

function rule(diet: Diet): Rule | null {
  switch (diet) {
    case "vegetarian":
      return { bad: words(MEAT), unsure: words(MEAT_UNSURE), core: words([...MEAT, "seafood", "carne"]) };
    case "vegan":
      return {
        bad: words([...MEAT, ...DAIRY, ...EGG, ...HONEY]),
        unsure: words([...MEAT_UNSURE, ...DAIRY_UNSURE, ...EGG_UNSURE, ...FINED]),
        core: words([...MEAT, "seafood", "carne", ...CHEESE, "eggs?\\b", "omelet(?:te)?", "frittata", "huevos", "quiche"]),
      };
    case "dairy-free":
      return { bad: words(DAIRY), unsure: words(DAIRY_UNSURE), core: words(CHEESE) };
    case "gluten-free":
      return { bad: words(GLUTEN), unsure: words(GLUTEN_UNSURE) };
    case "nut-free":
      return { bad: words(NUTS), unsure: words(NUTS_UNSURE), core: words(NUTS.filter((n) => n !== "satay")), raw: true };
    default:
      return null;
  }
}

const clean = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFC")
    .replace(PLANT_WORDS, (m) => (/vegan|plant-based/.test(m) ? " plant " : " ok "));

/** An ingredient's own wording says it can be left out. */
const REMOVABLE =
  /\b(optional|to serve|for serving|to garnish|for garnish|for dipping|for the glass|to rim|for the rim|for rinsing|to float)\b/;

// A later "or" choice only counts when it names a real substitute, so "chicken breasts or thighs" is still chicken.
const SUBSTITUTE =
  /\b(water|oil|vegetable|mushrooms?|tofu|beans|avocado|maple|agave|sparkling|soda water|tamari|cauliflower|corn tortillas|rice|lime|lemon|juice|salsa|sour cream|plant|ok|grapefruit soda|pineapple juice|extra broth|simple syrup)\b/;

/** The "or" choices in an ingredient line that name a real substitute ("water or chicken broth" → "water"). */
function substitutes(text: string): string[] {
  const main = text.replace(/\([^)]*\)/g, (m) => (/\bor\b/.test(m) ? m.replace(/[()]/g, " ") : m));
  const parts = main.split(/\s+or\s+/);
  return parts.length > 1 ? parts.filter((a) => SUBSTITUTE.test(clean(a))) : [];
}

type LineCheck = { verdict: "ok" | "unsure" | "bad"; hit: string; removable: boolean };

function check_text(text: string, r: Rule, gluten: boolean): Omit<LineCheck, "removable"> {
  // Nut checks read the words as written: coconut milk and peanut butter are not dairy, but they are nuts here.
  const base = r.raw ? text.toLowerCase().replace(/\b(butternut|nutmeg)\b/g, " ") : clean(text);
  const t = gluten ? base.replace(GLUTEN_FREE_WORDS, " ok ") : base;
  const bad = t.match(r.bad);
  if (bad) return { verdict: "bad", hit: bad[0] };
  const unsure = r.unsure && t.match(r.unsure);
  if (unsure) return { verdict: "unsure", hit: unsure[0] };
  return { verdict: "ok", hit: "" };
}

function check_line(text: string, r: Rule, gluten: boolean): LineCheck {
  const removable = REMOVABLE.test(text.toLowerCase());
  const whole = check_text(text, r, gluten);
  if (whole.verdict === "ok") return { ...whole, removable };
  // The standard recipe already allows a choice that fits ("butter or oil").
  if (substitutes(text).some((a) => check_text(a, r, gluten).verdict === "ok")) return { verdict: "ok", hit: "", removable };
  return { ...whole, removable };
}

function lines(recipe: Recipe): string[] {
  const out = recipe.ingredients.map((i) => `${i.item}`.trim());
  if (recipe.cocktail?.garnish) out.push(`${recipe.cocktail.garnish} (to garnish)`);
  return out;
}

function check_diet(recipe: Recipe, diet: Diet, has_version: boolean): { status: DietStatus; why: string } {
  const r = rule(diet)!;
  const checks = lines(recipe).map((l) => ({ line: l, ...check_line(l, r, diet === "gluten-free") }));
  const bad = checks.filter((c) => c.verdict === "bad");
  const unsure = checks.filter((c) => c.verdict === "unsure");
  if (!bad.length && !unsure.length) return { status: "fits", why: "" };
  if (!bad.length) return { status: "review", why: `check ${unsure.map((c) => `"${c.line}"`).join(", ")}` };
  if (has_version) return { status: "option", why: "hand-written version" };
  // When the title names what breaks the diet ("Beef Pho", "Cheese Fondue"), removing it makes a different dish.
  const named = r.core && clean(recipe.title).match(r.core);
  if (named && bad.some((c) => !c.removable)) return { status: "none", why: `the dish is defined by its ${named[0]}` };
  return { status: "option", why: bad.map((c) => c.hit).join(", ") };
}

/** Rough amount in cups, for telling a spoon of sugar or flour from a dessert's or a dough's worth. */
export function cups(amount: string, unit: string): number {
  const parts = amount
    .trim()
    .split(/[-–]| to /)[0]
    .trim()
    .split(/\s+/);
  let n = 0;
  for (const p of parts) {
    const f = p.match(/^(\d+)\/(\d+)$/);
    if (f) n += Number(f[1]) / Number(f[2]);
    else if (/^\d+(\.\d+)?$/.test(p)) n += Number(p);
  }
  const u = unit.toLowerCase();
  if (/^cups?$/.test(u)) return n;
  if (/^tbsp|tablespoons?$/.test(u)) return n / 16;
  if (/^tsp|teaspoons?$/.test(u)) return n / 48;
  if (/^(lb|lbs|pounds?)$/.test(u)) return n * 2;
  if (/^(oz|ounces?)$/.test(u)) return n / 8;
  if (/^(g|grams?)$/.test(u)) return n / 200;
  if (/^(kg)$/.test(u)) return n * 5;
  return 0;
}

// Words that look like a starch or sugar but aren't one here.
const NOT_CARB =
  /\b(garam masala|nihari masala|[a-z ]*masala|rice (?:vinegar|wine)|for the dough|pasta water|noodle water|corn husks|(?:long|green|fermented black|coffee) beans|honeycomb|corn oil|cornish)\b/g;
// Condiments with some sugar: they can be swapped for sugar-free ones, so they never make a dish "none".
const CONDIMENT = /\b(ketchup|barbecue sauce|hoisin|kecap manis|sweet soy|sweet chili sauce|mirin|chutney)\b/;

function check_low_carb(recipe: Recipe, kind: Kind): { status: DietStatus; why: string } {
  const starch = words(STARCH);
  const sugar = words(SUGAR);
  const drink_core = words(DRINK_CARB_CORE);
  const servings = Math.max(1, recipe.servings);
  // Leavening means a batter or dough: cakes, cookies, pancakes, breads.
  const baked = recipe.ingredients.some((i) => /\b(baking (?:powder|soda)|yeast)\b/i.test(i.item));
  const found: { hit: string; core: boolean }[] = [];
  for (const i of recipe.ingredients) {
    const text = i.item.toLowerCase().replace(NOT_CARB, " ");
    const alts = [text, ...substitutes(text)];
    // Any choice without carbs ("rice or cauliflower") means the standard recipe already allows it.
    const carby = alts.every((a) => {
      const t = a.replace(GLUTEN_FREE_WORDS, (m) => m.replace(/rice|corn|tortilla|noodles|potato/g, "starch"));
      return starch.test(t) || sugar.test(t) || (kind === "cocktail" && drink_core.test(t)) || /starch/.test(t);
    });
    if (!carby) continue;
    const removable = REMOVABLE.test(text) || /\b(for dusting|for the peel|for rolling|for frying|for coating)\b/.test(text);
    if (kind === "cocktail") {
      found.push({ hit: i.item, core: drink_core.test(text) && !removable });
      continue;
    }
    const total = cups(i.amount, i.unit);
    const is_starch = starch.test(text) || /starch/.test(text);
    // Flour, cornstarch or crumbs for a coating or a sauce can be swapped; flour in a batter or dough can't.
    const coating = /^(all-purpose |plain |fine dry |fine |italian |panko )?(flour|cornstarch|breadcrumbs|panko)/.test(text) && !baked;
    const big_sugar = sugar.test(text) && !CONDIMENT.test(text) && (total >= 0.5 || total / servings >= 0.125);
    found.push({ hit: i.item, core: !removable && ((is_starch && !coating) || big_sugar) });
  }
  if (!found.length) return { status: "fits", why: "" };
  const title = clean(recipe.title);
  const core = found.find((f) => f.core) ?? (title.match(words(STARCH_CORE_TITLE)) && kind === "meal" ? found[0] : undefined);
  if (core) return { status: "none", why: `"${core.hit}" is the heart of the dish` };
  return { status: "option", why: found.map((f) => f.hit).join(", ") };
}

/**
 * The diet labels and "Make it…" options for a recipe. hand_versions are the diets with hand-written versions
 * (vegetarian and vegan for some bundled dishes); overrides are the audit's decisions for one bundled dish.
 */
export function diet_profile(
  recipe: Recipe,
  kind: Kind,
  hand_versions: readonly Diet[] = [],
  overrides: Partial<Record<Diet, DietOverride>> = {},
): DietProfile {
  const status: DietProfile["status"] = {};
  for (const diet of DIETS) {
    if (diet === "non-alcoholic") {
      if (kind !== "cocktail" || !recipe.cocktail) continue;
      status[diet] = recipe.cocktail.alcoholic ? { status: "option", why: "alcoholic drink" } : { status: "fits", why: "" };
    } else if (diet === "low-carb") {
      status[diet] = check_low_carb(recipe, kind);
    } else {
      status[diet] = check_diet(recipe, diet, hand_versions.includes(diet));
    }
  }
  // A vegan version can't keep what a vegetarian one can't lose.
  if (status.vegetarian?.status === "none" && status.vegan?.status === "option" && !hand_versions.includes("vegan"))
    status.vegan = { ...status.vegetarian };
  for (const [diet, o] of Object.entries(overrides) as [Diet, DietOverride][]) if (status[diet]) status[diet] = o;
  const pick = (s: DietStatus) => DIETS.filter((d) => status[d]?.status === s);
  return { fits: pick("fits"), options: pick("option"), status };
}
