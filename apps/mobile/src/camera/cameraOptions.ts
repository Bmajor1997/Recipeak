// Small, testable rules behind the camera sheet.
export type FlashSetting = "off" | "auto" | "on";

const FLASH_ORDER: FlashSetting[] = ["off", "auto", "on"];
export const nextFlash = (current: FlashSetting): FlashSetting => FLASH_ORDER[(FLASH_ORDER.indexOf(current) + 1) % FLASH_ORDER.length];
export const flashLabel = (setting: FlashSetting): string => ({ off: "Flash: Off", auto: "Flash: Auto", on: "Flash: On" })[setting];

/**
 * The on-screen "photo taken" flash: a quick, soft white glow, never a strobe.
 * With Reduce Motion turned on, it is dimmer and shorter.
 */
export function shutterFlash(reduceMotion: boolean) {
  return reduceMotion ? { peak: 0.25, riseMs: 60, fadeMs: 160 } : { peak: 0.55, riseMs: 90, fadeMs: 280 };
}

/** How the sheet appears: a springy slide up, or a plain fade with Reduce Motion. */
export const SHEET_SPRING = { damping: 22, stiffness: 220, mass: 0.9 };
export const SHEET_CLOSE_MS = 220;
/** Dragging the sheet down further than this (or flicking it) closes it. */
export const DISMISS_DISTANCE = 120;
export const DISMISS_VELOCITY = 1.1;
export const shouldDismiss = (dy: number, vy: number) => dy > DISMISS_DISTANCE || vy > DISMISS_VELOCITY;
