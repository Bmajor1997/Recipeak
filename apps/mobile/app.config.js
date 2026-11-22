/**
 * Build-time additions to app.json, set up the same way as Votic:
 * - Google Play (production) builds stop early if a setting the real app needs is missing (security/check-mobile-release.cjs).
 * - Release builds must be signed with Recipeak's private upload key (plugins/withUploadSigning.js).
 * - Native Google Sign-In for iPhone is added when its URL scheme is provided (the reversed iOS client ID from Google Cloud,
 *   e.g. com.googleusercontent.apps.123-abc). Android needs no plugin. Without it, builds still work.
 */
module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE === "production")
    require("../../security/check-mobile-release.cjs").validate_release_environment(process.env);
  const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;
  return {
    ...config,
    extra: {
      ...config.extra,
      ...(process.env.EAS_PROJECT_ID ? { eas: { ...config.extra?.eas, projectId: process.env.EAS_PROJECT_ID } } : {}),
    },
    plugins: [
      // Mods execute in reverse registration order; repair the completed splash styles last.
      "./plugins/withAndroidCompatibility",
      ...(config.plugins ?? []),
      "./plugins/withUploadSigning",
      "./plugins/withPreviewCleartext",
      ...(iosUrlScheme ? [["@react-native-google-signin/google-signin", { iosUrlScheme }]] : []),
    ],
  };
};
