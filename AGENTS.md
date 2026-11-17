# Working in this repository

These rules apply to everyone who changes this code, people and AI assistants alike (Claude, ChatGPT/Codex and others).

## Rules

- **Function names are snake_case**, in the backend and in the app: `create_app`, `call_openai`, `toggle_save`, `set_busy`. That includes methods, arrow functions and React `useState` setters. The only exceptions are names React or a library decides: React components are PascalCase, hooks are `useSomething`, React event props are `onSomething`, and library interfaces keep their own names (`getItem`, `tabBarIcon`…). The app's ESLint config enforces this.
- **Change `main` through a pull request**, never by pushing to it directly, so the security and app checks run before anything lands. Merge only when every check passes.
- **Run the checks before opening a pull request:** `npm test` and `npm run lint` at the top level (backend, Node 24), and in `apps/mobile`: `npm test`, `npm run typecheck`, `npm run lint` and `npm run format:check`.
- **No secrets in the code or the app.** Keys stay in the backend's secret settings (see `.env.example`); the security checks scan for them.
- **Hand-picked cover photos** go in `data/curated-photos/` with an entry in its `manifest.json`. Strip photo metadata (EXIF, location) before adding them, then add its recipe to `data/recipes/src/*.txt` and run `python3 scripts/build_recipes.py` and `python3 scripts/make_collection.py`. To keep a photo out of the app until it is replaced, set `"hidden": true` (with a `hidden_reason`) on its manifest entry. Never edit the generated `recipes.json`, `collection.json`, `collectionVariants.json`, `collectionPhotos.ts` or `wallPhotos.ts` by hand.
- **Vegetarian and vegan versions** of a bundled recipe go right under it in the same source file, as `@@ vegetarian | Title | prep | cook | allergens | Description` and `@@ vegan | ...` blocks. Inside a block, `~ old text => new text` swaps words in the regular recipe, and any `-`, `#`, `G`, `T`, `S` or `!` lines replace that whole part. Write `@@ vegetarian = same` when the regular recipe already fits, and `@@ vegan = vegetarian` when the vegetarian version is already vegan. A recipe with one version needs both; the build stops if a version still lists meat, fish, dairy, eggs or honey for its diet. The full syntax is at the top of `scripts/build_recipes.py`.

The app has more Expo-specific guidance in `apps/mobile/AGENTS.md`.

- **Diet labels and "Make it…" options** come from each recipe's ingredients (`apps/mobile/src/recipes/diets.ts`): an option shows only when the recipe needs a real change, and a diet it already meets shows as an "Already …" label. Hand decisions (a dish whose meat or nuts are the dish itself, or an item a person has checked) go in `apps/mobile/src/recipes/dietReview.json`, and items still waiting for a check are listed in `data/recipes/diet-review.md`. `apps/mobile/tests/dietAudit.test.ts` checks every bundled recipe.
