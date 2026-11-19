// Deleting an account from Settings, as Apple and Google require for apps where people can create one.
// Order matters: confirm the password, delete the server's data, then the sign-in itself, then this phone's copy.
// If a step fails, everything before it can safely run again on the next try.
import { ratings_storage_name } from "../recipes/ratings";
import { recent_storage_name } from "../recipes/recentlyViewed";
import { saved_storage_name, type KeyValueStorage } from "../saved/savedRecipes";
import { preferences_storage_name } from "../settings/preferences";

export type DeleteAccountSteps = {
  /** Checks the password again. Throws if it's wrong. */
  confirm_password: (password: string) => Promise<void>;
  /** Removes feedback, ratings and usage links on the recipe server. */
  delete_server_data: () => Promise<void>;
  /** Removes the Firebase sign-in, so the email can't sign in again. */
  delete_sign_in: () => Promise<void>;
  /** Removes this account's saved recipes, photos, ratings, history and preferences from the phone. */
  clear_device: () => Promise<void>;
};

export async function delete_account(password: string, steps: DeleteAccountSteps): Promise<void> {
  if (!password) throw new Error("Enter your password to delete your account.");
  await steps.confirm_password(password);
  await steps.delete_server_data();
  await steps.delete_sign_in();
  await steps.clear_device();
}

/** Clears everything this phone keeps for one account. Other accounts on the same phone are untouched. */
export async function clear_account_device_data(storage: KeyValueStorage, uid: string, remove_photo: (uri: string) => void): Promise<void> {
  const saved_name = saved_storage_name(uid);
  try {
    // Read the photo addresses directly, so a recipe that no longer passes the checks still has its photo removed.
    const list: unknown = JSON.parse((await storage.getItem(saved_name)) ?? "[]");
    for (const entry of Array.isArray(list) ? list : []) {
      const uri = (entry as { photo_uri?: unknown } | null)?.photo_uri;
      if (typeof uri === "string" && uri.startsWith("file://")) remove_photo(uri);
    }
  } catch {
    // An unreadable list still gets removed below.
  }
  for (const name of [saved_name, ratings_storage_name(uid), recent_storage_name(uid), preferences_storage_name(uid)])
    await storage.removeItem(name);
}

/** Plain sentences for what can go wrong while deleting. */
export function delete_account_problem(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "That password isn't right. Try again.";
  if (code.includes("too-many-requests")) return "Too many tries. Wait a few minutes and try again.";
  if (code.includes("network")) return "Couldn't connect. Check your internet and try again.";
  const message = (error as Error)?.message;
  return typeof message === "string" && message.length > 0 && message.length < 200
    ? message
    : "Couldn't delete your account. Check your connection and try again.";
}
