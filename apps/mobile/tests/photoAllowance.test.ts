// The free-photo count shown on Home and the camera, and the offer on the signed-out start screen.
import { describe, expect, it } from "vitest";
import { photos_left_text } from "../src/camera/photosLeft";
import { FREE_PHOTOS, start_offer } from "../src/paywall/plans";

describe("photos left", () => {
  it("reads naturally for every count, and shows nothing while unknown or for Premium", () => {
    expect(photos_left_text(3)).toBe("3 free photos left");
    expect(photos_left_text(2)).toBe("2 free photos left");
    expect(photos_left_text(1)).toBe("1 free photo left");
    expect(photos_left_text(0)).toBe("No free photos left");
    expect(photos_left_text(undefined)).toBeNull(); // still loading, offline or failed: no number is guessed
    expect(photos_left_text(null)).toBeNull(); // Premium: no limit
  });

  it("the start screen states the new-account offer, and no number to someone returning", () => {
    expect(start_offer(false)).toBe(`New accounts get ${FREE_PHOTOS} free photos. No card needed.`);
    expect(start_offer(true)).not.toMatch(/\d/);
    expect(FREE_PHOTOS).toBe(3); // the allowance itself is unchanged
  });
});
