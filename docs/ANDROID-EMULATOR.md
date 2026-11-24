# Recipeak Android emulator development

Use one development build and the Expo development server for everyday work. A development build contains Recipeak's native modules; it is different from the standalone test APK and Expo Go. The GitHub-hosted development APK has built successfully; installation, device connection, and automatic refresh still need verification on the Windows emulator.

## First-time setup on Windows

1. Open the Recipeak repository in a terminal on the same computer as Android Studio. Check `git status` before switching branches or updating code, and preserve any uncommitted work. Confirm the intended branch and commit with the person testing; `main` and the open pull request branches can contain different changes.
2. Start the Android emulator. Run `adb devices -l` and confirm the emulator is listed as `device`.
3. In `apps/mobile`, run `npm.cmd ci` in PowerShell. Create `apps/mobile/.env` from `.env.example` only if it does not exist, and fill in the existing project configuration without putting secret server keys in the app. The example `10.0.2.2:8787` connects the emulator to a backend running on the same Windows computer; it is not the hosted server. Google sign-in also needs the matching Web client ID and signing fingerprint; see `docs/GOOGLE-SIGN-IN.md`.
4. Build the emulator development APK with the `Android emulator development build` GitHub Actions workflow on the intended PR, then download and unzip its `recipeak-emulator-development-apk-NOT-FOR-PLAY` artifact. Drag the APK onto the emulator. This is a debug build for x86_64 emulators, not for Play. The workflow runs for relevant native dependency/configuration changes in the PR; manual dispatch requires the workflow to be present on the default branch. An artifact expires after seven days. If installation reports a signing conflict, preserve existing app data and investigate before uninstalling.
5. Confirm the app opens and can connect to the intended backend. Note the branch and commit tested with `git branch --show-current` and `git rev-parse --short HEAD`. Do not assume an installed APK contains later unmerged work.

## Everyday use

1. Open the intended repository and branch, and confirm the emulator is running.
2. In `apps/mobile`, run `npx.cmd expo start --dev-client`. Open the installed Recipeak development build and connect it to that server. Keep the terminal open.
3. JavaScript, TypeScript and React UI edits normally refresh automatically through Fast Refresh while the development server is connected. GitHub changes do not automatically arrive on your computer: update your local checkout safely first, preserving local changes. Restart or reload the app if a change needs a fresh app state.
4. Build and reinstall a new development APK after changing native dependencies, native configuration or the Expo SDK. If environment values change, restart Metro and fully reload; native/build-time configuration may also require a rebuild. The GitHub workflow rebuilds on relevant native configuration and dependency changes in the pull request.

This does not deploy, publish, or update a Google Play build. A debug development build can be signed differently from a Play or test APK, affecting sign-in configuration. Installing a differently signed build over an existing app with the same package ID may fail; do not uninstall an existing copy without first checking whether its local data needs to be preserved.
