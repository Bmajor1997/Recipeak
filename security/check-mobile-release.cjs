// Stops a Google Play (production) build that is missing the settings the real app needs, the same check Votic runs.
// Every value here is a public build setting that ships inside the app; secret keys never belong in the app.
const { isIP } = require("node:net");

function public_https(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password || !host || host === "localhost" || /\.(local|internal)$/.test(host)) return false;
    if (isIP(host) === 6 && !/^[23][0-9a-f]{3}:/.test(host)) return false;
    if (isIP(host) === 4) {
      const [a, b] = host.split(".").map(Number);
      if ([0, 10, 127].includes(a) || a >= 224 || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 100 && b >= 64 && b <= 127)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function validate_release_environment(env) {
  const required = [
    "EXPO_PUBLIC_FIREBASE_API_KEY",
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    "EXPO_PUBLIC_FIREBASE_APP_ID",
    "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
    "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
  ];
  const missing = required.filter((key) => !env[key]?.trim());
  // The real app talks to the permanent server over HTTPS, never the emulator's 10.0.2.2 address.
  if (!public_https(env.EXPO_PUBLIC_API_BASE_URL)) missing.push("EXPO_PUBLIC_API_BASE_URL (a public https:// address)");
  // Play builds must use RevenueCat's Google Play public SDK key, never its Test Store key or the backend secret.
  if (env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY && !/^goog_[A-Za-z0-9]+$/.test(env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY))
    missing.push("a Google Play RevenueCat public SDK key (starts with goog_)");
  if (missing.length) throw new Error("The Google Play build is missing or has invalid settings: " + missing.join(", "));
}

module.exports = { validate_release_environment, public_https };
