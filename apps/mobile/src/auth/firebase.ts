// Email sign-in through Firebase, set up the same way as Votic (src/auth/authBackend.ts there).
// Google and Apple sign-in can be added later in the same way Votic does.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type FirebaseApp, getApp, getApps, initializeApp } from "@firebase/app";
import * as FirebaseAuth from "@firebase/auth";
import { account_token } from "./accountToken";
import {
  type Auth,
  type Persistence,
  createUserWithEmailAndPassword,
  getAuth,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "@firebase/auth";

export type AppUser = { uid: string; email: string | null };

// EXPO_PUBLIC_ values are public build settings (not secrets), inlined at build time by their full names.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

let cachedAuth: Auth | null = null;
function auth(): Auth {
  if (!firebaseConfigured) throw new Error("Sign-in isn't set up in this build yet.");
  if (cachedAuth) return cachedAuth;
  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  // The React Native build exports getReactNativePersistence, but the public typings omit it.
  const { getReactNativePersistence } = FirebaseAuth as typeof FirebaseAuth & {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
  };
  try {
    cachedAuth = getReactNativePersistence
      ? FirebaseAuth.initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
      : getAuth(app);
  } catch {
    cachedAuth = getAuth(app);
  }
  return cachedAuth;
}

/**
 * Test mode, for trying the app on an emulator before Firebase is set up. It only exists in development builds
 * that have no Firebase settings, so it can never appear in the real app. The test user is local to the phone:
 * screens, the camera and Saved all work, but anything that needs the recipe server says it isn't connected.
 */
export const test_mode_available = __DEV__ && !firebaseConfigured;
const TEST_USER: AppUser = { uid: "test-mode", email: null };
let test_user: AppUser | null = null;
const test_listeners = new Set<(user: AppUser | null) => void>();
function set_test_user(next: AppUser | null) {
  test_user = next;
  for (const listener of test_listeners) listener(next);
}

export const firebase = {
  subscribe(listener: (user: AppUser | null) => void): () => void {
    if (!firebaseConfigured) {
      test_listeners.add(listener);
      listener(test_user);
      return () => test_listeners.delete(listener);
    }
    return onIdTokenChanged(auth(), (user) => listener(user ? { uid: user.uid, email: user.email } : null));
  },
  async sign_in(email: string, password: string) {
    await signInWithEmailAndPassword(auth(), email.trim(), password);
  },
  async create_account(email: string, password: string) {
    await createUserWithEmailAndPassword(auth(), email.trim(), password);
  },
  async reset_password(email: string) {
    await sendPasswordResetEmail(auth(), email.trim());
  },
  /** Enters test mode (development builds without Firebase only). */
  start_test_mode() {
    if (test_mode_available) set_test_user(TEST_USER);
  },
  async sign_out() {
    if (!firebaseConfigured) return set_test_user(null);
    await firebaseSignOut(auth());
  },
  async id_token(expected_uid?: string): Promise<string | null> {
    if (!firebaseConfigured) return null;
    const user = auth().currentUser;
    return account_token(user ? { uid: user.uid, get_token: () => user.getIdToken() } : null, expected_uid);
  },
};

/** Turns Firebase error codes into plain sentences. */
export function sign_in_problem(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
    return "That email and password don't match. Try again, or reset your password.";
  if (code.includes("email-already-in-use")) return "There's already an account with that email. Sign in instead.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("weak-password")) return "Use a password with at least 8 characters.";
  if (code.includes("too-many-requests")) return "Too many tries. Wait a few minutes and try again.";
  if (code.includes("network")) return "Couldn't connect. Check your internet and try again.";
  return (error as Error)?.message?.startsWith("Sign-in isn't set up")
    ? (error as Error).message
    : "Sign-in didn't work. Please try again.";
}
