import { createRequire } from "node:module";
import { createElement, useState, type ComponentType, type ReactNode, type ReactElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RecipeScreen from "../src/app/recipe";
import { AppProvider, type CurrentRecipe } from "../src/AppContext";
import type { Recipe } from "../src/recipes/types";

type Instance = { props: Record<string, unknown>; findByProps: (props: Record<string, unknown>) => Instance };
type Rendered = { root: Instance; toJSON: () => unknown; unmount: () => void };
const { act, create } = createRequire(import.meta.url)("react-test-renderer") as {
  act: (fn: () => void | Promise<void>) => Promise<void>;
  create: (node: ReactElement) => Rendered;
};
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mocks = vi.hoisted(() => ({ recipe: vi.fn(), addition: vi.fn(), allowance: vi.fn(), push: vi.fn(), use_app: () => ({}) }));
vi.mock("../src/AppContext", async () => {
  const { createContext: create_context, useContext } = await import("react");
  const Context = create_context<unknown>(null);
  return { AppProvider: Context.Provider, useApp: () => useContext(Context) };
});
const TestProvider = AppProvider as unknown as ComponentType<{ value: unknown; children?: ReactNode }>;
vi.mock("expo-router", () => ({ router: { push: mocks.push, back: vi.fn() } }));
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
vi.mock("../src/camera/CameraProvider", () => ({ useCamera: () => ({ photosLeft: undefined }) }));
vi.mock("../src/onboarding/OnboardingProvider", () => ({ useOnboarding: () => ({ values: { diets: [] } }) }));
vi.mock("../src/settings/PreferencesProvider", () => ({ usePreferences: () => ({ busy: false, error: null, values: {} }) }));
vi.mock("../src/recipes/collectionPhotos", () => ({ COLLECTION: [] }));
vi.mock("../src/recipes/bundled", () => ({ bundled_recipe: () => null, bundled_version: () => null }));
vi.mock("../src/recipes/useDishImage", () => ({ useDishImage: () => ({ uri: null, pending: false }) }));
vi.mock("../src/recipes/RateRecipe", () => ({ RateRecipe: () => null }));
vi.mock("../src/recipes/ReportRecipe", () => ({ ReportRecipe: () => null }));
vi.mock("../src/tips/TipsProvider", () => ({ useTips: () => ({ is_due: () => false, mark_seen: vi.fn() }) }));
vi.mock("../src/review/useStoreReviewPrompt", () => ({ useStoreReviewPrompt: () => vi.fn() }));

const base: Recipe = {
  title: "Chickpea salad",
  description: "A salad",
  servings: 2,
  prep_minutes: 10,
  cook_minutes: 0,
  ingredients: [
    { amount: "1", unit: "can", item: "chickpeas" },
    { amount: "50", unit: "g", item: "feta" },
  ],
  steps: ["Toss."],
  allergens: ["milk"],
  cocktail: null,
  note: "",
};
let tree: Rendered | undefined;
function Harness() {
  const [current, set_current] = useState<CurrentRecipe>({
    status: "ready",
    recipe: base,
    kind: "meal",
    guesses: [{ name: base.title, confidence: "high", image: { status: "unavailable", url: null } }],
    selected: 0,
    image: { status: "unavailable", url: null },
    picked: true,
    localPhoto: null,
    savedId: null,
  });
  const value = {
    current,
    set_current,
    api: { recipe: mocks.recipe, recipe_addition: mocks.addition, allowance: mocks.allowance },
    saved: {},
    ratings: {},
  };
  return createElement(TestProvider, { value }, createElement(RecipeScreen));
}
async function press(label: string) {
  await act(async () => {
    await (tree!.root.findByProps({ label }).props.onPress as () => Promise<void>)();
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.allowance.mockResolvedValue({ premium: true });
  mocks.addition.mockResolvedValue({ ...base, title: "Salad with chicken", ingredients: [{ amount: "1", unit: "lb", item: "chicken" }] });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
});

it("keeps the meat addition and its undo action after a replacement fails, then replaces it successfully", async () => {
  await act(async () => {
    tree = create(createElement(Harness));
  });
  await press("non-vegetarian");
  expect(JSON.stringify(tree!.toJSON())).toContain("Salad with chicken");
  mocks.recipe.mockRejectedValueOnce(new Error("offline"));
  await press("vegan");
  expect(JSON.stringify(tree!.toJSON())).toContain("Couldn't load that version");
  expect(JSON.stringify(tree!.toJSON())).not.toContain("Already ");
  await press("non-vegetarian");
  expect(JSON.stringify(tree!.toJSON())).toContain("Chickpea salad");
  expect(mocks.addition).toHaveBeenCalledTimes(1);
  await press("non-vegetarian");
  mocks.recipe.mockResolvedValueOnce({ recipe: base, image: { status: "unavailable" } });
  await press("vegan");
  expect(JSON.stringify(tree!.toJSON())).not.toContain("Tap non-vegetarian again");
  expect(JSON.stringify(tree!.toJSON())).toContain("Chickpea salad");
});

it("routes a free account to Premium before spending a recipe request", async () => {
  mocks.allowance.mockResolvedValue({ premium: false });
  await act(async () => {
    tree = create(createElement(Harness));
  });
  await press("non-vegetarian");
  expect(mocks.push).toHaveBeenCalledWith({ pathname: "/upgrade", params: { reason: "versions" } });
  expect(mocks.addition).not.toHaveBeenCalled();
});
