// Starts the Meals and Mixers backend. Configuration comes only from environment variables (see .env.example).
import { createServer } from "node:http";
import { create_app } from "./app.js";
import { create_image_library } from "./dish_images.js";
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
    authorize = async (request) => ({ uid: `dev:${request.socket.remoteAddress}` });
  } else throw new Error("Set FIREBASE_PROJECT_ID, or MM_DEV_ALLOW_UNAUTHENTICATED=1 for local development.");

  // Without a RevenueCat key (development only), everyone is a free user.
  const premium = env.REVENUECAT_SECRET_API_KEY ? create_premium_authorizer(env) : async () => false;
  const store = create_usage_store(env);
  return { authorize, premium, store, images: create_image_library({ env, store }) };
}

if (import.meta.main) {
  const { authorize, premium, store, images } = configure(process.env);
  const handle = create_app({ env: process.env, store, authorize, premium, images });
  const port = Number(process.env.PORT || 8787);
  const server = createServer({ requestTimeout: 90_000, headersTimeout: 15_000 }, handle);
  server.listen(port, process.env.HOST || "127.0.0.1", () => console.log(`Meals and Mixers backend on port ${port}`));
}
