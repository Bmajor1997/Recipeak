# Recipeak — project plan

Recipeak is the app's name (renamed from Meals and Mixers on 2026-11-16 as Recipeek, respelled Recipeak on 2026-11-19). The icon is the camera button's citrus ring with a serif R; redraw every size with `python3 scripts/make_app_icon.py`. The repository is `Bmajor1997/Recipeak` (GitHub forwards the old `Recipeek` and `Meals-and-Mixers` addresses). Package IDs and the URL scheme keep the original `mealsandmixers` name on purpose; the onboarding store still reads answers saved under the old `recipeek.` key.

Status: **approved; phase 1 in progress**, updated 2026-11-15.

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
| Free use | 3 free photos per account, and up to **3 recipes in Saved** (from photos or the Home wall, decided 2026-11-15); then the paid plan (RevenueCat, like Votic) |
| Paid plan (decided 2026-11-15) | **$3.99 a month** or **$24.99 a year** (about $2.08 a month, "Save 48%"), both with a **7-day free trial**; Yearly is selected by default |
| Saved recipes | A **Saved** screen in the app; **each account has its own list** (decided 2026-11-15), stored on the phone first, synced to the account later |
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

Each account gets 3 free photos and up to 3 saved recipes. Saving a 4th recipe, whether it came from a photo or a tap on the Home wall, opens the paywall (re-saving one already in Saved is fine, and removing one frees a space). Each account has its own Saved list and its own limit, counted on the phone, since Saved lives there for now; when Saved syncs to the account, the server should count them too. The photos are counted on the server against the verified account (never a number sent by the phone). A photo counts when the app returns a meal or cocktail. A failed request, or a photo that turns out not to be food or drink, does not use one up; daily and per-minute limits stop abuse of that rule. If a photo can't be read and the person types the dish's name instead ("Not the right dish?"), that name stands in for the photo and uses a free photo; on a recipe that worked, typing a different name is one of that photo's 5 free follow-ups (other guesses, diet versions).

### The camera

Modelled on the ChatGPT app's camera. The Home screen has a **Camera** button; the camera slides up from the bottom as a rounded sheet with:

- a large white **shutter** button in the middle,
- a **back** arrow on the left (dragging the sheet down, or Android's back button, also closes it),
- a **three-dot menu** on the right: *Choose from photos*, *Flash: Off / Auto / On*, and *Use front/back camera*.

When a photo is taken, people get two signals: the **shutter sound** and a **soft white flash** on screen (about a quarter of a second, never a strobe). The photo then stays on screen with **Retake** and **Send**. On Send, the camera slides down and the **recipe slides up** the same way, showing "Finding your recipe…" until the answer arrives. If it isn't food or drink, the recipe sheet says so with a **Retake photo** button. With the phone's Reduce Motion setting on, the sheet fades instead of sliding and the flash is dimmer.

### Look and feel

Researched on Mobbin (CREME, Julienne, NYT Cooking, Kitchen Stories) and approved on 2026-11-14:

- **Light and dark mode** (added 2026-11-15): Settings > Preferences > Appearance offers Match phone (the default), Light and Dark. Light mode uses a warm off-white page (#FAF7F5) with white cards and the same grapefruit; text and icons drawn in grapefruit use a darker shade (#B93A2E) so they stay readable. The camera always stays dark. Colours live in `apps/mobile/src/ui/palette.ts`; screens read them with `useTheme()` and `useThemedStyles()`.
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
- **Home screen**: under the photo wall, Home shows Tonight's pick (a meal and a drink that go together, changing daily), rows of photos (Ready in 30 minutes, Classic cocktails, Weekend projects, Alcohol-free friendly, Brunch; each with See all), Recently viewed, and an Explore card with a photo collage and a search bar. All of it comes from the bundled collection (`src/recipes/shelves.ts`), so it works offline.
- **Tab bar**: Home, Explore, the camera button (in the exact center), Saved and Settings.
- **Recipe ratings**: every recipe screen has "Rate this recipe": 1 to 5 stars, an "I made this" toggle, quick tags (too salty, took longer than listed, a step was unclear…) and an optional note. One rating per account per dish; rating again replaces it. Ratings are kept on the phone and sent to the server (sent later if offline). Admins read a per-dish summary, lowest rated first, from `POST /api/admin/recipe-ratings` to decide which recipes to fix. Ratings are kept for two years.
- **Richer bundled recipes**: recipes can carry tips (why a step works, doneness cues), make-ahead and storage notes, and variations. The 16 Home wall recipes have them; the rest are being upgraded in batches (see `data/recipes/src/upgraded-*.txt`).
- **Home photo wall**: two rows of hand-picked photos drift slowly in opposite directions under the heading (still when the phone's reduce-motion setting is on). Tapping a photo opens that recipe the same way a photo does. Every hand-picked dish (405 of them) has a hand-written recipe and a small photo bundled inside the app, so the wall and Explore open recipes instantly, offline, with no AI cost and no free photo used. Dishes not in the bundle fall back to the server. Diet versions still count as normal recipes. Rebuild the bundle with `python3 scripts/build_recipes.py` then `python3 scripts/make_collection.py` after adding photos or recipes.
- **Hand-picked photos** in `data/curated-photos/` (listed in its `manifest.json`) are installed into the library when the server starts and are never re-created. 151 so far, all from Ben. Meals: Pho, Fish and Chips, Carrot Cake, Samosas, Chana Masala, Ramen, Orange Chicken, Oatmeal, Dumplings, Kung Pao Chicken, Biryani, Grilled Salmon, Spring Rolls, Chicken Fajitas, Butter Chicken, Chicken Teriyaki, Fish Tacos, Crab Cakes, Shrimp and Grits, Lo Mein, Chocolate Cake, Chicken Tikka Masala, Chicken Quesadilla, Chicken Enchiladas, Chocolate Chip Cookies, Beef Burrito, Loaded Baked Potato, Nachos, Garlic Butter Shrimp, Chicken Tortilla Soup, Jambalaya, Guacamole, Paella, Chilaquiles, Gumbo, Spaghetti Bolognese, Fettuccine Alfredo, Macaroni and Cheese, Chicken Alfredo, Baked Ziti, Spaghetti Carbonara, Lasagna, Shrimp Scampi, Pesto Pasta, Chicken Parmesan, Club Sandwich, Margherita Pizza, Pepperoni Pizza, Grilled Cheese, Cheeseburger, BLT, Philly Cheesesteak, Pulled Pork Sandwich, Chili and Ribeye Steak. Cocktails: Margarita, Moscow Mule, Cosmopolitan, Manhattan, Gin and Tonic, Paloma, Negroni, French 75, Long Island Iced Tea, Tequila Sunrise, Bloody Mary, Tom Collins, Dark 'n' Stormy, Mimosa, Aperol Spritz, Whiskey Sour, Espresso Martini, Mai Tai, Daiquiri, Martini, Mojito, Old Fashioned, Piña Colada, Hemingway Daiquiri, Martinez, White Russian, Brooklyn, Pornstar Martini, Boulevardier, Vieux Carre, Breakfast Martini, Bee's Knees, Rob Roy, Vesper, Salty Dog, Old Pal, Zombie, Blue Lagoon, Brandy Alexander, Screwdriver, Blue Hawaii, Sidecar, Singapore Sling, Gimlet, Perfect Manhattan, Mudslide, Hurricane, Midori Sour, Gin Basil Smash, Garibaldi, Blood and Sand, Gold Rush, Sex on the Beach, Blackberry Martini, Paper Plane, Rusty Nail, Jack Rose, Jungle Bird, Sherry Cobbler, Bramble, Brandy Crusta, Americano, Bloody Caesar, Monkey Gland, Planter's Punch, Kahlua and Cream, El Presidente, Penicillin, Clover Club, Bamboo, Hanky Panky, Corpse Reviver No. 2, Chartreuse Swizzle, Dry Manhattan, Godfather, Sazerac, Grasshopper, Ramos Gin Fizz, French Martini, Pisco Sour, Irish Coffee, Black Russian, Painkiller, Whiskey on the Rocks, White Lady, Between the Sheets, Cuba Libre, Rum Runner, Lemon Drop, Eggnog, Mint Julep, Tiki Punch, Caipirinha, Aviation, Mezcal Negroni and Last Word. Landscape originals are cropped square around the glass or plate.
- Each of the **closest matches (up to 3)** gets its own photo. Photos are created in the background; the app shows its drink-and-plate art with "Creating photo…" until one is ready, then fades it in.
- A small **"AI-generated image"** label sits on every cover.
- **Starter library:** `data/seed-dishes.json` lists 120 common meals and 80 drinks to create before launch (`server/seed_dish_images.js --dry-run` shows the cost, about $8–12). Review and edit the list first.
- **Cost controls:** about 4–5 cents per new photo; cover photos have their own daily limits (per account and overall) and count towards the monthly budgets. They never use up a free photo.

### The paywall

Approved on 2026-11-15 from three options (plan picker, Free vs Pro table, photo packs); the plan picker won. It opens after the 3 free photos, or when a free account tries to save a 4th recipe (`apps/mobile/src/app/upgrade.tsx`), in the black-and-grapefruit look:

- a close button at the top right, and the drink-and-plate art on a dark card,
- "You've used your 3 free photos" (or "You've saved your 3 free recipes"), the title **Keep snapping. Keep cooking.** and one line on what Pro gives: unlimited photos, every saved recipe, and diet versions,
- two plan choices, **Yearly** ($24.99 / year · just $2.08 / month, with a "Save 48%" badge, selected first) and **Monthly** ($3.99 / month),
- a **Start 7-day free trial** button, the trial terms for the selected plan ("Free for 7 days, then $24.99 / year. Cancel anytime in Google Play.") and **Restore purchase**.

The prices live in one place, `apps/mobile/src/paywall/plans.ts`. Until RevenueCat is connected, the buttons explain that subscriptions aren't open yet. Once it is, the store's own prices are shown, so the Play Console products must use these same prices.

### Feedback

Ported from Votic on 2026-11-15. **Settings > Feedback** offers **Suggest a Feature** and **Report a Bug**. Each is a short form (a title and a description) that goes privately to the team:

- **Server** (`server/feedback.js`, Votic's `app_parts/feedback.js`): `POST /api/feedback` for signed-in accounts. Strict validation, a submission reference so a retry is never saved twice, 10 reports per account per day, identical reports grouped together, and everything removed after a year. Reports live in the private usage ledger.
- **Dashboard** at `/admin/feedback` (Votic's `admin/`): sign in with a Firebase account whose user ID is listed in `MM_FEEDBACK_ADMIN_UIDS` (it also needs `FIREBASE_WEB_API_KEY`). It shows totals, the most requested features and most reported bugs, unresolved serious bugs first, search, and status and severity, merge and separate. Every request is checked by the server; the page keeps the sign-in in memory only.
- Not ported (Votic-only for now): the Google Play rating link (there's no store listing yet) and automatic diagnostic reports.

## 4. Privacy and safety

- **People's photos are not kept anywhere.** The backend sends the photo to OpenAI with `store:false`, returns the recipe, and discards it; the app doesn't keep it either. Only the dish's name reaches the image model for cover photos. The usage ledger records counts and costs only, never photos, as in Votic.
- **No secrets in the app.** The OpenAI, RevenueCat and Firebase admin credentials stay in the backend's secret settings, the same as Votic.
- **Allergens.** Every recipe lists the nine major US allergens it contains, with a note that the photo cannot show hidden ingredients and that leaving an ingredient out doesn't remove traces of it. Coconut is not labeled a tree nut (FDA guidance, January 2025), but the nut-free diet option still treats it as one (decided 2026-11-19).
- **Alcohol.** Cocktail recipes affect the app's content rating in the app stores. The terms set the minimum age at 18, and legal drinking age for alcoholic recipes; non-alcoholic versions are offered.
- **Privacy policy and terms (2026-11-19).** In Benjamin Major's name, published by the backend at `/privacy` and `/terms` (files in `server/legal/`), and linked from Settings > Help & privacy with the support email.
- **Support email.** `turelapps@gmail.com`, one inbox shared by all of Ben's apps (decided 2026-11-19).
- **Account deletion (2026-11-19).** Settings > Account > Delete account asks for the password again, then deletes the server's feedback, ratings and usage links (usage costs stay without the account ID), the Firebase sign-in, and the account's data on the phone. The server requires a sign-in from the last five minutes, refuses a deleted account's leftover token for a week, and lets a half-finished deletion be retried.
- **Code scanning.** CodeQL needs a paid GitHub plan for private repositories, so it stays off; Semgrep, gitleaks, OSV-Scanner, Trivy and npm audit run on every change instead.
- **Untrusted input.** Text in a photo (a menu, a sign) is treated as content, never as instructions to the AI.

## 5. Build phases

Added 2026-11-20 to match Votic: Continue with Google (and Sign in with Apple on iPhone), RevenueCat purchases in the app, the rate-the-app prompt, the Premium beta-tester list on the server, the Android build workflows and the Google Cloud deploy scripts.

1. **Foundation (done):** the Expo app and the Node backend, built from Votic's patterns: server-side sign-in check, the 3-free-photo allowance, the OpenAI recipe call with a strict reply shape, and app screens for camera, recipe and Saved. Tests and CI for both.
2. **Core loop on a real phone:** connect Firebase sign-in and the live OpenAI key, test with real photos, tune the prompt, and polish guesses, "not food" and error states.
3. **Paid plan:** RevenueCat paywall after the 3 free photos, checked on the server. The buttons are connected to RevenueCat (2026-11-20), and accounts can be deleted with their billing profile; still to do in the accounts: the Google Play subscription products and trial, the RevenueCat offering and keys.
4. **Saving and sharing polish:** scale servings, share a recipe as text, account sync for Saved.
5. **Android release:** put the backend online at a permanent address with `deploy/backend` (the privacy policy URL for Play comes from it), test APK and signed App Bundle (GitHub workflows, added 2026-11-20), Play internal testing, Play data-safety form, content rating. Privacy policy, terms and in-app account deletion are done (2026-11-19).
6. **iPhone:** iOS build workflow, camera permission text, App Store review.

## 6. Open questions

- **Paid plan:** whether paid use has a monthly photo limit. (Price, monthly and yearly were decided on 2026-11-15.)
- **Recipes:** keep or drop the vegetarian som tam (soy sauce swap).
- **Starter photo library:** approve the about $8–12 cost of generating the 200 starter cover photos (`data/seed-dishes.json`).
- **Free photos:** do the 3 free photos ever refresh (for example monthly), or are they 3 in total? Planned as 3 in total for now.
