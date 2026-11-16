// HTTP handler for the Recipeek backend. Plain Node http, like Votic: no framework to keep patched.
import { AiLimitError, HttpError } from "./errors.js";
import { ai_failure_reason, call_openai } from "./openai_gateway.js";
import { curated_catalog, image_key } from "./dish_images.js";
import { FeedbackError } from "./feedback.js";
import { readFileSync } from "node:fs";
import { PremiumVerificationError } from "./premium_access.js";
import {
  DEFAULT_MODEL, MAX_IMAGE_BYTES, identify_payload, parse_image, parse_recipe_request, recipe_payload,
  validate_identification, validate_recipe,
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
    // Every guess gets a cover photo: ready from the library, or started now in the background.
    // The top match's recipe is known, so its glass, garnish and ingredients shape its photo if it's new.
    const guesses = found.guesses.map((g, i) => ({ ...g, image: photo(found.kind, g.name, user, i === 0 ? found.recipe : null) }));
    return { ...found, guesses, free_photos_left: is_premium ? null : store.free_photos_left(user.uid), premium: is_premium };
  }

  async function recipe(user, body, signal) {
    const request = parse_recipe_request(body);
    if (!request) throw new HttpError(400, "Choose a dish or drink name, and a supported diet if any.");
    const is_premium = await premium(user.uid);
    // A name typed after a photo couldn't be read stands in for that photo, so it uses a free photo (the unread
    // photo didn't). Other recipe requests are follow-ups to a photo that worked.
    const feature = request.correction ? "correction" : "recipe";
    const { text, request_id } = await call_openai({ fetch_impl, store, env, user_id: user.uid, feature, premium: is_premium,
      payload: recipe_payload(request, model), signal });
    let recipe_reply;
    try { recipe_reply = validate_recipe(JSON.parse(text)); } catch (error) { store.release_photo(request_id); throw error; }
    // A diet version shares the original dish's photo, so only the standard recipe may describe it.
    return { recipe: recipe_reply, image: photo(request.kind, request.name, user, request.diet ? null : recipe_reply) };
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

  const routes = {
    "POST /api/identify": { handler: identify, max_body: MAX_IDENTIFY_BODY },
    "POST /api/recipe": { handler: recipe, max_body: 2048 },
    "POST /api/featured-recipe": { handler: featured_recipe, max_body: 2048 },
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
