import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("one start screen", () => {
  it('opens the app on the moving photos and "Every dish has a recipe.", with Get started and a way to log in', () => {
    const tour = source("../src/onboarding/OnboardingTour.tsx");
    const welcome = tour.slice(tour.indexOf("function Welcome("), tour.indexOf("/** Progress bar"));
    expect(welcome).toMatch(/<SignInWall /);
    expect(welcome).toMatch(/Every dish has a/);
    expect(welcome).toMatch(/label="Get started"/);
    expect(welcome).toMatch(/I already have an account/);
  });

  it("doesn't repeat the moving photos or headline on sign-in, which follows the tour", () => {
    const sign_in = source("../src/app/sign-in.tsx");
    expect(sign_in).not.toMatch(/SignInWall/);
    expect(sign_in).not.toMatch(/Every dish has a <Text/);
    expect(sign_in).toMatch(/"Welcome back" : "Create your account"/);
  });
});
