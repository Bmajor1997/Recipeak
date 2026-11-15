import { createRequire } from "node:module";
import { createElement, type ReactElement, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreferencesProvider, usePreferences } from "../src/settings/PreferencesProvider";
import { SettingsDetails } from "../src/settings/SettingsDetails";
import Settings from "../src/app/(tabs)/settings";
import CategoryScreen from "../src/app/settings/[category]";

type Instance = {
  props: Record<string, unknown>;
  findAllByType: (type: string) => Instance[];
  findByProps: (props: Record<string, unknown>) => Instance;
};
type Rendered = { root: Instance; toJSON: () => unknown; unmount: () => void; update: (node: ReactElement) => void };
const { act, create } = createRequire(import.meta.url)("react-test-renderer") as {
  act: (fn: () => void | Promise<void>) => Promise<void>;
  create: (node: ReactElement) => Rendered;
};
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mocks = vi.hoisted(() => ({
  user: { uid: "first", email: "first@example.test" },
  get: vi.fn(),
  set: vi.fn(),
  allowance: vi.fn(),
  list: vi.fn(),
  resetPassword: vi.fn(),
  signOut: vi.fn(),
  setCurrent: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
  canGoBack: vi.fn(),
  category: "preferences",
}));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: mocks.get, setItem: mocks.set } }));
vi.mock("../src/AppContext", () => {
  const api = { allowance: mocks.allowance };
  const saved = { list: mocks.list };
  return { useApp: () => ({ user: mocks.user, api, saved, setCurrent: mocks.setCurrent }) };
});
vi.mock("../src/auth/firebase", () => ({ firebase: { resetPassword: mocks.resetPassword, signOut: mocks.signOut } }));
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Switch: "Switch",
  ActivityIndicator: "ActivityIndicator",
  Modal: ({ visible, children, ...props }: { visible: boolean; children: ReactElement }) =>
    createElement("Modal", props, visible ? children : null),
  StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 },
  Share: { share: vi.fn().mockResolvedValue({ action: "sharedAction" }) },
}));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: "Icon" }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock("expo-router", () => ({
  router: { push: mocks.push, back: mocks.back, replace: mocks.replace, canGoBack: mocks.canGoBack },
  useLocalSearchParams: () => ({ category: mocks.category }),
  useFocusEffect: (fn: () => void | (() => void)) => useEffect(fn, [fn]),
}));
const mounted: Rendered[] = [];
async function render(node: ReactElement) {
  let tree!: Rendered;
  await act(async () => {
    tree = create(createElement(PreferencesProvider, null, node));
  });
  mounted.push(tree);
  return tree;
}
async function press(tree: Rendered, label: string) {
  await act(async () => {
    await (tree.root.findByProps({ accessibilityLabel: label }).props.onPress as () => void | Promise<void>)();
  });
}
const text = (tree: Rendered) => JSON.stringify(tree.toJSON());
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user = { uid: "first", email: "first@example.test" };
  mocks.get.mockResolvedValue(null);
  mocks.set.mockResolvedValue(undefined);
  mocks.list.mockResolvedValue([]);
  mocks.allowance.mockResolvedValue({ premium: false, free_photos_left: 2, free_photos_total: 3 });
  mocks.resetPassword.mockResolvedValue(undefined);
  mocks.signOut.mockResolvedValue(undefined);
  mocks.canGoBack.mockReturnValue(true);
  mocks.category = "preferences";
});
afterEach(async () => {
  await act(async () => {
    for (const tree of mounted.splice(0)) tree.unmount();
  });
});

describe("Settings interactions", () => {
  it("opens each category through the Settings hub", async () => {
    const tree = await render(createElement(Settings));
    for (const [label, category] of [
      ["Account", "account"],
      ["Preferences", "preferences"],
      ["Saved recipes & storage", "library"],
      ["Photo allowance", "usage"],
      ["Help & privacy", "help"],
    ]) {
      await press(tree, label);
      expect(mocks.push).toHaveBeenLastCalledWith({ pathname: "/settings/[category]", params: { category } });
    }
  });
  it("handles unknown routes and returns to the hub without a history entry", async () => {
    mocks.category = "not-a-category";
    mocks.canGoBack.mockReturnValue(false);
    const tree = await render(createElement(CategoryScreen));
    expect(text(tree)).toContain("isn’t available");
    await press(tree, "Back to Settings");
    expect(mocks.replace).toHaveBeenCalledWith("/(tabs)/settings");
  });
  it("disables preferences during loading, then saves a choice", async () => {
    let finish!: (value: string | null) => void;
    mocks.get.mockReturnValue(
      new Promise<string | null>((resolve) => {
        finish = resolve;
      }),
    );
    const tree = await render(createElement(SettingsDetails, { category: "preferences" }));
    expect(tree.root.findAllByType("Switch").every((s) => s.props.disabled)).toBe(true);
    await act(async () => {
      finish(null);
    });
    await act(async () => {
      await (tree.root.findByProps({ accessibilityLabel: "Pause photo wall" }).props.onValueChange as (value: boolean) => void)(true);
    });
    expect(mocks.set).toHaveBeenCalledWith(
      "mealsandmixers.preferences.v1.first",
      JSON.stringify({ pausePhotoWall: true, saveCoverPhotos: true }),
    );
    expect(tree.root.findByProps({ accessibilityLabel: "Pause photo wall" }).props.value).toBe(true);
    expect(text(tree)).toContain("Saved on this device.");
  });
  it("retains the previous switch value after a failed save", async () => {
    mocks.set.mockRejectedValue(new Error("disk full"));
    const tree = await render(createElement(SettingsDetails, { category: "preferences" }));
    await act(async () => {
      (tree.root.findByProps({ accessibilityLabel: "Keep offline cover photos" }).props.onValueChange as (v: boolean) => void)(false);
    });
    expect(tree.root.findByProps({ accessibilityLabel: "Keep offline cover photos" }).props.value).toBe(true);
    expect(text(tree)).toContain("previous choice is unchanged");
  });
  it("allows retry after preferences fail to load", async () => {
    mocks.get.mockRejectedValueOnce(new Error("disk")).mockResolvedValue(null);
    const tree = await render(createElement(SettingsDetails, { category: "preferences" }));
    expect(text(tree)).toContain("Try again before changing");
    await press(tree, "Retry loading preferences");
    expect(tree.root.findAllByType("Switch").every((s) => !s.props.disabled)).toBe(true);
  });
  it("does not carry another account's preferences across an account switch", async () => {
    mocks.get.mockResolvedValueOnce(JSON.stringify({ pausePhotoWall: true, saveCoverPhotos: false })).mockResolvedValue(null);
    function Probe() {
      return createElement("Probe", { values: usePreferences().values });
    }
    const tree = await render(createElement(Probe));
    expect(tree.root.findAllByType("Probe")[0].props.values).toEqual({ pausePhotoWall: true, saveCoverPhotos: false });
    mocks.user = { uid: "second", email: "second@example.test" };
    await act(async () => {
      tree.update(createElement(PreferencesProvider, null, createElement(Probe)));
    });
    expect(tree.root.findAllByType("Probe")[0].props.values).toEqual({ pausePhotoWall: false, saveCoverPhotos: true });
  });
  it("shows allowance errors and retries without showing a false zero", async () => {
    mocks.allowance
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ premium: false, free_photos_left: 2, free_photos_total: 3 });
    const tree = await render(createElement(SettingsDetails, { category: "usage" }));
    expect(text(tree)).toContain("Couldn’t load your photo allowance");
    expect(text(tree)).not.toContain("0 of");
    await press(tree, "Refresh photo allowance");
    expect(text(tree)).toContain("2 of 3 free photos left.");
  });
  it("confirms sign-out, lets the user cancel, and keeps failed requests retryable", async () => {
    const tree = await render(createElement(SettingsDetails, { category: "account" }));
    await press(tree, "Sign out");
    expect(mocks.signOut).not.toHaveBeenCalled();
    await press(tree, "Cancel");
    expect(mocks.signOut).not.toHaveBeenCalled();
    await press(tree, "Reset password");
    expect(mocks.resetPassword).toHaveBeenCalledWith("first@example.test");
    await press(tree, "Sign out");
    mocks.signOut.mockRejectedValueOnce(new Error("offline"));
    await press(tree, "Confirm sign out");
    expect(text(tree)).toContain("Couldn’t sign out");
    await press(tree, "Confirm sign out");
    expect(mocks.signOut).toHaveBeenCalledTimes(2);
    expect(mocks.setCurrent).toHaveBeenCalledWith(null);
  });
});
