const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * The test APK (EAS_BUILD_PROFILE=preview) may talk to the recipe server on this computer over plain http
 * (http://10.0.2.2:8787 from the Android emulator). Android blocks plain http in release builds, so only that
 * test build allows it. Google Play (production) builds never do.
 */
module.exports = (config) =>
  withAndroidManifest(config, (config) => {
    const url = process.env.EXPO_PUBLIC_API_BASE_URL || "";
    if (process.env.EAS_BUILD_PROFILE === "preview" && url.startsWith("http://")) {
      const application = config.modResults.manifest.application?.[0];
      if (application) application.$["android:usesCleartextTraffic"] = "true";
    }
    return config;
  });
