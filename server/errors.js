/** An expected HTTP failure with a safe, user-facing message. */
export class HttpError extends Error {
  constructor(status, message, { code, headers } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

// A free allowance is used up: the app shows its paywall instead of asking the person to try again later.
const UPGRADE_CODES = new Set(["FREE_PHOTOS_USED", "FREE_VERSIONS_USED", "PREMIUM_VERSIONS"]);

/** A usage limit was reached: daily cap, rate limit, budget, or a free allowance is used up. */
export class AiLimitError extends HttpError {
  constructor(message, code = "AI_LIMIT") {
    const upgrade = UPGRADE_CODES.has(code);
    super(upgrade ? 402 : 429, message, { code, headers: upgrade ? {} : { "Retry-After": "60" } });
  }
}
