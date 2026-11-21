// Sign-in through Firebase, set up the same way as Votic (src/auth/authBackend.ts there): email and password,
// Continue with Google (Android and iPhone), and Sign in with Apple (iPhone only).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { type FirebaseApp, getApp, getApps, initializeApp } from "@firebase/app";
import * as FirebaseAuth from "@firebase/auth";
import { account_token } from "./accountToken";
import { create_google_sign_in } from "./googleSignIn";
import { SignInCancelled } from "./signInCancelled";
import {
  type Auth,
  type Persistence,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  onIdTokenChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "@firebase/auth";

/** `providers` lists how the account signs in: "password", "google.com" and/or "apple.com". */
export type AppUser = { uid: string; email: string | null; providers: string[] };

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
const TEST_USER: AppUser = { uid: "test-mode", email: null, providers: [] };
let test_user: AppUser | null = null;
const test_listeners = new Set<(user: AppUser | null) => void>();
function set_test_user(next: AppUser | null) {
  test_user = next;
  for (const listener of test_listeners) listener(next);
}

// The native Google and Apple modules aren't in Expo Go, so they load only when used; a build without them explains itself.
function load_google_module() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-google-signin/google-signin") as typeof import("@react-native-google-signin/google-signin");
  } catch {
    return null;
  }
}
function load_apple_module() {
  if (Platform.OS !== "ios") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-apple-authentication") as typeof import("expo-apple-authentication");
  } catch {
    return null;
  }
}

const google = create_google_sign_in({
  load: load_google_module,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  platform: Platform.OS,
  dev: typeof __DEV__ !== "undefined" && __DEV__,
  exchange: async (idToken) => {
    await signInWithCredential(auth(), GoogleAuthProvider.credential(idToken));
  },
});

/** Opens Apple's sheet and returns a Firebase credential. Firebase checks Apple signed the hash of this nonce. */
async function apple_credential() {
  const apple = load_apple_module();
  if (!apple || !(await apple.isAvailableAsync().catch(() => false))) throw new Error("Sign in with Apple isn't available on this device.");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Crypto = require("expo-crypto") as typeof import("expo-crypto");
  const raw_nonce = Crypto.randomUUID();
  const hashed_nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw_nonce);
  let result: Awaited<ReturnType<typeof apple.signInAsync>>;
  try {
    result = await apple.signInAsync({
      requestedScopes: [apple.AppleAuthenticationScope.FULL_NAME, apple.AppleAuthenticationScope.EMAIL],
      nonce: hashed_nonce,
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "ERR_REQUEST_CANCELED") throw new SignInCancelled();
    throw error;
  }
  if (!result.identityToken) throw new Error("Apple didn't return a sign-in token. Please try again.");
  return new OAuthProvider("apple.com").credential({ idToken: result.identityToken, rawNonce: raw_nonce });
}

export const firebase = {
  /** Whether this build can offer Continue with Google (the button explains itself if the native part is missing). */
  google_available: firebaseConfigured && google.available,
  async apple_available(): Promise<boolean> {
    if (!firebaseConfigured) return false;
    const apple = load_apple_module();
    return apple ? apple.isAvailableAsync().catch(() => false) : false;
  },
  async sign_in_with_google() {
    await google.sign_in();
  },
  async sign_in_with_apple() {
    await signInWithCredential(auth(), await apple_credential());
  },
  subscribe(listener: (user: AppUser | null) => void): () => void {
    if (!firebaseConfigured) {
      test_listeners.add(listener);
      listener(test_user);
      return () => test_listeners.delete(listener);
    }
    return onIdTokenChanged(auth(), (user) =>
      listener(user ? { uid: user.uid, email: user.email, providers: user.providerData.map((item) => item.providerId) } : null),
    );
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
    await google.sign_out();
  },
  /** Checks the password again, and refreshes the sign-in so the server sees it as recent. */
  async confirm_password(password: string) {
    if (!firebaseConfigured) return;
    const user = auth().currentUser;
    if (!user?.email) throw new Error("Sign in again to delete your account.");
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    await user.getIdToken(true);
  },
  /** Confirms a Google or Apple account again (it must be the same account), so the server sees a recent sign-in. */
  async confirm_with_provider(method: "google" | "apple") {
    if (!firebaseConfigured) return;
    const user = auth().currentUser;
    if (!user) throw new Error("Sign in again to delete your account.");
    if (method === "google")
      await google.sign_in(async (idToken) => {
        await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken));
      });
    else await reauthenticateWithCredential(user, await apple_credential());
    await user.getIdToken(true);
  },
  /** Removes the sign-in itself. Run it after the server data is gone. */
  async delete_sign_in() {
    if (!firebaseConfigured) return set_test_user(null);
    const user = auth().currentUser;
    if (!user) throw new Error("Sign in again to delete your account.");
    await deleteUser(user);
    await google.sign_out();
  },
  async id_token(expected_uid?: string): Promise<string | null> {
    if (!firebaseConfigured) return null;
    const user = auth().currentUser;
    return account_token(user ? { uid: user.uid, get_token: () => user.getIdToken() } : null, expected_uid);
  },
};

export { sign_in_problem } from "./signInProblem";
