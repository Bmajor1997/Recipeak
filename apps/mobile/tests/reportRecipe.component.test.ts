// "Report this recipe" opens its form in a sheet over the recipe (in view at once, above the keyboard), and keeps its
// validation, sending and cancel behaviour.
import { createRequire } from "node:module";
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AppProvider } from "../src/AppContext";
import { ReportRecipe } from "../src/recipes/ReportRecipe";

type Instance = {
  findByProps: (p: Record<string, unknown>) => Instance;
  type: unknown;
  props: Record<string, unknown>;
  findAllByType: (t: unknown) => Instance[];
};
type Rendered = { root: Instance; toJSON: () => unknown; unmount: () => void };
const { act, create } = createRequire(import.meta.url)("react-test-renderer") as {
  act: (fn: () => void | Promise<void>) => Promise<void>;
  create: (node: ReactElement, options?: { createNodeMock?: (element: { type: unknown }) => unknown }) => Rendered;
};
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { send, keyboard, scroll_to_end } = vi.hoisted(() => ({
  send: vi.fn(),
  // The keyboard's listeners, so the test can open and close it like Android does.
  keyboard: new Map<string, (event: { endCoordinates: { height: number } }) => void>(),
  scroll_to_end: vi.fn(),
}));
vi.mock("../src/AppContext", async () => {
  const { createContext: create_context, useContext } = await import("react");
  const Context = create_context<unknown>(null);
  return { AppProvider: Context.Provider, useApp: () => useContext(Context) };
});
const TestProvider = AppProvider as unknown as ComponentType<{ value: unknown; children?: ReactNode }>;
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  TextInput: "TextInput",
  Modal: "Modal",
  Platform: { OS: "android" },
  Keyboard: {
    addListener: (name: string, listener: (event: { endCoordinates: { height: number } }) => void) => {
      keyboard.set(name, listener);
      return { remove: () => keyboard.delete(name) };
    },
  },
  useWindowDimensions: () => ({ width: 320, height: 568 }),
}));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 10 }) }));
vi.mock("../src/ui/theme", () => ({
  Button: "Button",
  Notice: ({ children }: { children: ReactNode }) => createElement("Notice", null, children),
  useTheme: () => ({ type: {}, colors: new Proxy({}, { get: () => "#000" }) }),
}));

let tree: Rendered | undefined;
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
});
const tap = async (props: Record<string, unknown>) => {
  await act(async () => {
    await (tree!.root.findByProps(props).props.onPress as () => Promise<void>)();
  });
};

it("opens in a sheet that stays above the keyboard, checks for a reason, sends once, and cancels without sending", async () => {
  send.mockResolvedValue("id-1");
  await act(async () => {
    tree = create(
      createElement(
        TestProvider,
        { value: { api: { send_feedback: send } } },
        createElement(ReportRecipe, { kind: "cocktail", dish: "Gimlet" }),
      ),
      // The sheet's scroll view, so it can be asked to scroll the details box into view.
      { createNodeMock: (element: { type: unknown }) => (element.type === "ScrollView" ? { scrollToEnd: scroll_to_end } : null) },
    );
  });
  expect(tree!.root.findAllByType("Modal")).toHaveLength(0);
  await tap({ accessibilityLabel: "Report this recipe" });
  const [sheet] = tree!.root.findAllByType("Modal");
  expect(sheet.props.visible).toBe(true);
  // The keyboard opens for the details box: the sheet moves up by its height, fits above it, and scrolls the box and
  // Send report into view (Android, 568-high phone, 300 of it keyboard).
  await act(async () => (tree!.root.findByProps({ accessibilityLabel: "Details (optional)" }).props.onFocus as () => void)());
  await act(async () => keyboard.get("keyboardDidShow")!({ endCoordinates: { height: 300 } }));
  const moved = tree!.root.findByProps({ testID: "report-sheet" });
  expect(moved.props.style).toMatchObject({ marginBottom: 300 });
  const panel = moved.findByProps({ accessibilityViewIsModal: true });
  expect((panel.props.style as { maxHeight: number }).maxHeight).toBeCloseTo(568 * 0.9 - 20 - 300);
  expect(scroll_to_end).toHaveBeenCalled();
  // Closing the keyboard puts the sheet back.
  await act(async () => keyboard.get("keyboardDidHide")!({ endCoordinates: { height: 0 } }));
  expect(tree!.root.findByProps({ testID: "report-sheet" }).props.style).toMatchObject({ marginBottom: 0 });
  expect(sheet.findAllByType("ScrollView")[0].props.keyboardShouldPersistTaps).toBe("handled");
  // Cancel closes it and sends nothing.
  await tap({ label: "Cancel" });
  expect(tree!.root.findAllByType("Modal")).toHaveLength(0);
  expect(send).not.toHaveBeenCalled();
  // Again: no reason yet is explained, then a reason sends the report.
  await tap({ accessibilityLabel: "Report this recipe" });
  await tap({ label: "Send report" });
  expect(JSON.stringify(tree!.toJSON())).toContain("Choose why you're reporting this recipe.");
  const reason = tree!.root.findAllByType("Pressable").find((p) => p.props.accessibilityRole === "radio")!;
  await act(async () => (reason.props.onPress as () => void)());
  await tap({ label: "Send report" });
  expect(send).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(tree!.toJSON())).toContain("Thanks for telling us.");
  expect(tree!.root.findAllByType("Modal")).toHaveLength(0);
});
