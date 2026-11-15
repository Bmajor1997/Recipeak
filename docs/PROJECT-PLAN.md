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

When a photo is taken, people get two signals: the **shutter sound** and a **soft white flash** on screen (about a quarter of a second, never a strobe). The photo then stays on screen with **Retake** and **Send**. On Send, the camera slides down and the **recipe slides up** the same way, showing "Finding your recipe…" until the answer arrives. If it isn't food or drink, the recipe sheet says so with a **Retake photo** button. With the phone's Reduce Motion setting on, the sheet fades instead of sliding and the flash is dimmer.

### Look and feel

Researched on Mobbin (CREME, Julienne, NYT Cooking, Kitchen Stories) and approved on 2026-11-14:

- **Black and grapefruit** (chosen 2026-11-14): near-black background (#0F0F10) so food photos carry the colour, with the grapefruit coral from the icon (#FF6F61) as the one accent. **Fraunces**, a serif font, for titles; body text stays in the phone's own font. Standard text sizes (body 16, page titles 28); the phone's own text-size setting still enlarges everything for people who need it.
- A raised orange **camera button in the middle of the tab bar** opens the camera from any screen.
- **Home:** a greeting, the drink-and-plate art (cut out, no square), a camera prompt with free photos left, and a "Recently saved" row of photo cards.
- **Saved:** a two-column grid of photo cards (title over the photo, Meal/Drink tag, total time), with search and All / Meals / Drinks filters.
- **Recipe:** modelled on CREME's cocktail page: the photo fills the top, with the title just below it, then a Prep / Cook / Serves row, ingredients with the amounts highlighted, big "01, 02…" step numbers, and a bar at the bottom with a servings counter (amounts rescale) and Save.
- **Cover photos come from a shared library, never from the person's photo** (decided 2026-11-14). See "Cover photos" below. A saved recipe keeps a copy of its cover photo on the phone so Saved works offline; it's deleted with the recipe.

### Cover photos

The person's photo is used only to recognise the dish, then discarded. Every recipe's cover is a polished, CREME-style photo from a **shared library on the server**:

- **One photo per dish, shared by everyone.** The first time anyone finds, say, a margarita, the server creates its photo with OpenAI's image model in one house style (dark and moody, side-lit, no people or text) and keeps it. Everyone after that gets the same photo instantly, at no extra cost.
- **House style** (refined with Ben's ChatGPT tests on 2026-11-14): eye level, slightly angled; dark slate surface with a few fresh key ingredients beside the dish; near-black background; moody light from one side; fills the frame, no borders; no people, text or logos. When the recipe is known, its glass, garnish and main ingredients go into the wording so the photo matches it.
- **Hand-picked photos** in `data/curated-photos/` (listed in its `manifest.json`) are installed into the library when the server starts and are never re-created. 43 so far, all from Ben. Meals: Pho, Fish and Chips, Carrot Cake, Samosas, Chana Masala, Ramen, Orange Chicken, Oatmeal, Dumplings, Kung Pao Chicken, Biryani, Grilled Salmon, Spring Rolls, Chicken Fajitas, Butter Chicken, Chicken Teriyaki, Fish Tacos, Crab Cakes, Shrimp and Grits and Lo Mein. Cocktails: Margarita, Moscow Mule, Cosmopolitan, Manhattan, Gin and Tonic, Paloma, Negroni, French 75, Long Island Iced Tea, Tequila Sunrise, Bloody Mary, Tom Collins, Dark 'n' Stormy, Mimosa, Aperol Spritz, Whiskey Sour, Espresso Martini, Mai Tai, Daiquiri, Martini, Mojito, Old Fashioned and Piña Colada. Landscape originals are cropped square around the glass or plate.
- Each of the **closest matches (up to 3)** gets its own photo. Photos are created in the background; the app shows its drink-and-plate art with "Creating photo…" until one is ready, then fades it in.
- A small **"AI-generated image"** label sits on every cover.
- **Starter library:** `data/seed-dishes.json` lists 120 common meals and 80 drinks to create before launch (`server/seed_dish_images.js --dry-run` shows the cost, about $8–12). Review and edit the list first.
- **Cost controls:** about 4–5 cents per new photo; cover photos have their own daily limits (per account and overall) and count towards the monthly budgets. They never use up a free photo.

## 4. Privacy and safety

- **People's photos are not kept anywhere.** The backend sends the photo to OpenAI with `store:false`, returns the recipe, and discards it; the app doesn't keep it either. Only the dish's name reaches the image model for cover photos. The usage ledger records counts and costs only, never photos, as in Votic.
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
