const { withAndroidManifest, withAndroidStyles, XML } = require("expo/config-plugins");
const { mkdir } = require("node:fs/promises");
const path = require("node:path");

module.exports = (config) => {
  config = withAndroidManifest(config, (config) => {
    // Photos can also be selected from the library, so camera hardware is optional.
    const manifest = config.modResults.manifest;
    const features = (manifest["uses-feature"] ??= []);
    for (const name of ["android.hardware.camera", "android.hardware.camera.autofocus"]) {
      let feature = features.find((item) => item.$?.["android:name"] === name);
      if (!feature) features.push((feature = { $: { "android:name": name } }));
      feature.$["android:required"] = "false";
    }
    return config;
  });
  return withAndroidStyles(config, async (config) => {
    // SDK 58 emits this API 33 attribute in the unqualified splash theme.
    // Preserve the complete theme on Android 13+, without exposing it to older devices.
    const styles = config.modResults.resources.style ?? [];
    const splash = styles.find((style) => style.$.name === "Theme.App.SplashScreen");
    const attribute = "android:windowSplashScreenBehavior";
    if (splash?.item?.some((item) => item.$.name === attribute)) {
      const versioned = structuredClone(splash);
      splash.item = splash.item.filter((item) => item.$.name !== attribute);
      const directory = path.join(config.modRequest.platformProjectRoot, "app/src/main/res/values-v33");
      await mkdir(directory, { recursive: true });
      await XML.writeXMLAsync({
        path: path.join(directory, "recipeak-splash.xml"),
        xml: { resources: { style: [versioned] } },
      });
    }
    return config;
  });
};
