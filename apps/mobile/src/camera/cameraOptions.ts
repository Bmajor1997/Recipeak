// Small, testable rules behind the camera sheet.
export type FlashSetting = "off" | "auto" | "on";

const FLASH_ORDER: FlashSetting[] = ["off", "auto", "on"];
export const next_flash = (current: FlashSetting): FlashSetting => FLASH_ORDER[(FLASH_ORDER.indexOf(current) + 1) % FLASH_ORDER.length];
export const flash_label = (setting: FlashSetting): string => ({ off: "Flash: Off", auto: "Flash: Auto", on: "Flash: On" })[setting];

/**
 * The on-screen "photo taken" flash: a quick, soft white glow, never a strobe.
 * With Reduce Motion turned on, it is dimmer and shorter.
 */
export function shutter_flash(reduceMotion: boolean) {
  return reduceMotion ? { peak: 0.25, riseMs: 60, fadeMs: 160 } : { peak: 0.55, riseMs: 90, fadeMs: 280 };
}

/** How the sheet appears: a springy slide up, or a plain fade with Reduce Motion. */
export const SHEET_SPRING = { damping: 22, stiffness: 220, mass: 0.9 };
export const SHEET_CLOSE_MS = 220;
/** Dragging the sheet down further than this (or flicking it) closes it. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 1.1;
export const should_dismiss = (dy: number, vy: number) => dy > DISMISS_DISTANCE || vy > DISMISS_VELOCITY;

/** How long the preview may take to start before the sheet says the camera isn't responding. */
export const CAMERA_START_TIMEOUT_MS = 10_000;

/**
 * What the camera area shows. A preview that never starts (no camera, one in use by another app, or a failed start)
 * says so with a way out, instead of staying black; a camera released while the app was in the background is
 * started again when the app comes back.
 */
export type CameraArea =
  | "checking" // permission still being read
  | "ask" // can ask for camera access
  | "settings" // access was refused for good: only the phone's Settings can allow it
  | "paused" // the app is in the background, so the camera is let go
  | "starting"
  | "preview"
  | "photo" // the photo just taken, to check
  | "unavailable";

export function camera_area(state: {
  permission: { granted: boolean; canAskAgain: boolean } | null;
  taken: boolean;
  active: boolean;
  ready: boolean;
  failed: boolean;
  timed_out: boolean;
}): CameraArea {
  if (state.taken) return "photo";
  if (!state.permission) return "checking";
  if (!state.permission.granted) return state.permission.canAskAgain ? "ask" : "settings";
  if (!state.active) return "paused";
  if (state.failed || (state.timed_out && !state.ready)) return "unavailable";
  return state.ready ? "preview" : "starting";
}
