// Every paid OpenAI call goes through here. Adapted from Votic's app_parts/openai_gateway.js:
// reserve before sending, settle against reported usage, keep uncertain charges, never retry automatically.
import { createHash } from "node:crypto";
import { AI_EXECUTION_TIMEOUT_MS, model_prices } from "./usage_store.js";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
// Same high-detail image reservation as Votic's camera scan; settled against real usage afterwards.
const IMAGE_TOKEN_RESERVATION = 50_000;

export class AiProviderError extends Error {
  constructor(status, code) {
    super("AI unavailable");
    this.provider_status = status;
    this.provider_code = typeof code === "string" ? code : null;
  }
}

export function response_text(result) {
  if (!Array.isArray(result?.output)) return "";
  return result.output
    .filter((item) => item.type === "message" && item.role === "assistant")
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text).join("\n").trim();
}

/** Returns { text, request_id }. Throws AiLimitError before any provider call when a limit is reached. */
export async function call_openai({ fetch_impl, store, env, user_id, feature, premium, payload, signal }) {
  const body = {
    ...payload,
    store: false,
    service_tier: "default",
    safety_identifier: createHash("sha256").update(user_id).digest("hex"),
    ...(payload.model.startsWith("gpt-6-") ? { reasoning: { effort: "none" } } : {}),
  };
  let image_count = 0;
  // Base64 is transport data, not image tokens: reserve a fixed amount per image instead of its byte length.
  const accounting = JSON.stringify(body, (_key, value) => {
    if (value && typeof value === "object" && value.type === "input_image") { image_count += 1; return { type: "input_image" }; }
    return value;
  });
  const input_bound = image_count * IMAGE_TOKEN_RESERVATION + Buffer.byteLength(accounting, "utf8") + 1024;
  const request_id = store.reserve({ user_id, feature, model: body.model, input_bound, output_bound: body.max_output_tokens,
    rates: model_prices(body.model, env), premium });

  let finished = false;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const timer = setTimeout(cancel, AI_EXECUTION_TIMEOUT_MS);
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    if (signal?.aborted) cancel();
    const response = await fetch_impl(RESPONSES_URL, {
      method: "POST",
      signal: controller.signal,
      redirect: "error",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json", "X-Client-Request-Id": request_id },
      body: JSON.stringify(body),
    });
    const provider_request_id = response.headers?.get?.("x-request-id") || null;
    if (!response.ok) {
      // 4xx is a rejection that spent nothing; 5xx may have spent tokens, so its reservation is kept.
      store.finish(request_id, { status: "provider-error", provider_request_id, rejected: response.status >= 400 && response.status < 500 });
      finished = true;
      // Keep only the status and error code, never the provider's message.
      const error_body = await response.json().catch(() => null);
      throw new AiProviderError(response.status, error_body?.error?.code ?? error_body?.error?.type);
    }
    const result = await response.json();
    const status = result.status === "incomplete" || result.status === "failed" ? result.status : "completed";
    store.finish(request_id, { status, result, provider_request_id });
    finished = true;
    if (status !== "completed") throw new Error("AI response did not complete");
    return { text: response_text(result), request_id };
  } catch (error) {
    if (!finished) store.finish(request_id, { status: "unknown" });
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

/** A loggable reason a call failed that never contains the user's photo, the reply, or a key. */
export function ai_failure_reason(error) {
  if (error?.provider_status) return { status: error.provider_status, code: error.provider_code ?? null };
  if (error?.name === "AbortError") return { reason: "timed out" };
  if (error instanceof SyntaxError) return { reason: "invalid AI response" };
  return { reason: String(error?.message || "unknown").slice(0, 160) };
}
