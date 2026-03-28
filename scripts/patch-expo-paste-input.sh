#!/usr/bin/env bash
# patch-expo-paste-input.sh
# Fixes packages that reference ExpoModulesCorePlugin.gradle which was removed in SDK 55.
# Rewrites build.gradle to use the modern expo-module-gradle-plugin pattern.

set -euo pipefail

# ── expo-paste-input ──
PI="node_modules/expo-paste-input/android/build.gradle"
if [ -f "$PI" ] && ! grep -q "expo-module-gradle-plugin" "$PI" 2>/dev/null; then
  cat > "$PI" << 'GRADLE'
plugins {
  id 'com.android.library'
  id 'expo-module-gradle-plugin'
}

group = 'expo.modules.pasteinput'
version = '0.7.6'

android {
  namespace "expo.modules.pasteinput"
  defaultConfig {
    versionCode 1
    versionName "0.7.6"
  }
  lintOptions {
    abortOnError false
  }
}
GRADLE
  echo "[patch-expo-paste-input] Patched expo-paste-input for SDK 55"
else
  echo "[patch-expo-paste-input] expo-paste-input already patched or not found, skipping"
fi

# ── expo-share-intent ──
SI="node_modules/expo-share-intent/android/build.gradle"
if [ -f "$SI" ] && ! grep -q "expo-module-gradle-plugin" "$SI" 2>/dev/null; then
  cat > "$SI" << 'GRADLE'
plugins {
  id 'com.android.library'
  id 'expo-module-gradle-plugin'
}

group = 'expo.modules.shareintent'
version = '5.0.0'

android {
  namespace "expo.modules.shareintent"
  defaultConfig {
    versionCode 1
    versionName "5.0.0"
  }
  lintOptions {
    abortOnError false
  }
}
GRADLE
  echo "[patch-expo-paste-input] Patched expo-share-intent for SDK 55"
else
  echo "[patch-expo-paste-input] expo-share-intent already patched or not found, skipping"
fi
