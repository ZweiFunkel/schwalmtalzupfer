const { withAppBuildGradle } = require('expo/config-plugins');

// Injects a "release" signingConfig that reads its keystore/passwords from environment
// variables at Gradle-build time (MYAPP_UPLOAD_STORE_FILE/_STORE_PASSWORD/_KEY_ALIAS/_KEY_PASSWORD).
// Without those env vars set, the release build falls back to the debug keystore exactly
// like the stock Expo template — so local builds without a release keystore keep working.
// This survives `expo prebuild --clean` because android/ is regenerated from this plugin
// every time (android/ itself is gitignored).

const SIGNING_CONFIG_BLOCK = `        release {
            if (System.getenv('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(System.getenv('MYAPP_UPLOAD_STORE_FILE'))
                storePassword System.getenv('MYAPP_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('MYAPP_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('MYAPP_UPLOAD_KEY_PASSWORD')
            }
        }
`;

const OLD_RELEASE_SIGNING = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

const NEW_RELEASE_SIGNING = `            // Release-Keystore kommt aus ENV (siehe .github/workflows/build-android.yml);
            // ohne gesetzte ENV-Variablen wird wie im Expo-Standard mit dem Debug-Key signiert.
            signingConfig System.getenv('MYAPP_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`;

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, config => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('withAndroidReleaseSigning erwartet ein Groovy build.gradle');
    }

    let contents = config.modResults.contents;

    if (!contents.includes('MYAPP_UPLOAD_STORE_FILE')) {
      if (!/signingConfigs\s*\{\n/.test(contents)) {
        throw new Error('withAndroidReleaseSigning: signingConfigs-Block nicht gefunden');
      }
      contents = contents.replace(/signingConfigs\s*\{\n/, match => `${match}${SIGNING_CONFIG_BLOCK}`);

      if (!contents.includes(OLD_RELEASE_SIGNING)) {
        throw new Error('withAndroidReleaseSigning: erwartete release-signingConfig-Zeile nicht gefunden');
      }
      contents = contents.replace(OLD_RELEASE_SIGNING, NEW_RELEASE_SIGNING);
    }

    config.modResults.contents = contents;
    return config;
  });
};
