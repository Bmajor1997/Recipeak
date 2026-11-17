// The Home screen's shelves: tonight's meal-and-drink pairing and the rows of photos. Everything comes from the
// bundled collection, so Home works offline. Picks change once a day and are the same all day.
import recipes from "./collection.json";
import { COLLECTION, type CollectionDish } from "./collectionPhotos";

type BundledRecipe = { prep_minutes: number; cook_minutes: number; cocktail: { non_alcoholic_version: string | null } | null };
const RECIPES = recipes as Record<string, BundledRecipe>;
const BY_ID = new Map(COLLECTION.map((dish) => [dish.id, dish]));

export const dish_minutes = (dish: CollectionDish): number => {
  const r = RECIPES[dish.id];
  return r ? r.prep_minutes + r.cook_minutes : 0;
};

/** Days since 1 January 1970 in the phone's own time zone, so picks change at local midnight. */
export function local_day(now = new Date()): number {
  return Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
}

/** A shuffle that is the same for the same day, so Home doesn't change every time it's opened. */
function daily_shuffle<T>(items: T[], day: number): T[] {
  const out = [...items];
  let seed = (day * 2654435761) >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const pick = (ids: string[]) => ids.flatMap((id) => (BY_ID.has(id) ? [BY_ID.get(id)!] : []));

/** Meals and drinks that go well together, for "Tonight's pick". */
const PAIRINGS: [meal: string, drink: string, line: string][] = [
  ["fish-tacos", "margarita", "Crispy, bright and made for each other"],
  ["pepperoni-pizza", "negroni", "Italian classics, bitter meets savory"],
  ["chicken-tikka-masala", "gin-and-tonic", "A crisp, cooling partner for warm spices"],
  ["paella", "aperol-spritz", "A sunny Spanish feast with a spritz"],
  ["ribeye-steak", "old-fashioned", "A steakhouse night at home"],
  ["shrimp-scampi-pasta", "french-75", "Garlic, lemon and bubbles"],
  ["pad-thai", "mojito", "Sweet, sour and fresh with mint"],
  ["lasagna", "boulevardier", "Rich layers and a warm, bitter sip"],
  ["cheeseburger", "whiskey-sour", "Diner comfort with a frothy sour"],
  ["fish-and-chips", "tom-collins", "Pub classic with a tall, fizzy cooler"],
  ["chicken-shawarma", "paloma", "Spiced and juicy with grapefruit fizz"],
  ["beef-tacos", "mexican-firing-squad", "Taco night with a tequila punch"],
  ["butter-chicken", "moscow-mule", "Creamy curry and spicy ginger"],
  ["grilled-salmon", "gimlet", "Clean, simple and citrusy"],
  ["ramen", "japanese-cocktail", "A cozy bowl and a nutty classic"],
  ["chicken-parmesan", "americano", "Red sauce comfort with a light aperitivo"],
  ["jambalaya", "hurricane", "A New Orleans night in"],
  ["pulled-pork-sandwich", "mint-julep", "Southern barbecue and bourbon"],
  ["beef-bulgogi", "caipiroska", "Sweet-savory beef with a lime crush"],
  ["peruvian-ceviche", "pisco-sour", "Peru on a plate and in a glass"],
  ["trinidadian-doubles", "dark-n-stormy", "Caribbean street food with ginger and rum"],
  ["eggs-benedict", "mimosa", "The brunch power couple"],
  ["spaghetti-carbonara", "martini", "Rich pasta and a crisp, cold martini"],
  ["mushroom-risotto", "bamboo", "Earthy, creamy and a dry sherry sip"],
  ["thai-green-curry", "daiquiri", "Fragrant curry and a sharp, cool daiquiri"],
  ["coq-au-vin", "sidecar", "A French bistro dinner"],
  ["philly-cheesesteak", "salty-dog", "A hearty sandwich and a tart grapefruit cooler"],
  ["chicken-enchiladas", "tommy-s-margarita", "Saucy enchiladas and a clean margarita"],
  ["clam-chowder", "bloody-mary", "Seaside comfort with a savory sip"],
  ["gumbo", "sazerac", "Two New Orleans legends"],
];

export type Pairing = { meal: CollectionDish; drink: CollectionDish; line: string };

export const ALL_PAIRINGS: Pairing[] = PAIRINGS.flatMap(([meal, drink, line]) => {
  const m = BY_ID.get(meal);
  const d = BY_ID.get(drink);
  return m && d ? [{ meal: m, drink: d, line }] : [];
});

export function tonights_pick(day = local_day()): Pairing {
  return ALL_PAIRINGS[((day % ALL_PAIRINGS.length) + ALL_PAIRINGS.length) % ALL_PAIRINGS.length];
}

export type ShelfId = "quick" | "classics" | "weekend" | "alcohol-free" | "brunch" | "more-drinks" | "more-meals";
export type Shelf = { id: ShelfId; title: string; dishes: CollectionDish[] };

const CLASSICS = pick(
  "old-fashioned manhattan martini negroni daiquiri margarita sidecar sazerac whiskey-sour mojito gimlet tom-collins french-75 aviation last-word boulevardier mai-tai moscow-mule mint-julep cosmopolitan".split(
    " ",
  ),
);
const BRUNCH = pick(
  "eggs-benedict french-toast buttermilk-pancakes belgian-waffles omelet scrambled-eggs huevos-rancheros shakshuka breakfast-burrito chilaquiles oatmeal masala-dosa jamaican-ackee-and-saltfish mimosa bellini bloody-mary bloody-caesar breakfast-martini ramos-gin-fizz irish-coffee".split(
    " ",
  ),
);

/** Every dish on a shelf, for Explore's "See all". */
export const SHELVES: Record<ShelfId, { title: string; dishes: CollectionDish[] }> = {
  quick: { title: "Ready in 30 minutes", dishes: COLLECTION.filter((d) => d.kind === "meal" && dish_minutes(d) <= 30) },
  classics: { title: "Classic cocktails", dishes: CLASSICS },
  weekend: { title: "Weekend projects", dishes: COLLECTION.filter((d) => d.kind === "meal" && dish_minutes(d) >= 120) },
  "alcohol-free": {
    title: "Alcohol-free friendly",
    dishes: COLLECTION.filter((d) => d.kind === "cocktail" && Boolean(RECIPES[d.id]?.cocktail?.non_alcoholic_version)),
  },
  brunch: { title: "Brunch", dishes: BRUNCH },
  // Extra rows for people who chose "Mostly cocktails" or "Mostly meals" in the first-launch tour.
  "more-drinks": { title: "More drinks for you", dishes: COLLECTION.filter((d) => d.kind === "cocktail") },
  "more-meals": { title: "More meals for you", dishes: COLLECTION.filter((d) => d.kind === "meal") },
};

/** What the person wants more of (from the first-launch tour). Both kinds always show; this changes the mix. */
export type HomeMix = "cocktails" | "meals" | "both";

/**
 * Home's rows for each choice. "Mostly cocktails" puts the drink rows first and adds one more, so roughly two
 * rows in three are drinks; "Mostly meals" does the same for meals; "A bit of both" keeps the original even mix.
 */
const HOME_ROWS: Record<HomeMix, ShelfId[]> = {
  both: ["quick", "classics", "weekend", "alcohol-free", "brunch"],
  cocktails: ["classics", "alcohol-free", "more-drinks", "quick", "brunch"],
  meals: ["quick", "weekend", "more-meals", "brunch", "classics"],
};

export const is_shelf_id = (v: unknown): v is ShelfId => typeof v === "string" && v in SHELVES;

const SHELF_SEED: Record<ShelfId, number> = {
  quick: 0,
  classics: 1,
  weekend: 2,
  "alcohol-free": 3,
  brunch: 4,
  "more-drinks": 5,
  "more-meals": 6,
};

/** The rows on Home: up to 10 dishes from each shelf, in a new order every day, mixed to the person's taste. */
export function home_shelves(day = local_day(), size = 10, mix: HomeMix = "both"): Shelf[] {
  return HOME_ROWS[mix].map((id) => ({
    id,
    title: SHELVES[id].title,
    dishes: daily_shuffle(SHELVES[id].dishes, day + SHELF_SEED[id] * 7919).slice(0, size),
  }));
}

/** Four photos for the Explore card, changing daily: two of each, or three of the kind the person prefers. */
export function explore_collage(day = local_day(), mix: HomeMix = "both"): CollectionDish[] {
  const meals = daily_shuffle(
    COLLECTION.filter((d) => d.kind === "meal"),
    day + 31,
  );
  const drinks = daily_shuffle(
    COLLECTION.filter((d) => d.kind === "cocktail"),
    day + 37,
  );
  if (mix === "cocktails") return [drinks[0], meals[0], drinks[1], drinks[2]];
  if (mix === "meals") return [meals[0], drinks[0], meals[1], meals[2]];
  return [meals[0], drinks[0], meals[1], drinks[1]];
}

export const find_collection_dish = (id: string): CollectionDish | null => BY_ID.get(id) ?? null;
