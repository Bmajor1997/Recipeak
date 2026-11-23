// The recipe screen driven through its real buttons: free and Premium diet versions on a new account, written
// versions used without AI, asking before an AI recipe for a typed name, and Recently viewed.
import { createRequire } from "node:module";
import { createElement, useState, type ComponentType, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RecipeScreen from "../src/app/recipe";
import { AppProvider, type CurrentRecipe } from "../src/AppContext";
import type { Recipe } from "../src/recipes/types";

type Instance = {
  props: Record<string, unknown>;
  findByProps: (props: Record<string, unknown>) => Instance;
  findAllByProps: (props: Record<string, unknown>) => Instance[];
};
type Rendered = { root: Instance; toJSON: () => unknown; unmount: () => void };
const { act, create } = createRequire(import.meta.url)("react-test-renderer") as {
  act: (fn: () => void | Promise<void>) => Promise<void>;
  create: (node: ReactElement) => Rendered;
};
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mocks = vi.hoisted(() => ({
  recipe: vi.fn(),
  bundled_version: vi.fn(),
  allowance: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  add_recent: vi.fn(),
  refresh_allowance: vi.fn(),
  camera: { photosLeft: 3 as number | null | undefined },
}));
vi.mock("../src/AppContext", async () => {
  const { createContext: create_context, useContext } = await import("react");
  const Context = create_context<unknown>(null);
  return { AppProvider: Context.Provider, useApp: () => useContext(Context) };
});
const TestProvider = AppProvider as unknown as ComponentType<{ value: unknown; children?: ReactNode }>;
vi.mock("expo-router", () => ({ router: { push: mocks.push, back: mocks.back } }));
vi.mock("expo-sharing", () => ({ shareAsync: vi.fn() }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: "Icon" }));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Image: "Image",
  TextInput: "TextInput",
  ActivityIndicator: "Spinner",
  Alert: { alert: vi.fn() },
  Share: { share: vi.fn() },
  Platform: { OS: "android" },
  StyleSheet: { create: (value: unknown) => value, absoluteFill: {}, hairlineWidth: 1 },
  useWindowDimensions: () => ({ width: 400, height: 800 }),
}));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock("../src/camera/CameraProvider", () => ({
  useCamera: () => ({ photosLeft: mocks.camera.photosLeft, refresh_allowance: mocks.refresh_allowance, open_camera: vi.fn() }),
}));
vi.mock("../src/onboarding/OnboardingProvider", () => ({ useOnboarding: () => ({ values: { diets: [] } }) }));
vi.mock("../src/settings/PreferencesProvider", () => ({ usePreferences: () => ({ busy: false, error: null, values: {} }) }));
vi.mock("../src/recipes/collectionPhotos", () => ({ COLLECTION: [] }));
vi.mock("../src/recipes/bundled", () => ({
  bundled_recipe: () => null,
  bundled_version: (id: string, diet: string | null) => mocks.bundled_version(id, diet),
  find_bundled_dish: () => null,
  bundled_photo_uri: async () => null,
}));
vi.mock("../src/recipes/useDishImage", () => ({ useDishImage: () => ({ uri: null, pending: false }) }));
vi.mock("../src/recipes/RateRecipe", () => ({ RateRecipe: () => null }));
vi.mock("../src/recipes/ReportRecipe", () => ({ ReportRecipe: () => null }));
vi.mock("../src/tips/TipsProvider", () => ({ useTips: () => ({ is_due: () => false, mark_seen: vi.fn() }) }));
vi.mock("../src/review/useStoreReviewPrompt", () => ({ useStoreReviewPrompt: () => vi.fn() }));

// The bundled Gimlet as it ships (data/recipes/src/cocktails-01.txt), with its written non-alcoholic version.
const GIMLET: Recipe = {
  title: "Gimlet",
  description: "Gin, fresh lime juice and simple syrup, shaken crisp.",
  servings: 1,
  prep_minutes: 3,
  cook_minutes: 0,
  ingredients: [
    { amount: "2", unit: "oz", item: "gin" },
    { amount: "3/4", unit: "oz", item: "fresh lime juice" },
    { amount: "3/4", unit: "oz", item: "simple syrup" },
  ],
  steps: ["Shake everything with ice.", "Strain into a chilled coupe."],
  allergens: [],
  cocktail: {
    glass: "coupe",
    garnish: "lime wheel",
    alcoholic: true,
    non_alcoholic_version: "Shake lime juice, syrup and a few cucumber slices and top with tonic water.",
  },
  note: "",
};
const PASTA: Recipe = {
  title: "Chicken pasta bake",
  description: "Baked pasta.",
  servings: 4,
  prep_minutes: 15,
  cook_minutes: 30,
  ingredients: [
    { amount: "1", unit: "lb", item: "chicken breast" },
    { amount: "12", unit: "oz", item: "penne pasta" },
    { amount: "1", unit: "cup", item: "mozzarella" },
  ],
  steps: ["Bake."],
  allergens: ["milk", "wheat"],
  cocktail: null,
  note: "",
};
const ready = (recipe: Recipe, kind: "meal" | "cocktail", extra: Partial<CurrentRecipe> = {}): CurrentRecipe =>
  ({
    status: "ready",
    recipe,
    kind,
    guesses: [{ name: recipe.title, confidence: "high", image: { status: "unavailable", url: null } }],
    selected: 0,
    image: { status: "unavailable", url: null },
    localPhoto: null,
    savedId: null,
    ...extra,
  }) as CurrentRecipe;

let tree: Rendered | undefined;
let start: CurrentRecipe;
function Harness() {
  const [current, set_current] = useState<CurrentRecipe | null>(start);
  const value = {
    current,
    set_current,
    api: { recipe: mocks.recipe, allowance: mocks.allowance, image_uri: () => null },
    saved: {},
    ratings: {},
    recent: { add: mocks.add_recent },
  };
  return createElement(TestProvider, { value }, createElement(RecipeScreen));
}
const text = () => JSON.stringify(tree!.toJSON());
async function open(current: CurrentRecipe) {
  start = current;
  await act(async () => {
    tree = create(createElement(Harness));
  });
}
async function press(label: string) {
  await act(async () => {
    await (tree!.root.findByProps({ label }).props.onPress as () => Promise<void>)();
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.camera.photosLeft = 3;
  mocks.add_recent.mockResolvedValue(undefined);
  mocks.bundled_version.mockReturnValue(null);
  mocks.allowance.mockResolvedValue({ premium: false, free_photos_left: 3, free_photos_total: 3 });
  mocks.recipe.mockImplementation(async (name: string) => ({
    recipe: { ...PASTA, title: `${name} (from the server)` },
    image: { status: "unavailable", url: null },
  }));
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
});

describe("diet versions on a new free account with no photos", () => {
  it("opens low-carb and non-alcoholic without the Premium screen", async () => {
    // No written non-alcoholic version here, so both come from the server, which allows them for free (server.test.js).
    const plain = { ...GIMLET, cocktail: { ...GIMLET.cocktail!, non_alcoholic_version: null } };
    for (const diet of ["low-carb", "non-alcoholic"]) {
      mocks.recipe.mockClear();
      await open(ready(plain, "cocktail", { picked: true, bundledId: "gimlet" }));
      await press(diet);
      expect(mocks.push).not.toHaveBeenCalled();
      expect(mocks.recipe).toHaveBeenCalledWith("Gimlet", "cocktail", diet);
      expect(text()).toContain("Gimlet (from the server)");
      await act(async () => tree?.unmount());
    }
  });

  it("keeps vegetarian and vegan versions Premium, before anything is asked of the server", async () => {
    for (const diet of ["vegetarian", "vegan"]) {
      mocks.push.mockClear();
      await open(ready(PASTA, "meal", { picked: true }));
      await press(diet);
      expect(mocks.push).toHaveBeenCalledWith({ pathname: "/upgrade", params: { reason: "versions" } });
      await act(async () => tree?.unmount());
    }
    expect(mocks.recipe).not.toHaveBeenCalled();
  });
});

describe("a written non-alcoholic version", () => {
  it("is used with no AI request, keeps the drink's identity, and switches back without asking either", async () => {
    await open(ready(GIMLET, "cocktail", { picked: true, bundledId: "gimlet" }));
    await press("non-alcoholic");
    expect(mocks.recipe).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(text()).toContain("Gimlet (non-alcoholic)");
    expect(text()).toContain("a few cucumber slices and top with tonic water");
    expect(text()).not.toContain('"gin"');
    // The chip again goes back to the regular drink.
    await press("non-alcoholic");
    expect(text()).toContain('"gin"');
    expect(text()).not.toContain("Gimlet (non-alcoholic)");
    expect(mocks.recipe).not.toHaveBeenCalled();
  });

  it("works the same for a recipe made with AI that carries its own non-alcoholic version", async () => {
    const ai = {
      ...GIMLET,
      title: "Basil smash",
      cocktail: { ...GIMLET.cocktail!, non_alcoholic_version: "replace gin with alcohol-free gin alternative." },
    };
    await open(ready(ai, "cocktail", { ai: true }));
    await press("non-alcoholic");
    expect(mocks.recipe).not.toHaveBeenCalled();
    expect(text()).toContain("alcohol-free gin alternative");
    expect(text()).not.toContain('"gin"');
  });
});

describe("a dish that opened in the person's diet version", () => {
  it("switches back to the regular recipe every time, never to the diet version it opened in", async () => {
    mocks.camera.photosLeft = null; // a subscriber, so vegan opens on its own
    const vegan = { ...PASTA, title: "Vegan pasta bake", ingredients: [{ amount: "12", unit: "oz", item: "penne pasta" }] };
    mocks.bundled_version.mockImplementation((_id: string, diet: string | null) =>
      diet === null ? { recipe: PASTA, already: false } : diet === "vegan" ? { recipe: vegan, already: false } : null,
    );
    await open(ready(vegan, "meal", { picked: true, bundledId: "pasta-bake", diet: "vegan" }));
    expect(text()).toContain("Vegan pasta bake");
    for (let round = 0; round < 2; round++) {
      await press("vegan"); // back to the regular recipe
      expect(text()).toContain("Chicken pasta bake");
      expect(text()).not.toContain("Vegan pasta bake");
      await press("vegan"); // and the vegan version again
      expect(text()).toContain("Vegan pasta bake");
    }
    expect(mocks.recipe).not.toHaveBeenCalled();
  });
});

describe("a typed dish name Recipeak doesn't have", () => {
  async function type_name(name: string) {
    await press("Not the right dish? Enter its name");
    await act(async () => {
      (tree!.root.findByProps({ accessibilityLabel: "Dish or cocktail name" }).props.onChangeText as (v: string) => void)(name);
    });
    await press("Find recipe");
  }

  it("asks first, says what it uses, and Not now sends nothing and goes back to the recipe", async () => {
    await open(ready(PASTA, "meal"));
    await type_name("Ube cheesecake");
    expect(text()).toContain("We don't have this meal yet");
    expect(text()).toContain("Recipeak doesn't have a recipe for Ube cheesecake yet.");
    expect(text()).toContain("check it a second time, and make a photo");
    expect(text()).toContain("extra recipes that come with each photo");
    expect(mocks.recipe).not.toHaveBeenCalled();
    await press("Not now");
    expect(mocks.recipe).not.toHaveBeenCalled();
    expect(mocks.back).not.toHaveBeenCalled();
    expect(text()).toContain("Chicken pasta bake");
  });

  it("makes it once on yes, however many times the button is tapped", async () => {
    await open(ready(PASTA, "meal"));
    await type_name("Ube cheesecake");
    const make = tree!.root.findByProps({ label: "Make AI recipe and photo" }).props.onPress as () => Promise<void>;
    await act(async () => {
      await Promise.all([make(), make(), make()]);
    });
    expect(mocks.recipe).toHaveBeenCalledTimes(1);
    expect(mocks.recipe).toHaveBeenCalledWith("Ube cheesecake", "meal", undefined, { correction: false });
    expect(text()).toContain("Ube cheesecake (from the server)");
  });

  it("after an unreadable photo, says it uses a free photo and refreshes the count", async () => {
    await open({ status: "problem", message: "That photo couldn't be read.", source: "photo" });
    await type_name("Ube cheesecake");
    expect(text()).toContain("It uses 1 of your free photos (3 left).");
    await press("Make AI recipe and photo");
    expect(mocks.recipe).toHaveBeenCalledWith("Ube cheesecake", "meal", undefined, { correction: true });
    expect(mocks.refresh_allowance).toHaveBeenCalled();
  });
});

describe("Recently viewed", () => {
  it("records a recipe made with AI whole, with its library photo, so it reopens without the AI", async () => {
    await open(ready(PASTA, "meal", { ai: true, image: { status: "ready", url: "/images/abc.jpg" }, picked: true }));
    expect(mocks.add_recent).toHaveBeenCalledWith({
      type: "generated",
      kind: "meal",
      name: "Chicken pasta bake",
      recipe: PASTA,
      image_url: "/images/abc.jpg",
    });
  });

  it("records a bundled dish by its id", async () => {
    // Also when it opened in the person's diet version.
    await open(ready(GIMLET, "cocktail", { bundledId: "gimlet", picked: true, diet: "vegan" }));
    expect(mocks.add_recent).toHaveBeenCalledWith({ type: "bundled", id: "gimlet" });
  });
});
