// HTTP handler for the Meals and Mixers backend. Plain Node http, like Votic: no framework to keep patched.
import { AiLimitError, HttpError } from "./errors.js";
import { ai_failure_reason, call_openai } from "./openai_gateway.js";
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
// Base64 grows a file by a third; leave room for the JSON wrapper.
const MAX_IDENTIFY_BODY = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4096;
const BODY_TIMEOUT_MS = 20_000;

/**
 * authorize(request, path) → { uid } | false   (Firebase ID token check)
 * premium(uid) → boolean                       (RevenueCat, server-side; throws PremiumVerificationError if unsure)
 */
export function create_app({ env = {}, store, authorize, premium, images = null, fetch_impl = fetch, log = console }) {
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
    const { text } = await call_openai({ fetch_impl, store, env, user_id: user.uid, feature: "recipe", premium: is_premium,
      payload: recipe_payload(request, model), signal });
    const recipe_reply = validate_recipe(JSON.parse(text));
    // A diet version shares the original dish's photo, so only the standard recipe may describe it.
    return { recipe: recipe_reply, image: photo(request.kind, request.name, user, request.diet ? null : recipe_reply) };
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

  const routes = {
    "POST /api/identify": { handler: identify, max_body: MAX_IDENTIFY_BODY },
    "POST /api/recipe": { handler: recipe, max_body: 2048 },
    "GET /api/allowance": { handler: allowance, max_body: 0 },
    "GET /api/dish-image": { handler: dish_image, max_body: 0 },
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
