# Recipeak

The app is called **Recipeak** (it started as Meals and Mixers). The repository is `Bmajor1997/Recipeak`; GitHub forwards the old `Recipeek` and `Meals-and-Mixers` addresses. The package ID and URL scheme keep the original `mealsandmixers` name so saved recipes and sign-ins keep working.

<p align="center">
  <img src="assets/app-icon.png" alt="Recipeak app icon: a white serif R inside the citrus camera ring, on near-black" width="256">
</p>

**Take a photo of a meal or a cocktail, and get a recipe for it.**

Recipeak is a camera app. Point it at a plate of food or a drink, and it identifies what the dish or cocktail is, then gives you a recipe to make it yourself.

The recipe is for that *kind* of dish or drink, not the exact recipe the restaurant or bar used. A photo of a margarita gets a good classic margarita recipe; a photo of chicken parmesan gets a solid chicken parmesan recipe. When the app isn't sure what it's looking at, it shows its best few guesses and lets you choose.

Status: **phase 1 (foundation) built**. See [docs/PROJECT-PLAN.md](docs/PROJECT-PLAN.md).

## Decisions so far

- **Android first**, then iPhone, built the same way as Votic (Expo / React Native) so one codebase serves both.
- **AI service: the same setup as Votic.** Photos go to our own backend server, which calls OpenAI. The OpenAI key lives only on the server, never in the app.
- **Signed in before the first photo**, then **3 free photos**, then the paid plan.
- **Saved** screen for recipes, **diet versions** (vegetarian, vegan, gluten-free and more), and **US measurements**.

## Running it

Both parts need Node 24.

**Backend** (from the repository root):

```sh
npm ci
cp .env.example .env.backend.local   # then open it in your editor and add the OpenAI key
npm run dev                           # http://127.0.0.1:8787
npm test
```

For local testing without Firebase, set `MM_DEV_ALLOW_UNAUTHENTICATED=1` in `.env.backend.local`. Production refuses to start with that setting, or without Firebase, RevenueCat and the usage ledger.

**Mobile app** (from `apps/mobile`):

```sh
npm ci
cp .env.example .env    # backend address and the public Firebase settings
npm start               # or: npm run android, for a development build on a phone or emulator
npm test && npm run typecheck && npm run lint
```

## What's in the repository

- `assets/app-icon.png` — the front-facing app image (also used for the app icons).
- `apps/mobile/` — the Expo / React Native app: sign-in, camera, recipe, Saved, and Settings screens. See [Settings behavior and validation](docs/SETTINGS.md).
- `admin/` — the private feedback dashboard, served at `/admin/feedback` (see "Feedback" in `docs/PROJECT-PLAN.md`).
- `server/` — the Node backend: sign-in check, free-photo allowance, usage and cost limits, and the OpenAI recipe calls.
- `docs/PROJECT-PLAN.md` — architecture, build phases and open questions.
- `.github/workflows/app-checks.yml` — tests, type-check, lint and an Android build of the app, plus backend tests.
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
