const { withAppBuildGradle } = require("@expo/config-plugins");
const GUARD = `
// Recipeak release signing: public debug keys are allowed only in explicitly marked local preview builds, or in the
// CI verification build (compiled, linted and smoke-tested on an emulator; never uploaded to Play). Never production.
def recipeakProfile = System.getenv('EAS_BUILD_PROFILE')
def recipeakDebugOptIn = System.getenv('RECIPEAK_LOCAL_DEBUG_SIGNING') == '1'
def recipeakLocalDebug = recipeakDebugOptIn && recipeakProfile != 'production' &&
    (recipeakProfile == 'preview' || System.getenv('RECIPEAK_CI_VERIFY_BUILD') == '1')
def recipeakSigningNames = ['RECIPEAK_UPLOAD_STORE_FILE', 'RECIPEAK_UPLOAD_STORE_PASSWORD', 'RECIPEAK_UPLOAD_KEY_ALIAS', 'RECIPEAK_UPLOAD_KEY_PASSWORD']
def recipeakHasUploadSigning = recipeakSigningNames.every { System.getenv(it)?.trim() }
// Inspect the resolved graph, so aggregate tasks such as 'build', 'assemble' and 'bundle' cannot bypass this.
gradle.taskGraph.whenReady { graph ->
    if (!recipeakLocalDebug && !recipeakHasUploadSigning && graph.allTasks.any { it.name.toLowerCase().contains('release') }) {
        throw new GradleException('Private upload signing is required for Play release builds. Configure RECIPEAK_UPLOAD_* secrets; local preview builds may explicitly opt into debug signing.')
    }
}
if (!recipeakLocalDebug && recipeakHasUploadSigning) {
    def uploadFile = file(System.getenv('RECIPEAK_UPLOAD_STORE_FILE'))
    def uploadAlias = System.getenv('RECIPEAK_UPLOAD_KEY_ALIAS')
    if (!uploadFile.isFile() || uploadAlias.toLowerCase() == 'androiddebugkey') {
        throw new GradleException('A private upload keystore and non-debug alias are required.')
    }
    def uploadStore = java.security.KeyStore.getInstance(uploadFile, System.getenv('RECIPEAK_UPLOAD_STORE_PASSWORD').toCharArray())
    def uploadCert = uploadStore.getCertificate(uploadAlias)
    if (uploadCert == null || !uploadStore.isKeyEntry(uploadAlias)) throw new GradleException('Upload signing alias is invalid.')
    def debugFile = file('debug.keystore')
    if (debugFile.isFile()) {
        def debugStore = java.security.KeyStore.getInstance(debugFile, 'android'.toCharArray())
        if (uploadCert == debugStore.getCertificate('androiddebugkey')) throw new GradleException('Public React Native debug signing is forbidden for Play builds.')
    }
    android.signingConfigs.create('recipeakUpload') {
        storeFile uploadFile
        storePassword System.getenv('RECIPEAK_UPLOAD_STORE_PASSWORD')
        keyAlias uploadAlias
        keyPassword System.getenv('RECIPEAK_UPLOAD_KEY_PASSWORD')
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.recipeakUpload
}
`;
module.exports = (config) =>
  withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes("// Recipeak release signing:")) config.modResults.contents += GUARD;
    return config;
  });
module.exports.GUARD = GUARD;
