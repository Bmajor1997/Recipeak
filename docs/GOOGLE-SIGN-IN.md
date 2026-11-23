# Continue with Google: setup per build

"Google sign-in isn't available in this version of Recipeak" means the build was made **without a Web client ID**
(`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`). That's what happened to the test APKs built on 2026-11-23: the repository's
Actions variables held the four Firebase settings but no `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

Nothing here is a secret. The Web client ID and SHA fingerprints are public identifiers that ship inside, or can be
read from, every app. Keep the OpenAI and RevenueCat **secret** keys and the upload keystore out of variables. They
belong in secrets or on the server only.

## 1. The Web client ID (all Android builds)

1. Firebase console → project Recipeak → **Authentication → Sign-in method → Google**. Turn it on if it's off.
2. Open **Web SDK configuration** and copy the **Web client ID** (it ends in `.apps.googleusercontent.com`). Use the
   *Web* one, not an Android client ID.
3. GitHub → Bmajor1997/Recipeak → **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   name `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, value the Web client ID.
4. For local development builds, put the same line in `apps/mobile/.env` (ignored by Git).

## 2. The signing fingerprints (one per signing key)

Google only gives a token to an app whose package (`com.mealsandmixers.app`) **and** signing certificate are registered
on the Firebase Android app. Each kind of build is signed differently, so each needs its own SHA-1 (add the SHA-256
too):

| Build | Signed with | SHA-1 to add | Where it comes from |
| --- | --- | --- | --- |
| Test APK (Actions → "Test APK…", `preview`) | React Native's public debug key (`RECIPEAK_LOCAL_DEBUG_SIGNING=1`) | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` | Read from the 2026-11-23 test APK with `apksigner verify --print-certs`. The workflow prints it on every run under "Print signing fingerprint". |
| Local `npx expo run:android` | The debug keystore in the generated `android/app` | Usually the same debug SHA-1. Check with `cd apps/mobile/android && ./gradlew signingReport`. | Your computer |
| Google Play (Actions → "Google Play App Bundle", `production`) | Your private **upload key**. Play re-signs with its **app signing key**. | **Both**: the upload key's SHA-1, and the app signing key's SHA-1 | Play Console → Recipeak → **Test and release → App integrity → App signing**. The upload key's SHA-1 is also printed by the AAB workflow ("SHA1"). |

The preview and production fingerprints are different, so registering one doesn't make the other work. Builds from
Google Play (internal testing included) are signed with Play's app signing key, not the upload key.

Add each one in Firebase console → **Project settings → Your apps → Android app `com.mealsandmixers.app` → Add
fingerprint**. After adding fingerprints, download nothing. The app uses the Web client ID, not `google-services.json`.

## 3. Check it

1. Run Actions → "Test APK for the emulator or a phone (not for Play)". The "Say which settings are missing" step
   must not warn about `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
2. Install the APK on an emulator image **with Google Play** (or a phone) and tap **Continue with Google**.
   - Account picker, then Home: working.
   - "isn't available in this version": the variable still isn't reaching the build. Re-check step 1.3 and rebuild.
   - "isn't set up correctly for this version" (Google's `DEVELOPER_ERROR`): the fingerprint of *that* build is
     missing from the Firebase Android app, or the Web client ID belongs to another Firebase project.
   - "couldn't confirm your Google account": Firebase rejected the token. Google isn't enabled under
     Authentication → Sign-in method, or the client ID is from another project.
3. Repeat with a Play internal-testing build after adding the Play fingerprints.

Google sign-in isn't verified until step 2 succeeds on a correctly configured build.
