# Recipeak Android emulator development

Use one development build and the Expo development server for everyday work. A development build contains Recipeak's native modules; it is different from the standalone test APK and Expo Go. This workflow is prepared for the PR #103 app branch and still needs its first verification on the Windows emulator.

## First-time setup on Windows

1. Open the Recipeak repository in a terminal on the same computer as Android Studio. Check `git status` before switching branches or updating code, and preserve any uncommitted work. Confirm the intended branch and commit with the person testing; `main` and the open pull request branches can contain different changes.
2. Start the Android emulator. Run `adb devices -l` and confirm the emulator is listed as `device`.
3. In `apps/mobile`, run `npm ci`. Create `apps/mobile/.env` from `.env.example` only if it does not exist, and fill in the existing project configuration without putting secret server keys in the app. The example `10.0.2.2:8787` connects the emulator to a backend running on the same Windows computer; it is not the hosted server. Google sign-in also needs the matching Web client ID and signing fingerprint; see `docs/GOOGLE-SIGN-IN.md`.
4. In `apps/mobile`, run `npx expo run:android`. This builds and installs the debug development app on the running emulator and starts the development server. The computer needs Android Studio, its SDK, Java and Node as required by the project. Leave the terminal open.
5. Confirm the app opens and can connect to the intended backend. Note the branch and commit tested with `git branch --show-current` and `git rev-parse --short HEAD`. Do not assume an installed APK contains later unmerged work.

## Everyday use

1. Open the intended repository and branch, and confirm the emulator is running.
2. In `apps/mobile`, run `npx expo start --dev-client`. Open the installed Recipeak development build and connect it to that server. Keep the terminal open.
3. JavaScript, TypeScript and React UI edits normally refresh automatically through Fast Refresh while the development server is connected. GitHub changes do not automatically arrive on your computer: update your local checkout safely first, preserving local changes. Restart or reload the app if a change needs a fresh app state.
4. Rebuild and reinstall with `npx expo run:android` after changing native dependencies, native configuration or the Expo SDK. If environment values change, restart Metro and fully reload; native/build-time configuration may also require a rebuild.

This does not deploy, publish, or update a Google Play build. A debug development build can be signed differently from a Play or test APK, affecting sign-in configuration. Installing a differently signed build over an existing app with the same package ID may fail; do not uninstall an existing copy without first checking whether its local data needs to be preserved.
