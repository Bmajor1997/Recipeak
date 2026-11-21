// The light and dark colours. Kept apart from theme.tsx so plain code and tests can read them.

export type Scheme = "light" | "dark";

export type Palette = {
  background: string;
  surface: string;
  raised: string;
  scrim: string;
  text: string;
  muted: string;
  /** Grapefruit (or blue, if chosen in Settings) for filled buttons, badges and selected chips (with accentText on top). */
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

/** The colour of buttons, links and highlights, chosen in Settings: Recipeak's coral (the default) or blue. */
export type AccentColor = "coral" | "blue";
export const ACCENT_COLORS: AccentColor[] = ["coral", "blue"];

type AccentKeys = Pick<Palette, "accent" | "accentText" | "accentInk" | "accentTint">;

// Blue keeps the same readable contrast as coral: dark text on the bright fill in dark mode, white text on the
// deeper fill in light mode, and a darker blue for text and icons drawn straight on the light page.
const BLUE: Record<Scheme, AccentKeys> = {
  dark: { accent: "#6EA8FE", accentText: "#04132B", accentInk: "#6EA8FE", accentTint: "#111A2B" },
  light: { accent: "#2563EB", accentText: "#FFFFFF", accentInk: "#1D4ED8", accentTint: "#EEF4FF" },
};

/** The full palette for a light or dark look with the chosen accent colour. */
export function palette_for(scheme: Scheme, accent: AccentColor = "coral"): Palette {
  const base = scheme === "light" ? LIGHT_COLORS : DARK_COLORS;
  return accent === "blue" ? { ...base, ...BLUE[scheme] } : base;
}
