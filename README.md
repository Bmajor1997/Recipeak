# Meals and Mixers

<p align="center">
  <img src="assets/app-icon.png" alt="Meals and Mixers app icon: a plated dish with tomato and asparagus beside a pink cocktail garnished with a grapefruit slice" width="256">
</p>

**Take a photo of a meal or a cocktail, and get a recipe for it.**

Meals and Mixers is a camera app. Point it at a plate of food or a drink, and it identifies what the dish or cocktail is, then gives you a recipe to make it yourself.

The recipe is for that *kind* of dish or drink, not the exact recipe the restaurant or bar used. A photo of a margarita gets a good classic margarita recipe; a photo of chicken parmesan gets a solid chicken parmesan recipe. When the app isn't sure what it's looking at, it shows its best few guesses and lets you choose.

Status: **planning**. See [docs/PROJECT-PLAN.md](docs/PROJECT-PLAN.md).

## Decisions so far

- **Android first**, then iPhone, built the same way as Votic (Expo / React Native) so one codebase serves both.
- **AI service: the same setup as Votic.** Photos go to our own backend server, which calls OpenAI. The OpenAI key lives only on the server, never in the app.

## What's in the repository

- `assets/app-icon.png` — the front-facing app image.
- `docs/PROJECT-PLAN.md` — architecture, build phases and open questions.
- `.github/workflows/security-checks.yml` — code quality and security CI, ported from Votic. Runs on every push and pull request, and weekly.
- `.github/workflows/release-sbom.yml` — attaches a software bill of materials to each published release.
- `.github/dependabot.yml` — weekly updates for npm packages and the pinned GitHub Actions.
- `.github/CODEOWNERS` — review ownership.
- `security/` — scan verifiers, the dependency-exception gate and the vulnerability report.
- `docs/security/SECURITY-BASELINE.md` — the security standards this app targets.
- `.gitleaks.toml`, `.gitleaksignore`, `osv-scanner.toml` — scanner configuration and exception lists.

Run the security tooling tests with:

```sh
node --test code_checks/*.test.js
```
