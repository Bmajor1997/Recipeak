/** An expected HTTP failure with a safe, user-facing message. */
export class HttpError extends Error {
  constructor(status, message, { code, headers } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

/** A usage limit was reached: daily cap, rate limit, budget, or the free photos are used up. */
export class AiLimitError extends HttpError {
  constructor(message, code = "AI_LIMIT") {
    super(code === "FREE_PHOTOS_USED" ? 402 : 429, message, { code, headers: code === "FREE_PHOTOS_USED" ? {} : { "Retry-After": "60" } });
  }
}
