// A photo's answer that arrives after a different account has signed in is ignored: the next account never sees the
// last account's free-photo count or recipe (2026-11-27 audit of main, 09832ae).
import { createRequire } from "node:module";
import { createElement, type ReactElement } from "react";
import { afterEach, expect, it, vi } from "vitest";

type Rendered = { update: (node: ReactElement) => void; unmount: () => void };
const { act, create } = createRequire(import.meta.url)("react-test-renderer") as {
  act: (fn: () => void | Promise<void>) => Promise<void>;
  create: (node: ReactElement) => Rendered;
};
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mocks = vi.hoisted(() => ({
  user: { uid: "alice" } as { uid: string } | null,
  set_current: vi.fn(),
  identify: vi.fn(),
  allowance: vi.fn(),
  on_photo: null as null | ((photo: { uri: string; width: number; height: number }) => Promise<void>),
}));
vi.mock("../src/AppContext", () => ({
  useApp: () => ({ user: mocks.user, set_current: mocks.set_current, api: { identify: mocks.identify, allowance: mocks.allowance } }),
}));
vi.mock("expo-router", () => ({ router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock("../src/photos/prepare", () => ({ prepare_photo: async () => ({ dataUrl: "data:image/jpeg;base64,x" }) }));
vi.mock("../src/recipes/bundled", () => ({
  find_bundled_dish: () => null,
  bundled_recipe: () => null,
  bundled_photo_uri: async () => null,
}));
vi.mock("../src/camera/CameraSheet", () => ({
  CameraSheet: (props: { onPhoto: typeof mocks.on_photo }) => {
    mocks.on_photo = props.onPhoto;
    return null;
  },
}));

const { CameraProvider, useCamera } = await import("../src/camera/CameraProvider");
const report = vi.fn<(left: number | null | undefined) => void>();
const Probe = () => {
  report(useCamera().photosLeft);
  return null;
};
const app = () => createElement(CameraProvider, null, createElement(Probe));
let tree: Rendered | undefined;
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
});

it("ignores a photo answer meant for the account that signed out", async () => {
  mocks.allowance.mockImplementation(async () => ({ premium: false, free_photos_left: mocks.user?.uid === "bob" ? 3 : 1 }));
  let answer: (value: unknown) => void = () => {};
  mocks.identify.mockImplementation(() => new Promise((r) => (answer = r)));
  await act(async () => {
    tree = create(app());
  });
  expect(report.mock.lastCall![0]).toBe(1);
  // Alice sends a photo, then signs out and Bob signs in before the answer comes.
  let sending: Promise<void> = Promise.resolve();
  await act(async () => {
    sending = mocks.on_photo!({ uri: "file:///p.jpg", width: 100, height: 100 });
  });
  mocks.user = { uid: "bob" };
  await act(async () => tree!.update(app()));
  expect(report.mock.lastCall![0]).toBe(3);
  mocks.set_current.mockClear();
  await act(async () => {
    answer({
      kind: "meal",
      guesses: [{ name: "Alice's curry", confidence: "high", image: { status: "unavailable", url: null } }],
      free_photos_left: 0,
      premium: false,
    });
    await sending;
  });
  expect(report.mock.lastCall![0]).toBe(3);
  expect(mocks.set_current).not.toHaveBeenCalled();
});
