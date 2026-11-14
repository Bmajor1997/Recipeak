import { describe, expect, it } from "vitest";
import { flashLabel, nextFlash, shouldDismiss, shutterFlash } from "../src/camera/cameraOptions";

describe("camera sheet rules", () => {
  it("cycles the flash setting Off → Auto → On → Off, with readable labels", () => {
    expect(nextFlash("off")).toBe("auto");
    expect(nextFlash("auto")).toBe("on");
    expect(nextFlash("on")).toBe("off");
    expect(flashLabel("auto")).toBe("Flash: Auto");
  });

  it("keeps the 'photo taken' flash soft and short, and softer with Reduce Motion", () => {
    const normal = shutterFlash(false);
    const reduced = shutterFlash(true);
    // Never a full-white strobe, and gone well within half a second.
    expect(normal.peak).toBeLessThanOrEqual(0.6);
    expect(normal.riseMs + normal.fadeMs).toBeLessThan(500);
    expect(reduced.peak).toBeLessThan(normal.peak);
    expect(reduced.riseMs + reduced.fadeMs).toBeLessThan(normal.riseMs + normal.fadeMs);
  });

  it("closes the sheet on a long drag or a quick flick down, but not a small nudge", () => {
    expect(shouldDismiss(30, 0.2)).toBe(false);
    expect(shouldDismiss(150, 0.2)).toBe(true);
    expect(shouldDismiss(40, 1.6)).toBe(true);
  });
});
