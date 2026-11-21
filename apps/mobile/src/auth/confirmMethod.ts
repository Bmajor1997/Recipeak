/** The way an account confirms who it is before deletion: its password, Google, or Apple. */
export type ConfirmMethod = "password" | "google" | "apple";

/** Accounts with a password use it; accounts made only with Google or Apple confirm with that account instead. */
export function confirm_method(user: { providers?: string[] } | null): ConfirmMethod {
  const providers = user?.providers ?? [];
  if (providers.length === 0 || providers.includes("password")) return "password";
  return providers.includes("google.com") ? "google" : "apple";
}
