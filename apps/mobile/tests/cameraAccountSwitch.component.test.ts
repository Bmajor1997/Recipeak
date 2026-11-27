// A photo's answer that arrives after a different account has signed in is ignored: the next account never sees the
// last account's free-photo count or recipe (2026-11-27 audit of main, 09832ae).
import { create_recipe_requests } from "../src/recipes/recipeRequests";
import { createRequire } from "node:module";
import { createElement, type ReactElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

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
const requests = create_recipe_requests();
const api = { identify: mocks.identify, allowance: mocks.allowance };
vi.mock("../src/AppContext", () => ({
  useApp: () => ({ recipe_requests: requests, user: mocks.user, set_current: mocks.set_current, api }),
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
beforeEach(() => {
  mocks.user = { uid: "alice" };
  mocks.identify.mockReset();
  mocks.allowance.mockResolvedValue({ premium: false, free_photos_left: 3 });
  mocks.set_current.mockReset().mockImplementation(() => requests.invalidate());
});
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

it("keeps the newer photo when responses finish out of order", async () => {
  const answers: ((value: unknown) => void)[] = [];
  mocks.identify.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
  await act(async () => {
    tree = create(app());
  });
  let first: Promise<void>;
  let second: Promise<void>;
  await act(async () => {
    first = mocks.on_photo!({ uri: "file:///a.jpg", width: 100, height: 100 });
  });
  await act(async () => {
    second = mocks.on_photo!({ uri: "file:///b.jpg", width: 100, height: 100 });
  });
  const reply = (name: string, left: number) => ({
    kind: "meal",
    guesses: [{ name, confidence: "high" }],
    premium: false,
    free_photos_left: left,
  });
  await act(async () => {
    answers[1](reply("New photo", 1));
    await second;
  });
  expect(mocks.set_current.mock.lastCall![0].guesses[0].name).toBe("New photo");
  mocks.set_current.mockClear();
  await act(async () => {
    answers[0](reply("Old photo", 2));
    await first;
  });
  expect(mocks.set_current).not.toHaveBeenCalled();
  expect(report.mock.lastCall![0]).toBe(1);
});

it.each(["clear", "leave", "account returns"])("ignores an answer after %s", async (action) => {
  let answer: (value: unknown) => void = () => {};
  mocks.identify.mockImplementation(
    () =>
      new Promise((resolve) => {
        answer = resolve;
      }),
  );
  await act(async () => {
    tree = create(app());
  });
  let sending: Promise<void>;
  await act(async () => {
    sending = mocks.on_photo!({ uri: "file:///a.jpg", width: 100, height: 100 });
  });
  if (action === "clear") mocks.set_current(null);
  else if (action === "leave")
    await act(async () => {
      tree!.unmount();
      tree = undefined;
    });
  else {
    mocks.user = { uid: "bob" };
    await act(async () => tree!.update(app()));
    mocks.user = { uid: "alice" };
    await act(async () => tree!.update(app()));
  }
  mocks.set_current.mockClear();
  await act(async () => {
    answer({ kind: "not_food", guesses: [], premium: false, free_photos_left: 0 });
    await sending;
  });
  expect(mocks.set_current).not.toHaveBeenCalled();
});
