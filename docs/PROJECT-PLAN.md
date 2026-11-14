# Meals and Mixers — project plan

Status: **approved; phase 1 in progress**, updated 2026-11-14.

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
| App framework | Expo / React Native, the same as Votic (on the newer Expo SDK 58) |
| AI service | Same as Votic: our backend calls OpenAI; the key stays on the server |
| Sign-in | Required before the first photo (Firebase, like Votic) |
| Free use | 3 free photos per account, then the paid plan (RevenueCat, like Votic) |
| Saved recipes | A **Saved** screen in the app; stored on the phone first, synced to the account later |
| Diet versions | Users can ask for vegetarian, vegan, gluten-free, dairy-free and other versions of a recipe |
| Units | US measurements (cups, tablespoons, ounces, °F) |

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

Choosing a different guess, or asking for a diet version, asks for that recipe by name (a text-only call), so the photo is only sent once. These follow-up calls do not use up a free photo.

All amounts use US measurements.

### Free photos

Each account gets 3 free photos, counted on the server against the verified account (never a number sent by the phone). A photo counts when the app returns a meal or cocktail. A failed request, or a photo that turns out not to be food or drink, does not use one up; daily and per-minute limits stop abuse of that rule.

### The camera

Modelled on the ChatGPT app's camera. The Home screen has a **Camera** button; the camera slides up from the bottom as a rounded sheet with:

- a large white **shutter** button in the middle,
- a **back** arrow on the left (dragging the sheet down, or Android's back button, also closes it),
- a **three-dot menu** on the right: *Choose from photos*, *Flash: Off / Auto / On*, and *Use front/back camera*.

When a photo is taken, people get three signals: the **shutter sound**, a **soft white flash** on screen (about a quarter of a second, never a strobe), and a **light vibration**. Screen readers announce "Photo taken. Finding your recipe." The photo then stays on screen with "Finding your recipe…" until the recipe opens. If it isn't food or drink, the message appears inside the camera so they can retake straight away. With the phone's Reduce Motion setting on, the sheet fades instead of sliding and the flash is dimmer.

## 4. Privacy and safety

- **Photos are not kept.** The backend sends the photo to OpenAI with `store:false`, returns the recipe, and discards the image. The usage ledger records counts and costs only, never photos, as in Votic.
- **No secrets in the app.** The OpenAI, RevenueCat and Firebase admin credentials stay in the backend's secret settings, the same as Votic.
- **Allergens.** Every recipe lists common allergens it contains, with a note that the photo cannot show hidden ingredients.
- **Alcohol.** Cocktail recipes affect the app's content rating in the app stores. Plan an age confirmation before alcoholic recipes are shown, and always offer non-alcoholic versions.
- **Untrusted input.** Text in a photo (a menu, a sign) is treated as content, never as instructions to the AI.

## 5. Build phases

1. **Foundation (done):** the Expo app and the Node backend, built from Votic's patterns: server-side sign-in check, the 3-free-photo allowance, the OpenAI recipe call with a strict reply shape, and app screens for camera, recipe and Saved. Tests and CI for both.
2. **Core loop on a real phone:** connect Firebase sign-in and the live OpenAI key, test with real photos, tune the prompt, and polish guesses, "not food" and error states.
3. **Paid plan:** RevenueCat paywall after the 3 free photos, checked on the server.
4. **Saving and sharing polish:** scale servings, share a recipe as text, account sync for Saved.
5. **Android release:** test APK, Play internal testing, privacy policy, Play data-safety form, content rating.
6. **iPhone:** iOS build workflow, camera permission text, App Store review.

## 6. Open questions

- **Paid plan:** price, monthly or yearly, and whether paid use has a monthly photo limit.
- **Free photos:** do the 3 free photos ever refresh (for example monthly), or are they 3 in total? Planned as 3 in total for now.
