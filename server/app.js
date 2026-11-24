// HTTP handler for the Recipeak backend. Plain Node http, like Votic: no framework to keep patched.
import { AiLimitError, HttpError } from "./errors.js";
import { ai_failure_reason, call_openai } from "./openai_gateway.js";
import { curated_catalog, image_key } from "./dish_images.js";
import { FeedbackError } from "./feedback.js";
import { readFileSync } from "node:fs";
import { PremiumVerificationError } from "./premium_access.js";
import {
  DEFAULT_MODEL, MAX_IMAGE_BYTES, PREMIUM_DIETS, addition_payload, adds_what_it_promised, identify_payload, parse_addition_request,
  parse_image, parse_recipe_request, recipe_payload, review_payload, validate_identification, validate_recipe, with_detected_allergens,
} from "./recipe_ai.js";

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "Cross-Origin-Resource-Policy": "same-origin",
};
// The private feedback dashboard (admin/feedback.html) loads its own script and styles, and signs in through
// Firebase's password sign-in. Nothing else may run, load or connect.
const ADMIN_PAGE_HEADERS = {
  ...SECURITY_HEADERS,
  "Content-Security-Policy": "default-src 'none'; base-uri 'none'; connect-src 'self' https://identitytoolkit.googleapis.com; form-action 'self'; frame-ancestors 'none'; img-src 'self'; script-src 'self'; style-src 'self'",
  "X-Frame-Options": "DENY",
};
const ADMIN_FILES = {
  "/admin/feedback": ["feedback.html", "text/html; charset=utf-8"],
  "/admin/feedback.js": ["feedback.js", "text/javascript; charset=utf-8"],
  "/admin/feedback.css": ["feedback.css", "text/css; charset=utf-8"],
};
const admin_file = (name) => readFileSync(new URL(`../admin/${name}`, import.meta.url));
// Public privacy policy and terms of use, linked from the app and the store listings. No scripts; only their own styles.
const LEGAL_PAGE_HEADERS = {
  ...SECURITY_HEADERS,
  "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; style-src 'self'",
  "Cache-Control": "public, max-age=3600",
  "Cross-Origin-Resource-Policy": "cross-origin",
};
const LEGAL_FILES = {
  "/privacy": ["privacy.html", "text/html; charset=utf-8"],
  "/terms": ["terms.html", "text/html; charset=utf-8"],
  "/legal/legal.css": ["legal.css", "text/css; charset=utf-8"],
};
const legal_file = (name) => readFileSync(new URL(`./legal/${name}`, import.meta.url));
const FEEDBACK_BODY = 16_384;

// Base64 grows a file by a third; leave room for the JSON wrapper.
const MAX_IDENTIFY_BODY = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4096;
const BODY_TIMEOUT_MS = 20_000;

/**
 * authorize(request, path) → { uid } | false   (Firebase ID token check)
 * premium(uid) → boolean                       (RevenueCat, server-side; throws PremiumVerificationError if unsure)
 */
export function create_app({ env = {}, store, authorize, premium, images = null, featured = new Set(), fetch_impl = fetch, log = console }) {
  const model = env.OPENAI_MODEL || DEFAULT_MODEL;
  // Shared cover photos. Without a library (tests, or images turned off) every photo is "unavailable" and the app shows its own art.
  const existing_photo = (kind, name) => (images ? images.peek({ kind, name }) : { status: "unavailable", url: null });
  const photo = (kind, name, user, recipe) =>
    images ? images.status({ kind, name, user_id: user.uid, details: recipe_details(recipe) }) : { status: "unavailable", url: null };

  async function identify(user, body, signal) {
    const image = parse_image(body?.image);
    if (!image) throw new HttpError(400, "Send a JPEG, PNG or WebP photo under 4 MB.");
    const is_premium = await premium(user.uid);
    const { text, request_id } = await call_openai({ fetch_impl, store, env, user_id: user.uid, feature: "identify", premium: is_premium,
      payload: identify_payload(image, model), signal });
    let found;
    try { found = validate_identification(JSON.parse(text)); } catch (error) { store.release_photo(request_id); throw error; }
    if (found.kind === "not_food") store.release_photo(request_id);
    // Only names come back: the app looks them up in Recipeak's recipes. A photo already in the library is sent along,
    // but nothing new is made: an AI recipe and photo are only made if the person says yes (POST /api/recipe).
    const guesses = found.guesses.map((g) => ({ ...g, image: existing_photo(found.kind, g.name) }));
    return { ...found, guesses, free_photos_left: is_premium ? null : store.free_photos_left(user.uid), premium: is_premium };
  }

  async function recipe(user, body, signal) {
    const request = parse_recipe_request(body);
    if (!request) throw new HttpError(400, "Choose a dish or drink name, and a supported diet if any.");
    const is_premium = await premium(user.uid);
    // Checked before anything is spent, so a free account is never charged a version it can't see.
    if (request.diet && PREMIUM_DIETS.includes(request.diet) && !is_premium) throw premium_versions();
    if (!request.diet && !request.correction) return photo_recipe(user, request, is_premium);
    // A diet version of a dish already in the library is shared: made once, then reused for everyone with no AI request.
    const key = image_key(request.kind, request.name);
    const diet_key = request.diet && key ? `diet:${key}:${request.diet}` : null;
    const kept = diet_key ? store.get_recipe(diet_key) : null;
    if (kept) return { recipe: kept, image: photo(request.kind, request.name, user, null) };
    // Free diet versions (everything but vegetarian and vegan) of a library dish are free for every account, even one
    // that hasn't taken a photo yet: they use no free photo and no follow-up. Names the library doesn't have stay
    // follow-ups to a photo, so a diet request can't stand in for photo recognition or a new recipe.
    const in_library = Boolean(key && (featured.has(key) || store.get_recipe(`photo:${key}`)));
    // A name typed after a photo couldn't be read stands in for that photo, so it uses a free photo (the unread
    // photo didn't). Other recipe requests are follow-ups to a photo that worked.
    const feature = request.correction ? "correction" : request.diet && in_library ? "diet" : "recipe";
    const { text, request_id } = await call_openai({ fetch_impl, store, env, user_id: user.uid, feature, premium: is_premium,
      payload: recipe_payload(request, model), signal });
    let recipe_reply;
    try { recipe_reply = validate_recipe(JSON.parse(text)); } catch (error) { store.release_photo(request_id); throw error; }
    if (diet_key && in_library) store.set_recipe({ key: diet_key, kind: request.kind, name: request.name, recipe: recipe_reply });
    // A diet version shares the original dish's photo, so only the standard recipe may describe it.
    return { recipe: recipe_reply, image: photo(request.kind, request.name, user, request.diet ? null : recipe_reply) };
  }

  /**
   * The standard recipe for a dish Recipeak doesn't have, made when the person agrees. It is written, then checked
   * by a second careful read and the allergen word list, and kept: the next person who photographs the same dish gets
   * it (and its photo) straight away, without another AI request.
   */
  async function photo_recipe(user, request, is_premium) {
    const key = image_key(request.kind, request.name);
    const cache_key = key ? `photo:${key}` : null;
    let found = cache_key ? store.get_recipe(cache_key) : null;
    if (!found) {
      const job_key = cache_key ?? `${user.uid}:${request.name}`;
      if (!making.has(job_key)) {
        // Not tied to this person's connection: if they leave, the recipe still finishes and is kept for next time.
        // Each AI call has the gateway's own time limit, and the app waits long enough for both (client.ts).
        const job = (async () => {
          const first = await call_openai({ fetch_impl, store, env, user_id: user.uid, feature: "recipe", premium: is_premium,
            payload: recipe_payload(request, model) });
          const draft = validate_recipe(JSON.parse(first.text));
          // The check is part of the same request for the person: it doesn't use another free follow-up.
          let checked;
          try {
            const second = await call_openai({ fetch_impl, store, env, user_id: user.uid, feature: "review", premium: is_premium,
              payload: review_payload({ name: request.name, kind: request.kind, recipe: draft }, model) });
            checked = validate_recipe(JSON.parse(second.text));
          } catch (error) {
            // A failed check still shows the draft (with the allergen word list applied), but never keeps it, so the
            // next person gets a properly checked recipe.
            log.warn?.("recipe check failed", error?.name ?? "error");
            return with_detected_allergens(draft);
          }
          const final = with_detected_allergens(checked);
          if (cache_key) store.set_recipe({ key: cache_key, kind: request.kind, name: request.name, recipe: final });
          return final;
        })().finally(() => making.delete(job_key));
        making.set(job_key, job);
      }
      found = await making.get(job_key);
    }
    // The photo is made from the checked recipe, so its glass, garnish and ingredients match.
    return { recipe: found, image: photo(request.kind, request.name, user, found) };
  }

  const premium_versions = () =>
    new AiLimitError("Vegetarian, vegan, and meat or dairy versions are part of Premium.", "PREMIUM_VERSIONS");

  // "Make it non-vegetarian" or "Make it non-vegan" for a dish that is already vegetarian or vegan: the recipe on
  // screen with meat or seafood, or dairy or eggs, added properly. Premium only.
  async function addition(user, body, signal) {
    const request = parse_addition_request(body);
    if (!request) throw new HttpError(400, "Choose a vegetarian or vegan meal to change.");
    if (!(await premium(user.uid))) throw premium_versions();
    const { text } = await call_openai({ fetch_impl, store, env, user_id: user.uid, feature: "addition", premium: true,
      payload: addition_payload(request, model), signal });
    const made = validate_recipe(JSON.parse(text));
    if (!adds_what_it_promised(made, request.addition)) throw new SyntaxError("The version didn't add what it promised");
    return { recipe: made };
  }

  // Recipes for the dishes on the Home photo wall. Each one is made once, saved, and shared by everyone,
  // so opening one costs a user nothing: it uses no free photo and no free recipe.
  const making = new Map();
  async function featured_recipe(user, body) {
    const request = parse_recipe_request(body);
    if (!request || request.diet) throw new HttpError(400, "Choose a dish or drink from the photo wall.");
    const key = image_key(request.kind, request.name);
    if (!key || !featured.has(key)) throw new HttpError(404, "That dish isn't on the photo wall.");
    let found = store.get_recipe(key);
    if (!found) {
      if (!making.has(key)) {
        const job = (async () => {
          const is_premium = await premium(user.uid);
          const { text } = await call_openai({ fetch_impl, store, env, user_id: user.uid, feature: "featured", premium: is_premium,
            payload: recipe_payload(request, model) });
          const made = validate_recipe(JSON.parse(text));
          store.set_recipe({ key, kind: request.kind, name: request.name, recipe: made });
          return made;
        })().finally(() => making.delete(key));
        making.set(key, job);
      }
      found = await making.get(key);
    }
    return { recipe: found, image: photo(request.kind, request.name, user, found) };
  }

  async function dish_image(user, _body, _signal, query) {
    const kind = query.get("kind");
    const name = query.get("name");
    if (!["meal", "cocktail"].includes(kind) || !name || name.length > 120) throw new HttpError(400, "Choose a dish or drink.");
    return { image: photo(kind, name, user) };
  }

  async function allowance(user) {
    const is_premium = await premium(user.uid);
    return { premium: is_premium, free_photos_left: is_premium ? null : store.free_photos_left(user.uid), free_photos_total: store.limits.free_photos };
  }

  // Feature requests and bug reports. Anyone signed in can send one; only the accounts listed in
  // MM_FEEDBACK_ADMIN_UIDS can read and organise them on the dashboard.
  const feedback_admins = new Set(String(env.MM_FEEDBACK_ADMIN_UIDS || "").split(",").map((uid) => uid.trim()).filter(Boolean));
  const send_feedback = async (user, body) => store.feedback.create(user.uid, body);
  const admin_only = (work) => async (user, body) => {
    if (!feedback_admins.has(user.uid)) throw new HttpError(403, "Administrator access is required.");
    return work(body);
  };

  // Deleting an account needs a sign-in from the last five minutes, so a phone left unlocked can't do it.
  const RECENT_SIGN_IN_SECONDS = 5 * 60;
  async function delete_account(user) {
    const signed_in = typeof user.auth_time === "number" ? user.auth_time : 0;
    if (Date.now() / 1000 - signed_in > RECENT_SIGN_IN_SECONDS)
      throw new HttpError(401, "Confirm your sign-in again to delete your account.", { code: "RECENT_SIGN_IN_REQUIRED" });
    // Like Votic, the RevenueCat billing profile goes too. The store subscription itself is managed in Google Play or
    // the App Store, which the app explains before deleting. Done first, so a failure leaves everything retryable.
    if (env.REVENUECAT_SECRET_API_KEY) await delete_billing_profile(user.uid);
    return store.delete_account(user.uid);
  }

  async function delete_billing_profile(uid) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch_impl(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET_API_KEY}` },
        signal: controller.signal,
        redirect: "error",
      });
      // An already-removed profile is fine, so a retry after a partial failure still finishes.
      if (!response.ok && response.status !== 404) throw new Error("RevenueCat refused");
      await response.body?.cancel?.().catch(() => {});
    } catch {
      throw new HttpError(503, "Couldn't finish deleting your billing profile. Please try again in a moment.");
    } finally {
      clearTimeout(timer);
    }
  }

  const routes = {
    "POST /api/account/delete": { handler: delete_account, max_body: 256 },
    "POST /api/identify": { handler: identify, max_body: MAX_IDENTIFY_BODY },
    "POST /api/recipe": { handler: recipe, max_body: 2048 },
    "POST /api/featured-recipe": { handler: featured_recipe, max_body: 2048 },
    "POST /api/recipe-addition": { handler: addition, max_body: 65_536 },
    "GET /api/explore": { handler: async () => ({ dishes: curated_catalog() }), max_body: 0 },
    "GET /api/allowance": { handler: allowance, max_body: 0 },
    "GET /api/dish-image": { handler: dish_image, max_body: 0 },
    "POST /api/feedback": { handler: send_feedback, max_body: FEEDBACK_BODY },
    "POST /api/admin/feedback/list": { handler: admin_only((body) => store.feedback.dashboard(body?.query ?? "", body?.page ?? 0)), max_body: FEEDBACK_BODY },
    "POST /api/admin/feedback/details": {
      handler: admin_only((body) => {
        if (typeof body?.id !== "string") throw new HttpError(400, "Choose a feedback group.");
        return store.feedback.details(body.id, body.page ?? 0);
      }),
      max_body: FEEDBACK_BODY,
    },
    "POST /api/recipe-rating": { handler: async (user, body) => store.ratings.rate(user.uid, body), max_body: 4096 },
    "POST /api/admin/recipe-ratings": {
      handler: admin_only((body) => store.ratings.summary({ min_ratings: body?.min_ratings, limit: body?.limit })),
      max_body: 1024,
    },
    "POST /api/admin/feedback/mutate": { handler: admin_only((body) => store.feedback.mutate(body)), max_body: FEEDBACK_BODY },
  };

  return async function handle(request, response) {
    const url = new URL(request.url, "http://localhost");
    const path = url.pathname;
    try {
      if (path === "/healthz" && request.method === "GET") return send_json(response, 200, { ok: true });
      // Cover photos are generic pictures of dishes, shared by everyone, so they are public and cached for a long time.
      if (path.startsWith("/images/") && request.method === "GET") {
        const bytes = images?.read(path.slice("/images/".length));
        if (!bytes) throw new HttpError(404, "Not found.");
        for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, "Cache-Control": "public, max-age=31536000, immutable", "Content-Type": "image/jpeg" })) response.setHeader(k, v);
        return response.writeHead(200).end(bytes);
      }
      if (request.method === "GET" && path === "/admin/feedback-config") {
        // The Firebase web API key is a public project identifier, not a secret; the server still checks every request.
        return send_json(response, 200, { apiKey: env.FIREBASE_WEB_API_KEY || "" });
      }
      if (request.method === "GET" && Object.hasOwn(LEGAL_FILES, path)) {
        const [name, type] = LEGAL_FILES[path];
        const bytes = legal_file(name);
        for (const [k, v] of Object.entries({ ...LEGAL_PAGE_HEADERS, "Content-Type": type })) response.setHeader(k, v);
        return response.writeHead(200).end(bytes);
      }
      if (request.method === "GET" && ADMIN_FILES[path]) {
        const [name, type] = ADMIN_FILES[path];
        const bytes = admin_file(name);
        for (const [k, v] of Object.entries({ ...ADMIN_PAGE_HEADERS, "Content-Type": type })) response.setHeader(k, v);
        return response.writeHead(200).end(bytes);
      }
      const route = routes[`${request.method} ${path}`];
      if (!route) throw new HttpError(404, "Not found.");
      const user = await authorize(request, path);
      if (!user?.uid) throw new HttpError(401, "Please sign in again.");
      // A deleted account can only finish deleting: if removing its sign-in failed on the phone, the retry must still work.
      if (path !== "/api/account/delete" && store?.account_deleted?.(user.uid))
        throw new HttpError(401, "This account was deleted.", { code: "ACCOUNT_DELETED" });
      let body = null;
      if (route.max_body) {
        if (!/^application\/json\b/i.test(String(request.headers["content-type"] || ""))) throw new HttpError(415, "Send JSON.");
        try { body = JSON.parse((await read_body(request, route.max_body)).toString("utf8")); } catch (error) {
          if (error instanceof HttpError) throw error;
          throw new HttpError(400, "The request could not be read.");
        }
      }
      // Stop paying for an answer nobody is waiting for.
      const controller = new AbortController();
      response.on("close", () => { if (!response.writableFinished) controller.abort(); });
      return send_json(response, 200, await route.handler(user, body, controller.signal, url.searchParams));
    } catch (error) {
      if (error instanceof HttpError) return send_json(response, error.status, { error: error.message, ...(error.code ? { code: error.code } : {}) }, error.headers);
      if (error instanceof FeedbackError) return send_json(response, error.status, { error: error.message });
      if (error instanceof PremiumVerificationError) return send_json(response, 503, { error: error.message });
      log.warn?.("AI request failed", path, ai_failure_reason(error));
      return send_json(response, 502, { error: "Couldn't get a recipe right now. Please try again." });
    }
  };
}

async function read_body(request, limit) {
  const chunks = [];
  let size = 0;
  const declared = Number(request.headers["content-length"]);
  if (Number.isFinite(declared) && declared > limit) throw new HttpError(413, "The photo is too large.");
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new HttpError(408, "The upload took too long.")), BODY_TIMEOUT_MS); });
  const reading = (async () => {
    for await (const chunk of request) {
      size += chunk.length;
      if (size > limit) throw new HttpError(413, "The photo is too large.");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  })();
  try { return await Promise.race([reading, timeout]); } finally { clearTimeout(timer); }
}

function send_json(response, status, body, headers = {}) {
  if (response.destroyed || response.writableEnded) return;
  for (const [key, value] of Object.entries({ ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8", ...headers })) response.setHeader(key, value);
  response.writeHead(status).end(JSON.stringify(body));
}

export { AiLimitError };

/** The parts of a recipe that describe how the dish looks. */
function recipe_details(recipe) {
  if (!recipe) return {};
  return {
    glass: recipe.cocktail?.glass,
    garnish: recipe.cocktail?.garnish,
    ingredients: recipe.ingredients?.map((i) => i.item),
  };
}
