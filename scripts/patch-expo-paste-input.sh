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

# ── voltra ──
VL="node_modules/voltra/android/build.gradle"
if [ -f "$VL" ] && ! grep -q "expo-module-gradle-plugin" "$VL" 2>/dev/null; then
  cat > "$VL" << 'GRADLE'
buildscript {
  repositories {
    google()
    mavenCentral()
  }
  dependencies {
    classpath "org.jetbrains.kotlin:compose-compiler-gradle-plugin:2.0.0"
    classpath "org.jetbrains.kotlin:kotlin-serialization:2.0.21"
  }
}

plugins {
  id 'com.android.library'
  id 'expo-module-gradle-plugin'
}

apply plugin: 'org.jetbrains.kotlin.plugin.compose'
apply plugin: 'org.jetbrains.kotlin.plugin.serialization'

group = 'voltra'
version = '0.1.0'

android {
  namespace "voltra"
  defaultConfig {
    versionCode 1
    versionName "0.1.0"
  }
  lintOptions {
    abortOnError false
  }
  buildFeatures {
    compose true
  }
}

dependencies {
  api "androidx.glance:glance:1.2.0-rc01"
  api "androidx.glance:glance-appwidget:1.2.0-rc01"
  api "androidx.compose.runtime:runtime:1.6.8"
  implementation "com.google.code.gson:gson:2.10.1"
  implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1"
  implementation "org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3"
}
GRADLE
  echo "[patch-expo-paste-input] Patched voltra for SDK 55"
else
  echo "[patch-expo-paste-input] voltra already patched or not found, skipping"
fi
