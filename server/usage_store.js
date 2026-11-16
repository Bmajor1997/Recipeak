// Private SQLite ledger for paid AI calls and free photos. Adapted from Votic's app_parts/ai_usage.js.
// Rows hold counts, costs and identifiers only: never photos, recipes, or authentication tokens.
import { DatabaseSync } from "node:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { AiLimitError } from "./errors.js";
import { create_feedback_store } from "./feedback.js";
import { create_rating_store } from "./recipe_ratings.js";

export const AI_EXECUTION_TIMEOUT_MS = 60_000;
const AI_EXECUTION_LEASE_MS = 90_000;

// USD per million tokens, Standard processing. Same model and prices as Votic (verified there 2026-10-05).
const PRICES = {
  "gpt-6-luna": { input: 0.10, cached: 0.01, cache_write: 0.125, output: 0.50 },
};

export function model_prices(model, env = {}) {
  const overrides = JSON.parse(env.MM_AI_PRICES_JSON || "{}");
  const rates = overrides[model] || PRICES[model];
  if (!rates) throw new Error("Configure MM_AI_PRICES_JSON before enabling an unpriced model.");
  if (![rates.input, rates.cached, rates.cache_write, rates.output].every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0))
    throw new Error("AI prices must contain nonnegative input, cached, cache_write, and output rates.");
  return rates;
}

export function token_usage(result) {
  const u = result?.usage;
  if (!u || ![u.input_tokens, u.output_tokens, u.total_tokens].every((n) => Number.isSafeInteger(n) && n >= 0)) return null;
  const cached = u.input_tokens_details?.cached_tokens ?? 0;
  const writes = u.input_tokens_details?.cache_write_tokens ?? 0;
  if (![cached, writes].every((n) => Number.isSafeInteger(n) && n >= 0) || cached + writes > u.input_tokens || u.total_tokens !== u.input_tokens + u.output_tokens) return null;
  return { input_tokens: u.input_tokens, output_tokens: u.output_tokens, cached_tokens: cached, cache_write_tokens: writes, total_tokens: u.total_tokens };
}

export function estimate_cost(usage, rates) {
  return ((usage.input_tokens - usage.cached_tokens - usage.cache_write_tokens) * rates.input
    + usage.cached_tokens * rates.cached + usage.cache_write_tokens * rates.cache_write
    + usage.output_tokens * rates.output) / 1e6;
}

function number_setting(env, name, fallback) {
  const n = env[name] == null || env[name] === "" ? fallback : Number(env[name]);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a nonnegative number.`);
  return n;
}

export function create_usage_store(env = {}, { now = () => new Date(), path = env.MM_AI_USAGE_DB || ":memory:" } = {}) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;
    CREATE TABLE IF NOT EXISTS ai_usage (
      request_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, feature TEXT NOT NULL, model TEXT NOT NULL,
      started_at TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL, provider_request_id TEXT,
      input_tokens INTEGER, output_tokens INTEGER, total_tokens INTEGER,
      reserved_tokens INTEGER NOT NULL, reserved_cost REAL NOT NULL, estimated_cost_usd REAL NOT NULL,
      usage_known INTEGER NOT NULL DEFAULT 0, pricing_json TEXT NOT NULL,
      free_photo INTEGER NOT NULL DEFAULT 0, photo_counted INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS ai_usage_user_time ON ai_usage(user_id, started_at);
    CREATE INDEX IF NOT EXISTS ai_usage_time ON ai_usage(started_at);
    CREATE TABLE IF NOT EXISTS dish_images (
      key TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dish_recipes (
      key TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, recipe_json TEXT NOT NULL, created_at TEXT NOT NULL
    );`);

  const limits = {
    free_photos: number_setting(env, "MM_FREE_PHOTOS", 3),
    followups_per_photo: number_setting(env, "MM_FREE_FOLLOWUPS_PER_PHOTO", 5),
    global_cost: number_setting(env, "MM_AI_MONTHLY_BUDGET_USD", 100),
    user_cost: number_setting(env, "MM_AI_USER_MONTHLY_BUDGET_USD", 5),
    user_daily: number_setting(env, "MM_AI_USER_DAILY_LIMIT", 60),
    global_daily: number_setting(env, "MM_AI_DAILY_LIMIT", 2000),
    user_rate: number_setting(env, "MM_AI_USER_RATE_LIMIT", 10),
    concurrency: number_setting(env, "MM_AI_USER_CONCURRENCY", 2),
    image_user_daily: number_setting(env, "MM_IMAGE_USER_DAILY_LIMIT", 30),
    image_global_daily: number_setting(env, "MM_IMAGE_DAILY_LIMIT", 300),
  };

  // A free photo is held from the moment it is reserved, so two parallel uploads can't both use the last one.
  // It is released if the call fails, crashes, or the photo turns out not to be food or drink.
  const photos_used = (user_id) => db.prepare(
    "SELECT COUNT(*) AS n FROM ai_usage WHERE user_id=? AND free_photo=1 AND photo_counted=1").get(user_id).n;
  const counted_photos = (user_id) => db.prepare(
    "SELECT COUNT(*) AS n FROM ai_usage WHERE user_id=? AND free_photo=1 AND photo_counted=1 AND status='completed'").get(user_id).n;
  const followups_used = (user_id) => db.prepare(
    "SELECT COUNT(*) AS n FROM ai_usage WHERE user_id=? AND feature='recipe' AND status<>'rejected'").get(user_id).n;

  // Feature requests and bug reports share this private ledger. Anything older than a year is removed.
  const feedback = create_feedback_store(db, { now });
  feedback.prune();
  // Recipe ratings and "I made this" notes, kept for two years.
  const ratings = create_rating_store(db, { now });
  ratings.prune();

  return {
    limits,
    feedback,
    ratings,
    free_photos_left(user_id) { return Math.max(0, limits.free_photos - photos_used(user_id)); },

    /** Atomically check every limit and reserve the worst-case cost before calling the provider. */
    reserve({ user_id, feature, model, input_bound, output_bound, rates, premium }) {
      const started_at = now().toISOString();
      const month = started_at.slice(0, 7) + "-01T00:00:00.000Z", day = started_at.slice(0, 10) + "T00:00:00.000Z";
      const minute = new Date(Date.parse(started_at) - 60000).toISOString();
      const reserved_tokens = input_bound + output_bound;
      const reserved_cost = estimate_cost({ input_tokens: input_bound, output_tokens: output_bound, cached_tokens: 0, cache_write_tokens: 0 },
        { ...rates, input: Math.max(rates.input, rates.cached, rates.cache_write) });
      // A photo, or a name typed in place of a photo that couldn't be read, uses one of the free photos.
      const free_photo = (feature === "identify" || feature === "correction") && !premium ? 1 : 0;
      db.exec("BEGIN IMMEDIATE");
      try {
        // A crashed call stops holding capacity (and a free photo) but keeps its cost reservation.
        const expired = new Date(Date.parse(started_at) - AI_EXECUTION_LEASE_MS).toISOString();
        db.prepare("UPDATE ai_usage SET status='unknown',completed_at=?,photo_counted=0 WHERE status='pending' AND started_at<=?").run(started_at, expired);
        if (!premium) {
          if (free_photo && photos_used(user_id) >= limits.free_photos)
            throw new AiLimitError("You've used your free photos. Upgrade to keep finding recipes.", "FREE_PHOTOS_USED");
          if (feature === "recipe" && followups_used(user_id) >= counted_photos(user_id) * limits.followups_per_photo)
            throw new AiLimitError("You've used your free recipes. Upgrade to keep finding recipes.", "FREE_PHOTOS_USED");
        }
        const sums = db.prepare("SELECT COALESCE(SUM(estimated_cost_usd),0) AS cost FROM ai_usage WHERE user_id=? AND started_at>=?").get(user_id, month);
        const global = db.prepare("SELECT COALESCE(SUM(estimated_cost_usd),0) AS cost FROM ai_usage WHERE started_at>=?").get(month);
        const counts = db.prepare("SELECT COALESCE(SUM(started_at>=?),0) AS daily, COALESCE(SUM(started_at>=?),0) AS minute, COALESCE(SUM(status='pending'),0) AS active FROM ai_usage WHERE user_id=? AND feature<>'image'").get(day, minute, user_id);
        const global_daily = db.prepare("SELECT COUNT(*) AS n FROM ai_usage WHERE started_at>=? AND feature<>'image'").get(day).n;
        if (global.cost + reserved_cost > limits.global_cost) throw new AiLimitError("Recipe finding is paused for the rest of the month. Please try again later.");
        if (counts.daily >= limits.user_daily || global_daily >= limits.global_daily) throw new AiLimitError("Today's limit has been reached. Try again tomorrow.");
        if (counts.minute >= limits.user_rate || counts.active >= limits.concurrency) throw new AiLimitError("Too many requests. Please wait a moment and try again.");
        if (sums.cost + reserved_cost > limits.user_cost) throw new AiLimitError("You've reached this month's limit. Try again next month.");
        const request_id = randomUUID();
        db.prepare(`INSERT INTO ai_usage (request_id,user_id,feature,model,started_at,status,reserved_tokens,reserved_cost,estimated_cost_usd,pricing_json,free_photo,photo_counted)
          VALUES (?,?,?,?,?,'pending',?,?,?,?,?,?)`).run(request_id, user_id, feature, model, started_at, reserved_tokens, reserved_cost, reserved_cost, JSON.stringify(rates), free_photo, free_photo);
        db.exec("COMMIT");
        return request_id;
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    },

    /** Settle a reservation against the provider's reported usage. Unknown usage keeps the full reservation. */
    finish(request_id, { status, result, provider_request_id = null, rejected = false }) {
      const row = db.prepare("SELECT * FROM ai_usage WHERE request_id=? AND status IN ('pending','unknown') AND usage_known=0").get(request_id);
      if (!row) return;
      const usage = token_usage(result);
      const cost = usage ? estimate_cost(usage, JSON.parse(row.pricing_json)) : rejected ? 0 : row.reserved_cost;
      const final_status = rejected ? "rejected" : status;
      db.prepare(`UPDATE ai_usage SET completed_at=?,status=?,provider_request_id=?,input_tokens=?,output_tokens=?,total_tokens=?,estimated_cost_usd=?,usage_known=?,
        photo_counted=CASE WHEN ?='completed' THEN photo_counted ELSE 0 END
        WHERE request_id=? AND status IN ('pending','unknown') AND usage_known=0`)
        .run(now().toISOString(), final_status, provider_request_id, usage?.input_tokens ?? null, usage?.output_tokens ?? null,
          usage?.total_tokens ?? null, cost, usage ? 1 : 0, final_status, request_id);
    },

    /** Give the free photo back: the photo was not food or drink, or the reply could not be used. */
    release_photo(request_id) {
      db.prepare("UPDATE ai_usage SET photo_counted=0 WHERE request_id=?").run(request_id);
    },

    /**
     * Cover photos are shared by everyone, so they have their own limits: they never use a free photo
     * and don't count towards a person's per-minute or daily recipe limits. They still count towards
     * the monthly budgets, at a fixed estimated price per image.
     */
    reserve_image({ user_id, model, cost }) {
      const started_at = now().toISOString();
      const month = started_at.slice(0, 7) + "-01T00:00:00.000Z", day = started_at.slice(0, 10) + "T00:00:00.000Z";
      db.exec("BEGIN IMMEDIATE");
      try {
        const global = db.prepare("SELECT COALESCE(SUM(estimated_cost_usd),0) AS cost FROM ai_usage WHERE started_at>=?").get(month);
        const user_month = db.prepare("SELECT COALESCE(SUM(estimated_cost_usd),0) AS cost FROM ai_usage WHERE user_id=? AND started_at>=?").get(user_id, month);
        const images = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(user_id=?),0) AS mine FROM ai_usage WHERE feature='image' AND started_at>=?").get(user_id, day);
        if (global.cost + cost > limits.global_cost) throw new AiLimitError("Cover photos are paused for the rest of the month.");
        if (images.n >= limits.image_global_daily || images.mine >= limits.image_user_daily) throw new AiLimitError("Cover photos are paused for today.");
        if (user_month.cost + cost > limits.user_cost) throw new AiLimitError("This account's monthly limit has been reached.");
        const request_id = randomUUID();
        db.prepare(`INSERT INTO ai_usage (request_id,user_id,feature,model,started_at,status,reserved_tokens,reserved_cost,estimated_cost_usd,pricing_json)
          VALUES (?,?,'image',?,?,'pending',0,?,?,?)`).run(request_id, user_id, model, started_at, cost, cost, JSON.stringify({ per_image: cost }));
        db.exec("COMMIT");
        return request_id;
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    },

    /** Settles an image reservation. A provider rejection (4xx) costs nothing; anything else keeps the estimate. */
    finish_image(request_id, { status, provider_request_id = null }) {
      db.prepare(`UPDATE ai_usage SET completed_at=?,status=?,provider_request_id=?,estimated_cost_usd=CASE WHEN ?='rejected' THEN 0 ELSE estimated_cost_usd END
        WHERE request_id=? AND feature='image' AND status='pending'`).run(now().toISOString(), status, provider_request_id, status, request_id);
    },

    get_image(key) { return db.prepare("SELECT * FROM dish_images WHERE key=?").get(key) || null; },
    set_image({ key, kind, name, status }) {
      const at = now().toISOString();
      db.prepare(`INSERT INTO dish_images (key,kind,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)
        ON CONFLICT(key) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at`).run(key, kind, name, status, at, at);
    },

    /** The shared standard recipe for a photo-wall dish, made once and reused for everyone. */
    get_recipe(key) {
      const row = db.prepare("SELECT recipe_json FROM dish_recipes WHERE key=?").get(key);
      return row ? JSON.parse(row.recipe_json) : null;
    },
    set_recipe({ key, kind, name, recipe }) {
      db.prepare("INSERT OR IGNORE INTO dish_recipes (key,kind,name,recipe_json,created_at) VALUES (?,?,?,?,?)")
        .run(key, kind, name, JSON.stringify(recipe), now().toISOString());
    },

    records() { return db.prepare("SELECT * FROM ai_usage ORDER BY started_at, request_id").all(); },
    close() { db.close(); },
  };
}
