# Meals and Mixers — project plan

Status: **draft for review**, 2026-11-14.

## 1. What the app does

1. The user takes a photo of a meal or a cocktail, or picks one from their gallery.
2. The app identifies the dish or drink.
3. The app shows a recipe for it: ingredients with amounts, steps, time and servings.

The recipe represents that kind of dish or drink. It is not the exact recipe the restaurant or bar used, and the app says so plainly.

If the app is unsure, it shows its top two or three guesses and the user picks one. If the photo is not food or drink, the app says so instead of guessing.

## 2. Decisions made

| Decision | Choice |
| --- | --- |
| Platforms | Android first, iPhone later, from one codebase |
| App framework | Expo / React Native, the same as Votic |
| AI service | Same as Votic: our backend calls OpenAI; the key stays on the server |

## 3. How it is built (reusing Votic's setup)

| Part | What it is | Reused from Votic |
| --- | --- | --- |
| Mobile app | Expo / React Native app in `apps/mobile`, with the camera, results and saved recipes | Expo setup, camera module, build workflows (Android test APK, Play AAB, later iOS) |
| Backend | Node 24 server with one main endpoint, `POST /api/identify-recipe` | OpenAI gateway, request limits, deadlines, deployment files (Google Cloud VM + Caddy) |
| AI calls | OpenAI Responses API with image input and a strict JSON reply shape | Model configuration, `store:false`, bounded output, no automatic retries |
| Accounts | Firebase sign-in, so AI limits apply per verified account | Firebase token verification |
| Usage limits and cost control | Private SQLite ledger: reserve before each AI call, settle after | `ai_usage` ledger, per-account and global daily/monthly caps |
| Payments (if any) | RevenueCat, checked on the server | RevenueCat entitlement verification |
| Security CI | Already in this repository | Ported in the first commit |

### The recipe reply

The backend asks the model for a fixed JSON shape, and rejects anything that doesn't match it:

- `kind`: `meal`, `cocktail`, or `not_food`
- `guesses`: up to 3, each with a name and a confidence level
- `recipe` for the chosen guess: title, short description, servings, prep and cook time, ingredients (amount, unit, item), steps, and allergens it contains
- for cocktails: glass, garnish, and whether it is alcoholic, with a non-alcoholic version where one makes sense

Choosing a different guess asks for that recipe by name (a text-only call), so the photo is only sent once.

## 4. Privacy and safety

- **Photos are not kept.** The backend sends the photo to OpenAI with `store:false`, returns the recipe, and discards the image. The usage ledger records counts and costs only, never photos, as in Votic.
- **No secrets in the app.** The OpenAI, RevenueCat and Firebase admin credentials stay in the backend's secret settings, the same as Votic.
- **Allergens.** Every recipe lists common allergens it contains, with a note that the photo cannot show hidden ingredients.
- **Alcohol.** Cocktail recipes affect the app's content rating in the app stores. Plan an age confirmation before alcoholic recipes are shown, and always offer non-alcoholic versions.
- **Untrusted input.** Text in a photo (a menu, a sign) is treated as content, never as instructions to the AI.

## 5. Build phases

1. **Foundation:** set up the Expo app and the Node backend from Votic's patterns, and run them locally with the security checks passing.
2. **Core loop:** camera or gallery photo → `/api/identify-recipe` → recipe screen, with guesses, a "not food" answer and error states. Includes tests with sample photos.
3. **Accounts and limits:** Firebase sign-in, the usage ledger and per-account caps, before any public testing.
4. **Saving and sharing:** save recipes on the device, scale servings, share a recipe as text.
5. **Android release:** test APK, Play internal testing, privacy policy, Play data-safety form, content rating.
6. **iPhone:** iOS build workflow, camera permission text, App Store review.

## 6. Open questions

- **Free and paid:** how many free photos a day or month, and is there a paid plan through RevenueCat like Votic?
- **Sign-in:** is sign-in needed before the first photo, or only after a few free tries?
- **Saved recipes:** kept on the phone only, or synced to the account?
- **Diet options:** should users be able to ask for vegetarian, gluten-free or other versions of a recipe?
- **Units:** US cups and ounces, metric, or a switch?
