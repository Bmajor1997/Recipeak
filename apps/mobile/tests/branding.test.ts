import { describe, expect, it } from "vitest";
import config from "../app.json";

describe("Relish app configuration", () => {
  it("shows the name Relish, including in the camera and photo permission prompts", () => {
    expect(config.expo.name).toBe("Relish");
    const plugins = JSON.stringify(config.expo.plugins);
    expect(plugins).toContain("Allow Relish to photograph a meal or a cocktail");
    expect(plugins).toContain("Allow Relish to use a photo of a meal or a cocktail");
    expect(plugins).not.toMatch(/Recipeak|Recipeek/);
  });

  it("keeps the identifiers that installs, sign-in, subscriptions and links depend on", () => {
    // Changing any of these would make a new app in the stores, break Google/Apple sign-in, or orphan links.
    expect(config.expo.slug).toBe("meals-and-mixers");
    expect(config.expo.scheme).toBe("mealsandmixers");
    expect(config.expo.android.package).toBe("com.mealsandmixers.app");
    expect(config.expo.ios.bundleIdentifier).toBe("com.mealsandmixers.app");
    expect(config.expo.icon).toBe("./assets/icon.png");
  });
});
