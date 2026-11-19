// Where the privacy policy, terms of use and support email live. The recipe server publishes the two pages.
export const SUPPORT_EMAIL = "majorapps.support@gmail.com";

/** The public page addresses, or null when this build isn't connected to a recipe server. */
export function legal_page_urls(base_url: string | undefined): { privacy: string; terms: string } | null {
  if (!base_url) return null;
  const base = base_url.replace(/\/+$/, "");
  return { privacy: `${base}/privacy`, terms: `${base}/terms` };
}

/** Recipeak's Google Play page. Set it once the app is published; until then shared recipes leave the link out. */
export const STORE_URL: string | null = null;

export const support_mail_url = () => `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Recipeak support")}`;
