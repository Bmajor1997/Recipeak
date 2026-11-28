import { SignInCancelled } from "./signInCancelled";

/** Turns Firebase error codes into plain sentences. */
export function sign_in_problem(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  if (error instanceof SignInCancelled) return "";
  // Google's own messages (from googleSignIn.ts) are already plain sentences.
  if ((error as Error)?.name === "RecipeakAuthUnavailable") return (error as Error).message;
  if (code.includes("account-exists-with-different-credential"))
    return "This email already has a Relish account. Sign in with your email and password instead.";
  if (code.includes("user-mismatch")) return "That's a different account. Choose the account you're signed in with.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
    return "That email and password don't match. Try again, or reset your password.";
  if (code.includes("email-already-in-use")) return "There's already an account with that email. Sign in instead.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("weak-password")) return "Use a password with at least 8 characters.";
  if (code.includes("too-many-requests")) return "Too many tries. Wait a few minutes and try again.";
  if (code.includes("network")) return "Couldn't connect. Check your internet and try again.";
  const message = (error as Error)?.message ?? "";
  if (message.startsWith("Sign in with Apple") || message.startsWith("Apple didn't")) return message;
  return (error as Error)?.message?.startsWith("Sign-in isn't set up")
    ? (error as Error).message
    : "Sign-in didn't work. Please try again.";
}
