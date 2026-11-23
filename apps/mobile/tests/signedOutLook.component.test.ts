// The start and sign-in screens use the app's own look (light, dark or match phone, and the button colour) from the
// last account, instead of falling back to "match phone" whenever nobody is signed in.
import { createRequire } from "node:module";
import { createElement, type ReactElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

type Rendered = { unmount: () => void; update: (node: ReactElement) => void };
const { act, create } = createRequire(import.meta.url)("react-test-renderer") as {
  act: (fn: () => void | Promise<void>) => Promise<void>;
  create: (node: ReactElement) => Rendered;
};
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mocks = vi.hoisted(() => ({ storage: new Map<string, string>(), user: null as { uid: string } | null }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => mocks.storage.get(k) ?? null,
    setItem: async (k: string, v: string) => void mocks.storage.set(k, v),
    removeItem: async (k: string) => void mocks.storage.delete(k),
  },
}));
vi.mock("../src/AppContext", () => ({ useApp: () => ({ user: mocks.user }) }));

const { PreferencesProvider, usePreferences } = await import("../src/settings/PreferencesProvider");
type State = ReturnType<typeof usePreferences>;
const report = vi.fn<(state: State) => void>();
const Probe = () => {
  report(usePreferences());
  return null;
};
/** What the screens see now. */
const latest = (): State => report.mock.lastCall![0];
let tree: Rendered | undefined;
const app = () => createElement(PreferencesProvider, null, createElement(Probe));
const render = async () => {
  await act(async () => {
    tree = create(app());
  });
};
const rerender = async () => {
  await act(async () => tree!.update(app()));
};

beforeEach(() => {
  mocks.storage.clear();
  mocks.user = null;
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
});

it("keeps the account's dark look and button colour on the start and sign-in screens after signing out", async () => {
  mocks.user = { uid: "alice" };
  await render();
  await act(async () => {
    await latest().update("appearance", "dark");
  });
  await act(async () => {
    await latest().update("accent", "blue");
  });
  // Signing out: nobody is signed in, so these are the values the sign-in screen is drawn with.
  mocks.user = null;
  await rerender();
  expect(latest().values).toMatchObject({ appearance: "dark", accent: "blue" });
});

it("opens signed out in the last account's light look, even if the phone is dark", async () => {
  mocks.storage.set("mealsandmixers.preferences.v1.bob", JSON.stringify({ appearance: "light", accent: "coral" }));
  mocks.user = { uid: "bob" };
  await render();
  await act(async () => tree?.unmount());
  // The app opens again with nobody signed in.
  mocks.user = null;
  await render();
  expect(latest().values.appearance).toBe("light");
});

it("follows the phone on a first launch, before any account has chosen", async () => {
  await render();
  expect(latest().values.appearance).toBe("system");
});

it("never overrides an account's own look with the device's", async () => {
  mocks.storage.set("mealsandmixers.look.v1", JSON.stringify({ appearance: "dark", accent: "coral" }));
  mocks.storage.set("mealsandmixers.preferences.v1.carol", JSON.stringify({ appearance: "light", accent: "coral" }));
  mocks.user = { uid: "carol" };
  await render();
  expect(latest().values.appearance).toBe("light");
});
