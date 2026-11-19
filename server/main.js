// Starts the Recipeak backend. Configuration comes only from environment variables (see .env.example).
import { createServer } from "node:http";
import { create_app } from "./app.js";
import { create_image_library, curated_keys } from "./dish_images.js";
import { create_firebase_authorizer } from "./firebase_auth.js";
import { create_premium_authorizer } from "./premium_access.js";
import { create_usage_store } from "./usage_store.js";

export function configure(env) {
  const production = env.NODE_ENV === "production";
  const missing = ["OPENAI_API_KEY", ...(production ? ["FIREBASE_PROJECT_ID", "MM_AI_USAGE_DB", "REVENUECAT_SECRET_API_KEY", "MM_IMAGE_DIR"] : [])]
    .filter((name) => !String(env[name] || "").trim());
  if (missing.length) throw new Error(`Set ${missing.join(", ")} before starting the backend.`);
  if (production && env.MM_DEV_ALLOW_UNAUTHENTICATED) throw new Error("MM_DEV_ALLOW_UNAUTHENTICATED must not be set in production.");

  let authorize;
  if (env.FIREBASE_PROJECT_ID) authorize = create_firebase_authorizer(env.FIREBASE_PROJECT_ID);
  else if (env.MM_DEV_ALLOW_UNAUTHENTICATED === "1") {
    // Local development only: treat each network address as one account.
    authorize = async (request) => ({ uid: `dev:${request.socket.remoteAddress}`, auth_time: Math.floor(Date.now() / 1000) });
  } else throw new Error("Set FIREBASE_PROJECT_ID, or MM_DEV_ALLOW_UNAUTHENTICATED=1 for local development.");

  // Without a RevenueCat key (development only), everyone is a free user.
  const premium = env.REVENUECAT_SECRET_API_KEY ? create_premium_authorizer(env) : async () => false;
  const store = create_usage_store(env);
  return { authorize, premium, store, images: create_image_library({ env, store }), featured: curated_keys() };
}

if (import.meta.main) {
  const { authorize, premium, store, images, featured } = configure(process.env);
  const app = create_app({ env: process.env, store, authorize, premium, images, featured });
  // Outside production, print one line per request (method, path, status, time) to help with local testing.
  // Never the body, headers or sign-in token.
  const handle = process.env.NODE_ENV === "production"
    ? app
    : (request, response) => {
        const started = Date.now();
        const path = String(request.url || "").split("?")[0];
        console.log(`-> ${request.method} ${path}`);
        response.on("close", () => console.log(`<- ${request.method} ${path} ${response.statusCode}${response.writableFinished ? "" : " (closed early)"} ${Date.now() - started} ms`));
        return app(request, response);
      };
  const port = Number(process.env.PORT || 8787);
  // Old feedback is removed hourly as well as at start, so nothing outlives its one-year retention.
  setInterval(() => {
    try { store.feedback.prune(); } catch { console.warn("Feedback retention is waiting for storage; it will retry."); }
    try { store.ratings.prune(); } catch { console.warn("Rating retention is waiting for storage; it will retry."); }
    try { store.prune_deleted(); } catch { console.warn("Deleted-account cleanup is waiting for storage; it will retry."); }
  }, 3_600_000).unref();
  const server = createServer({ requestTimeout: 90_000, headersTimeout: 15_000 }, handle);
  server.listen(port, process.env.HOST || "127.0.0.1", () => console.log(`Recipeak backend on port ${port}`));
}
