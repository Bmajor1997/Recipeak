import { describe, expect, it } from "vitest";
import { flash_label, next_flash, should_dismiss, shutter_flash } from "../src/camera/cameraOptions";

describe("camera sheet rules", () => {
  it("cycles the flash setting Off → Auto → On → Off, with readable labels", () => {
    expect(next_flash("off")).toBe("auto");
    expect(next_flash("auto")).toBe("on");
    expect(next_flash("on")).toBe("off");
    expect(flash_label("auto")).toBe("Flash: Auto");
  });

  it("keeps the 'photo taken' flash soft and short, and softer with Reduce Motion", () => {
    const normal = shutter_flash(false);
    const reduced = shutter_flash(true);
    // Never a full-white strobe, and gone well within half a second.
    expect(normal.peak).toBeLessThanOrEqual(0.6);
    expect(normal.riseMs + normal.fadeMs).toBeLessThan(500);
    expect(reduced.peak).toBeLessThan(normal.peak);
    expect(reduced.riseMs + reduced.fadeMs).toBeLessThan(normal.riseMs + normal.fadeMs);
  });

  it("closes the sheet on a long drag or a quick flick down, but not a small nudge", () => {
    expect(should_dismiss(30, 0.2)).toBe(false);
    expect(should_dismiss(150, 0.2)).toBe(true);
    expect(should_dismiss(40, 1.6)).toBe(true);
  });
});
