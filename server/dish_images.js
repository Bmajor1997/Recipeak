// The shared cover-photo library: one polished, CREME-style photo per dish or drink, created once and reused
// by everyone. The person's own photo is never used here; only the dish's name and kind reach the image model.
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { AiLimitError } from "./errors.js";

export const IMAGE_STYLE_VERSION = "v1";
const RESPONSES_URL = "https://api.openai.com/v1/images/generations";
const FILE_NAME = /^[a-f0-9]{32}\.jpg$/;
const RETRY_FAILED_AFTER_MS = 10 * 60_000;
const GENERATION_TIMEOUT_MS = 150_000;

/** "Chicken Parmesan!" and "chicken  parmesan" share one photo. */
export function normalize_dish_name(name) {
  if (typeof name !== "string") return null;
  const clean = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9&' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean && clean.length <= 80 ? clean : null;
}

export function image_key(kind, name) {
  const normal = normalize_dish_name(name);
  if (!normal || !["meal", "cocktail"].includes(kind)) return null;
  return createHash("sha256").update(`${IMAGE_STYLE_VERSION}|${kind}|${normal}`).digest("hex").slice(0, 32);
}

/** The house style: dark and moody, one side light, no people, no text. */
export function image_prompt(kind, name) {
  const dish = normalize_dish_name(name);
  const subject =
    kind === "cocktail"
      ? `a ${dish} cocktail, in its classic glass with its classic garnish, backlit so the drink glows`
      : `${dish}, plated the classic way it is usually served`;
  return [
    `Editorial food photograph of ${subject}.`,
    "Dark, moody, low-key lighting from one side; near-black background and surface; rich, true-to-life colour;",
    "close-up, shallow depth of field, portrait framing with the subject in the centre.",
    "No people, no hands, no text, no labels, no logos, no brand names.",
  ].join(" ");
}

export function create_image_library({ env = {}, store, fetch_impl = fetch, dir = env.MM_IMAGE_DIR, log = console }) {
  const enabled = env.MM_IMAGES_ENABLED !== "0" && Boolean(dir);
  const model = env.MM_IMAGE_MODEL || "gpt-image-2";
  const cost = Number(env.MM_IMAGE_PRICE_USD || 0.06);
  if (!Number.isFinite(cost) || cost <= 0) throw new Error("MM_IMAGE_PRICE_USD must be a positive number.");
  if (enabled) mkdirSync(dir, { recursive: true, mode: 0o755 });
  const in_flight = new Map();

  const url_for = (key) => `/images/${key}.jpg`;

  async function generate({ key, kind, name, user_id }) {
    let request_id;
    try {
      request_id = store.reserve_image({ user_id, model, cost });
    } catch (error) {
      if (error instanceof AiLimitError) return store.set_image({ key, kind, name, status: "failed" });
      throw error;
    }
    store.set_image({ key, kind, name, status: "pending" });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
    try {
      const response = await fetch_impl(RESPONSES_URL, {
        method: "POST",
        signal: controller.signal,
        redirect: "error",
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json", "X-Client-Request-Id": request_id },
        body: JSON.stringify({
          model,
          prompt: image_prompt(kind, name),
          size: "1024x1536",
          quality: env.MM_IMAGE_QUALITY || "medium",
          output_format: "jpeg",
          output_compression: 82,
          n: 1,
        }),
      });
      const provider_request_id = response.headers?.get?.("x-request-id") || null;
      if (!response.ok) {
        store.finish_image(request_id, { status: response.status < 500 ? "rejected" : "provider-error", provider_request_id });
        store.set_image({ key, kind, name, status: "failed" });
        log.warn?.("Cover photo failed", { status: response.status });
        return;
      }
      const body = await response.json();
      const bytes = Buffer.from(String(body?.data?.[0]?.b64_json || ""), "base64");
      // Only a real JPEG of sensible size is published.
      if (bytes.length < 1000 || bytes.length > 8_000_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Invalid image");
      const temp = join(dir, `.${key}.${randomUUID()}.tmp`);
      writeFileSync(temp, bytes, { mode: 0o644 });
      renameSync(temp, join(dir, `${key}.jpg`));
      store.finish_image(request_id, { status: "completed", provider_request_id });
      store.set_image({ key, kind, name, status: "ready" });
    } catch (error) {
      store.finish_image(request_id, { status: "unknown" });
      store.set_image({ key, kind, name, status: "failed" });
      log.warn?.("Cover photo failed", { reason: error?.name === "AbortError" ? "timed out" : "error" });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    enabled,
    /**
     * Where this dish's photo stands. Starts creating it in the background if nobody has yet.
     * Returns { status: "ready", url } | { status: "pending", url: null } | { status: "unavailable", url: null }.
     */
    status({ kind, name, user_id }) {
      const key = image_key(kind, name);
      if (!enabled || !key) return { status: "unavailable", url: null };
      if (existsSync(join(dir, `${key}.jpg`))) return { status: "ready", url: url_for(key) };
      if (in_flight.has(key)) return { status: "pending", url: null };
      const row = store.get_image(key);
      if (row?.status === "failed" && Date.now() - Date.parse(row.updated_at) < RETRY_FAILED_AFTER_MS) return { status: "unavailable", url: null };
      const job = generate({ key, kind, name: normalize_dish_name(name), user_id }).finally(() => in_flight.delete(key));
      in_flight.set(key, job);
      job.catch(() => {});
      return { status: "pending", url: null };
    },
    /** For the seed script and tests: wait for every photo being created right now. */
    async settled() {
      await Promise.allSettled([...in_flight.values()]);
    },
    /** Reads a published photo for the public /images/ route. Only exact library file names are accepted. */
    read(file) {
      if (!enabled || !FILE_NAME.test(file)) return null;
      try {
        return readFileSync(join(dir, file));
      } catch {
        return null;
      }
    },
  };
}
