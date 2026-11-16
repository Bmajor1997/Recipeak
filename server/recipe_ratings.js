// Recipe ratings and "I made this" notes. One rating per account per dish: rating again replaces the old one.
// The team reads a per-dish summary, lowest-rated first, to see which recipes to improve.
import { normalize_dish_name } from "./dish_images.js";
import { HttpError } from "./errors.js";

/** What the cook can tick about how it went. The app shows the same list. */
export const RATING_TAGS = [
  "perfect",
  "too_salty",
  "too_bland",
  "too_sweet",
  "too_sour",
  "too_strong",
  "took_longer",
  "unclear_steps",
  "amounts_off",
];
const DAILY_LIMIT = 100;
const MAX_NOTE = 500;
const KEEP_DAYS = 730;

export function validate_rating(body) {
  const bad = (message) => { throw new HttpError(400, message); };
  if (typeof body !== "object" || body === null || Array.isArray(body)) bad("Send a rating.");
  const { kind, dish, stars, made, tags = [], note = "" } = body;
  if (kind !== "meal" && kind !== "cocktail") bad("Choose a meal or a cocktail.");
  if (typeof dish !== "string" || !dish.trim() || dish.length > 120) bad("Choose a dish or drink.");
  const key = normalize_dish_name(dish);
  if (!key) bad("Choose a dish or drink.");
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) bad("Choose 1 to 5 stars.");
  if (typeof made !== "boolean") bad("Say whether you made it.");
  if (!Array.isArray(tags) || tags.length > RATING_TAGS.length || tags.some((t) => !RATING_TAGS.includes(t))) bad("Unknown rating tag.");
  if (typeof note !== "string" || note.length > MAX_NOTE) bad(`Notes can be up to ${MAX_NOTE} characters.`);
  return { kind, dish: key, stars, made, tags: [...new Set(tags)].sort(), note: note.trim() };
}

export function create_rating_store(db, { now = () => new Date() } = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS recipe_ratings (
    user_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('meal','cocktail')), dish TEXT NOT NULL,
    stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5), made INTEGER NOT NULL, tags TEXT NOT NULL, note TEXT NOT NULL,
    updated_at TEXT NOT NULL, PRIMARY KEY(user_id,kind,dish));
    CREATE INDEX IF NOT EXISTS recipe_ratings_dish ON recipe_ratings(kind,dish);
    CREATE TABLE IF NOT EXISTS recipe_rating_rates (user_id TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL,
    PRIMARY KEY(user_id,day));`);

  function prune() {
    db.prepare("DELETE FROM recipe_ratings WHERE updated_at<?").run(new Date(now().getTime() - KEEP_DAYS * 86400000).toISOString());
    db.prepare("DELETE FROM recipe_rating_rates WHERE day<?").run(now().toISOString().slice(0, 10));
  }

  /** Saves or replaces this account's rating for a dish. */
  function rate(uid, body) {
    const r = validate_rating(body);
    const at = now().toISOString();
    const day = at.slice(0, 10);
    db.exec("BEGIN IMMEDIATE");
    try {
      const used = db.prepare("SELECT count FROM recipe_rating_rates WHERE user_id=? AND day=?").get(uid, day)?.count ?? 0;
      if (used >= DAILY_LIMIT) throw new HttpError(429, "That's a lot of ratings for one day. Please try again tomorrow.");
      db.prepare(`INSERT INTO recipe_rating_rates (user_id,day,count) VALUES (?,?,1)
        ON CONFLICT(user_id,day) DO UPDATE SET count=count+1`).run(uid, day);
      db.prepare(`INSERT INTO recipe_ratings (user_id,kind,dish,stars,made,tags,note,updated_at) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(user_id,kind,dish) DO UPDATE SET stars=excluded.stars, made=excluded.made, tags=excluded.tags,
        note=excluded.note, updated_at=excluded.updated_at`)
        .run(uid, r.kind, r.dish, r.stars, r.made ? 1 : 0, JSON.stringify(r.tags), r.note, at);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return { ok: true };
  }

  /** One row per dish, lowest average first, with tag counts and the latest notes. */
  function summary({ min_ratings = 1, limit = 100 } = {}) {
    const min = Number.isInteger(min_ratings) && min_ratings > 0 ? min_ratings : 1;
    const top = Number.isInteger(limit) && limit > 0 && limit <= 500 ? limit : 100;
    const dishes = db.prepare(`SELECT kind, dish, COUNT(*) AS ratings, ROUND(AVG(stars),2) AS average, SUM(made) AS made
      FROM recipe_ratings GROUP BY kind, dish HAVING COUNT(*)>=? ORDER BY average ASC, ratings DESC LIMIT ?`).all(min, top);
    const rows = db.prepare("SELECT tags, note, stars, updated_at FROM recipe_ratings WHERE kind=? AND dish=? ORDER BY updated_at DESC");
    return {
      dishes: dishes.map((d) => {
        const all = rows.all(d.kind, d.dish);
        const tags = {};
        for (const row of all) for (const tag of JSON.parse(row.tags)) tags[tag] = (tags[tag] ?? 0) + 1;
        const notes = all.filter((row) => row.note).slice(0, 5).map((row) => ({ stars: row.stars, note: row.note, at: row.updated_at }));
        return { kind: d.kind, dish: d.dish, ratings: d.ratings, average: d.average, made: d.made, tags, notes };
      }),
    };
  }

  function remove_user(uid) {
    db.prepare("DELETE FROM recipe_ratings WHERE user_id=?").run(uid);
    db.prepare("DELETE FROM recipe_rating_rates WHERE user_id=?").run(uid);
  }

  return { rate, summary, prune, remove_user };
}
