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

describe("Relish legal pages", () => {
  it("name Relish, and mention the old name only to say the app was renamed", async () => {
    const fs = await import("node:fs");
    for (const page of ["privacy", "terms"]) {
      const html = fs.readFileSync(new URL(`../../../server/legal/${page}.html`, import.meta.url), "utf8");
      expect(html, page).toMatch(/<h1>Relish (Privacy Policy|Terms of Use)<\/h1>/);
      expect(html.match(/Recipeak/g), page).toHaveLength(1);
      expect(html, page).toContain("Relish was previously called Recipeak; only the name has changed.");
    }
  });
});
