/**
 * Expo Config Plugin: Android Build Fixes
 *
 * Automatically applies on every `expo prebuild`:
 * 1. Adds Regula Face SDK Maven repository
 * 2. Adds tools:replace="android:allowBackup" to fix manifest merger conflict
 */

const {
  withProjectBuildGradle,
  withAndroidManifest,
} = require("expo/config-plugins");

/** Add Regula Maven repo to allprojects.repositories in build.gradle */
function withRegulaMaven(config) {
  return withProjectBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    if (!contents.includes("maven.regulaforensics.com")) {
      config.modResults.contents = contents.replace(
        "maven { url 'https://www.jitpack.io' }",
        "maven { url 'https://www.jitpack.io' }\n    maven { url 'https://maven.regulaforensics.com/RegulaDocumentReader' }"
      );
    }

    return config;
  });
}

/** Add tools:replace="android:allowBackup" to <application> */
function withAllowBackupFix(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication =
      config.modResults.manifest.application?.[0];

    if (mainApplication) {
      // Ensure tools namespace is declared
      if (!config.modResults.manifest.$["xmlns:tools"]) {
        config.modResults.manifest.$["xmlns:tools"] =
          "http://schemas.android.com/tools";
      }

      // Add tools:replace for allowBackup
      if (!mainApplication.$["tools:replace"]) {
        mainApplication.$["tools:replace"] = "android:allowBackup";
      } else if (
        !mainApplication.$["tools:replace"].includes("android:allowBackup")
      ) {
        mainApplication.$["tools:replace"] +=
          ",android:allowBackup";
      }
    }

    return config;
  });
}

/** Combined plugin */
function withAndroidFixes(config) {
  config = withRegulaMaven(config);
  config = withAllowBackupFix(config);
  return config;
}

module.exports = withAndroidFixes;
