// One start screen: the first launch and the signed-out sign-in screen are the same moving-photo screen, and signing
// out closes the last account's recipe, Saved list and history before that screen opens.
import { createRequire } from "node:module";
import { createElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Instance = {
  type: unknown;
  props: Record<string, unknown>;
  findByProps: (props: Record<string, unknown>) => Instance;
  findAllByProps: (props: Record<string, unknown>) => Instance[];
  findAllByType: (type: unknown) => Instance[];
};
type Rendered = { root: Instance; toJSON: () => unknown; unmount: () => void };
const { act, create } = createRequire(import.meta.url)("react-test-renderer") as {
  act: (fn: () => void | Promise<void>) => Promise<void>;
  create: (node: ReactElement) => Rendered;
};
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, __DEV__: false });

const mocks = vi.hoisted(() => ({
  entry: "create" as "create" | "sign-in",
  update: vi.fn(),
  listener: null as null | ((user: { uid: string } | null) => void),
  storage: new Map<string, string>(),
}));
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Image: "Image",
  TextInput: "TextInput",
  Modal: "Modal",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Linking: { openURL: vi.fn() },
  Platform: { OS: "android" },
  StyleSheet: { create: (value: unknown) => value, absoluteFill: {}, hairlineWidth: 1 },
  useWindowDimensions: () => ({ width: 360, height: 640 }),
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "SafeAreaView",
  useSafeAreaInsets: () => ({ top: 24, bottom: 16 }),
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: "Icon" }));
vi.mock("expo-camera", () => ({ useCameraPermissions: () => [null, vi.fn()] }));
// The drifting photos themselves (and their Reduce Motion handling) are checked in photoWall.test.ts.
vi.mock("../src/ui/SignInWall", () => ({ SignInWall: () => createElement("MovingPhotos") }));
vi.mock("../src/ui/theme", () => {
  const palette = new Proxy({}, { get: () => "#000000" });
  return {
    Button: "Button",
    Notice: ({ children }: { children: ReactNode }) => createElement("Notice", null, children),
    fonts: {},
    useTheme: () => ({ type: {}, colors: palette }),
    useThemedStyles: (make: (p: unknown) => unknown) => make(palette),
  };
});
vi.mock("../src/onboarding/OnboardingProvider", () => ({
  useOnboarding: () => ({ loaded: true, values: { done: false, interest: "both", diets: [], entry: mocks.entry }, update: mocks.update }),
}));
vi.mock("../src/paywall/Paywall", () => ({ Paywall: () => null }));
// eslint-disable-next-line @typescript-eslint/naming-convention -- react-test-renderer's and expo-asset's own method names
vi.mock("expo-asset", () => ({ Asset: { fromModule: () => ({}) } }));
vi.mock("../src/auth/firebase", () => ({
  firebaseConfigured: true,
  test_mode_available: false,
  sign_in_problem: () => "",
  firebase: {
    apple_available: async () => false,
    subscribe: (listener: (user: { uid: string } | null) => void) => {
      mocks.listener = listener;
      return () => {};
    },
    id_token: async () => "token",
  },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => mocks.storage.get(k) ?? null,
    setItem: async (k: string, v: string) => void mocks.storage.set(k, v),
    removeItem: async (k: string) => void mocks.storage.delete(k),
  },
}));
vi.mock("../src/paywall/subscriptions", () => ({ subscriptions: { identify: vi.fn(async () => {}), reset: vi.fn(async () => {}) } }));
vi.mock("../src/saved/photoStore", () => ({ keep_photo: vi.fn(), remove_photo: vi.fn() }));

let tree: Rendered | undefined;
const render = async (node: ReactElement) => {
  await act(async () => {
    tree = create(node);
  });
};
const labels = () => tree!.root.findAllByProps({ accessibilityRole: "button" }).map((b) => b.props.accessibilityLabel);
beforeEach(() => {
  mocks.entry = "create";
  mocks.update.mockReset();
  mocks.storage.clear();
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
});

describe("one start screen", () => {
  it("opens the app on the moving photos, with Get started and a way to log in", async () => {
    const { OnboardingTour } = await import("../src/onboarding/OnboardingTour");
    await render(createElement(OnboardingTour));
    expect(tree!.root.findAllByProps({ testID: "start-screen" })).toHaveLength(1);
    expect(tree!.root.findAllByType("MovingPhotos")).toHaveLength(1);
    expect(JSON.stringify(tree!.toJSON())).toContain("Every dish has a ");
    expect(labels()).toContain("Get started");
    // "I already have an account" finishes the tour into the same screen's Log in choices.
    const have_account = tree!.root.findAllByProps({ accessibilityRole: "button" }).find((b) => !b.props.accessibilityLabel)!;
    await act(async () => (have_account.props.onPress as () => void)());
    expect(mocks.update).toHaveBeenCalledWith({ done: true, entry: "sign-in" });
  });

  it("is the same screen when nobody is signed in, with the account choices", async () => {
    const SignIn = (await import("../src/app/sign-in")).default;
    await render(createElement(SignIn));
    expect(tree!.root.findAllByProps({ testID: "start-screen" })).toHaveLength(1);
    expect(tree!.root.findAllByType("MovingPhotos")).toHaveLength(1);
    expect(JSON.stringify(tree!.toJSON())).toContain("Every dish has a ");
    expect(labels()).toEqual(expect.arrayContaining(["Continue with Google", "Create account", "Log in"]));
  });

  it("after signing out (a returning account), offers Log in first on that same screen", async () => {
    mocks.entry = "sign-in";
    const SignIn = (await import("../src/app/sign-in")).default;
    await render(createElement(SignIn));
    expect(tree!.root.findAllByType("MovingPhotos")).toHaveLength(1);
    expect(JSON.stringify(tree!.toJSON())).toContain("Welcome back");
    expect(labels()).toEqual(expect.arrayContaining(["Continue with Google", "Log in with email", "Create account"]));
  });
});

describe("signing out", () => {
  it("closes the open recipe and the account's Saved list and history at once", async () => {
    const { AppProvider, useApp } = await import("../src/AppContext");
    const { SIGNED_OUT_SAVED } = await import("../src/saved/savedRecipes");
    let state: ReturnType<typeof useApp> | null = null;
    const Probe = () => {
      state = useApp();
      return null;
    };
    await render(createElement(AppProvider, null, createElement(Probe)));
    await act(async () => mocks.listener!({ uid: "alice" }));
    expect(state!.recent).not.toBeNull();
    expect(state!.saved).not.toBe(SIGNED_OUT_SAVED);
    await act(async () =>
      state!.set_current({
        status: "ready",
        kind: "meal",
        recipe: {
          title: "Alice's pho",
          description: "",
          servings: 1,
          prep_minutes: 1,
          cook_minutes: 1,
          ingredients: [],
          steps: [],
          allergens: [],
          cocktail: null,
          note: "",
        },
        guesses: [],
        selected: 0,
        image: { status: "unavailable", url: null },
        localPhoto: null,
        savedId: "a1",
      }),
    );
    await act(async () => mocks.listener!(null));
    expect(state!.user).toBeNull();
    expect(state!.current).toBeNull();
    expect(state!.saved).toBe(SIGNED_OUT_SAVED);
    expect(state!.recent).toBeNull();
    // Bob signing in on the same phone sees none of Alice's history.
    await mocks.storage.set("mealsandmixers.recent.v2.alice", JSON.stringify([{ type: "bundled", id: "pho" }]));
    await act(async () => mocks.listener!({ uid: "bob" }));
    expect(await state!.recent!.list()).toEqual([]);
  });
});
