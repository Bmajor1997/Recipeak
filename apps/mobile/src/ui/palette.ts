// The light and dark colours. Kept apart from theme.tsx so plain code and tests can read them.

export type Scheme = "light" | "dark";

export type Palette = {
  background: string;
  surface: string;
  raised: string;
  scrim: string;
  text: string;
  muted: string;
  /** Grapefruit for filled buttons, badges and selected chips (with accentText on top). */
  accent: string;
  accentText: string;
  /** Grapefruit for text and icons drawn straight on the page; darker in light mode so it stays readable. */
  accentInk: string;
  /** A faint grapefruit wash behind a selected card. */
  accentTint: string;
  /** The outline of an unselected radio button or similar control. */
  control: string;
  danger: string;
  border: string;
};

// "Black and grapefruit": near-black so food photos carry the colour; the accent is the grapefruit in the app icon.
export const DARK_COLORS: Palette = {
  background: "#0F0F10",
  surface: "#1A1A1C",
  raised: "#26262A",
  scrim: "rgba(15, 15, 16, 0.92)",
  text: "#FFFFFF",
  muted: "#A9A9AD",
  accent: "#FF6F61",
  accentText: "#2B0A06",
  accentInk: "#FF6F61",
  accentTint: "#1F1513",
  control: "#5A5A60",
  danger: "#FFB3AB",
  border: "#2E2E33",
};

// The light version: a warm off-white page and white cards, with the same grapefruit.
export const LIGHT_COLORS: Palette = {
  background: "#FAF7F5",
  surface: "#FFFFFF",
  raised: "#F1ECE8",
  scrim: "rgba(250, 247, 245, 0.94)",
  text: "#1A1A1C",
  muted: "#5E5955",
  accent: "#FF6F61",
  accentText: "#2B0A06",
  accentInk: "#B93A2E",
  accentTint: "#FFF0EE",
  control: "#8A847F",
  danger: "#B42318",
  border: "#E4DDD8",
};
