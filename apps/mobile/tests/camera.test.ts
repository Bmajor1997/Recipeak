import { describe, expect, it } from "vitest";
import { not_food_message } from "../src/camera/photosLeft";
import { parse_identification } from "../src/recipes/parse";
import { CAPTURE_FAILED, flash_label, next_flash, should_dismiss, shutter_flash, usable_capture } from "../src/camera/cameraOptions";

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

describe("captures that can't be used", () => {
  it("only sends a capture with a file and a real size; a failed or empty one is never sent", () => {
    expect(usable_capture({ uri: "file:///cache/photo.jpg", width: 4032, height: 3024 })).toBe(true);
    for (const bad of [
      null,
      undefined,
      { uri: "", width: 10, height: 10 },
      { uri: "file:///x.jpg", width: 0, height: 3024 },
      { uri: "file:///x.jpg" },
    ])
      expect(usable_capture(bad), JSON.stringify(bad)).toBe(false);
    expect(CAPTURE_FAILED).toMatch(/Try again, or choose one from your photos/);
  });

  it("a blank or black photo is explained, with a retake and the gallery, and uses no free photo", async () => {
    expect(not_food_message("unusable")).toMatch(/blank or too dark.*choose one from your photos.*didn't use a free photo/);
    expect(not_food_message()).toBe("That doesn't look like a meal or a drink. Try again, closer up and in good light.");
    const reply = { kind: "not_food", guesses: [], free_photos_left: 3, premium: false, reason: "unusable" };
    expect(parse_identification(reply)).toEqual(reply);
    // An older server without the reason still reads as plain "not food".
    expect(parse_identification({ ...reply, reason: undefined })).toEqual({
      kind: "not_food",
      guesses: [],
      free_photos_left: 3,
      premium: false,
    });
  });
});
