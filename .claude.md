# DEVIANT - AI Assistant Instructions

> **⚠️ READ THIS FILE FIRST** - Before making ANY changes to this project, read this entire file.

---

## 🚫 Protected Files - DO NOT EDIT

The following files should **NEVER** be modified unless explicitly requested by the user:

- `metro.config.js`
- `babel.config.js`

### Current babel.config.js

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", {jsxImportSource: "nativewind", unstable_transformImportMeta: true }]],
    plugins: ["react-native-worklets/plugin"],
  };
};
```

### Current metro.config.js

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("riv");

module.exports = withRorkMetro(withNativeWind(config, { input: "./global.css" }));
```

## 🚫 Protected Dependencies - DO NOT REMOVE

The following dependencies must **NEVER** be removed from package.json:

- `nativewind`
- `@react-native-ml-kit/text-recognition` (used for ID OCR scanning)

---

## 📱 Project Context

This is a **React Native/Expo** project using:

- **NativeWind v4** for styling (Tailwind CSS)
- **Expo Router** for navigation
- **Rive** for animations (.riv files)
- **React Native Reanimated** for animations
- **Zustand** for state management (**DO NOT use useState hooks, use Zustand stores**)

---

## 🔧 Known Platform Fixes

### Android - react-native-vision-camera-text-recognition

Kotlin type mismatch error. Edit `VisionCameraTextRecognitionPlugin.kt` lines 54/58:

```kotlin
@Suppress("UNCHECKED_CAST")
return WritableNativeMap().toHashMap() as HashMap<String, Any>?

@Suppress("UNCHECKED_CAST")
return data.toHashMap() as HashMap<String, Any>?
```

### Android - Regula Face SDK

Add Maven repo to `android/build.gradle` in `allprojects.repositories`:

```gradle
maven { url 'https://maven.regulaforensics.com/RegulaDocumentReader' }
```

### iOS - GoogleMLKit Version Conflict

Conflict between `@react-native-ml-kit/text-recognition` (GoogleMLKit 8.0.0) and `vision-camera-face-detection` (GoogleMLKit 7.0.0).

Fix in `ios/Podfile`:

```ruby
$GoogleMLKitVersion = '7.0.0'
pod 'GoogleMLKit/MLKitCore', $GoogleMLKitVersion, :modular_headers => true
pod 'GoogleMLKit/TextRecognition', :modular_headers => true
pod 'GoogleMLKit/FaceDetection', $GoogleMLKitVersion, :modular_headers => true
```

Then run: `cd ios && pod install --repo-update`

### Native Rebuild Commands

After adding packages with native code:

```bash
# Android
npx expo run:android

# iOS (after fixing pod conflicts)
npx expo run:ios
```

---

## 📝 Code Style

- Use **TypeScript**
- Follow existing code patterns
- Do not add or remove comments unless asked
- Preserve existing formatting
- Use Zustand stores instead of useState hooks

---

## 📂 Key Directories

- `app/` - Expo Router screens and layouts
- `components/` - Reusable UI components
- `lib/` - Utilities, hooks, stores, and services
- `backend/` - Backend/API related code
- `assets/` - Static assets (images, fonts, etc.)
- `theme/` - Theme configuration
