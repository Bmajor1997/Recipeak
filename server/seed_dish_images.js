// Creates cover photos for the starter list in data/seed-dishes.json, skipping any that already exist.
//   node --env-file=.env.backend.local server/seed_dish_images.js --dry-run   (shows what it would create and the cost)
//   node --env-file=.env.backend.local server/seed_dish_images.js             (creates them, one at a time)
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { create_image_library, image_key } from "./dish_images.js";
import { create_usage_store } from "./usage_store.js";

const env = process.env;
if (!env.MM_IMAGE_DIR) throw new Error("Set MM_IMAGE_DIR to the folder the server serves cover photos from.");
const list = JSON.parse(readFileSync(new URL("../data/seed-dishes.json", import.meta.url), "utf8"));
const wanted = ["meal", "cocktail"].flatMap((kind) => list[kind].map((name) => ({ kind, name })));
const missing = wanted.filter(({ kind, name }) => !existsSync(join(env.MM_IMAGE_DIR, `${image_key(kind, name)}.jpg`)));
const price = Number(env.MM_IMAGE_PRICE_USD || 0.06);
console.log(`${wanted.length} dishes and drinks; ${missing.length} still need a cover photo (about $${(missing.length * price).toFixed(2)}).`);
if (process.argv.includes("--dry-run") || !missing.length) process.exit(0);
if (!env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY in .env.backend.local first.");

// The seed run has its own daily allowance so it can't eat into what users get.
const store = create_usage_store({ ...env, MM_IMAGE_DAILY_LIMIT: env.MM_SEED_DAILY_LIMIT || "250", MM_IMAGE_USER_DAILY_LIMIT: env.MM_SEED_DAILY_LIMIT || "250", MM_AI_USER_MONTHLY_BUDGET_USD: env.MM_SEED_BUDGET_USD || "20" });
const images = create_image_library({ env, store });
let done = 0;
for (const { kind, name } of missing) {
  images.status({ kind, name, user_id: "seed" });
  await images.settled();
  const ready = existsSync(join(env.MM_IMAGE_DIR, `${image_key(kind, name)}.jpg`));
  console.log(`${ready ? "✓" : "✗"} ${kind}: ${name}`);
  if (ready) done += 1;
}
console.log(`Created ${done} of ${missing.length}.`);
store.close();
