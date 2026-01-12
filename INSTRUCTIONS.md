# AI Assistant Instructions

## Protected Files - DO NOT EDIT

The following files should NEVER be modified unless explicitly requested by the user:

- `metro.config.js`
- `babel.config.js`

## Protected Dependencies - DO NOT REMOVE

The following dependencies must NEVER be removed from package.json:

- `nativewind`

## Project Context

This is a React Native/Expo project using:

- NativeWind v4 for styling (Tailwind CSS)
- Expo Router for navigation
- Rive for animations (.riv files)
- React Native Reanimated for animations
- Don't use useState hooks, use zustand for state management

## Known Package Fixes

### react-native-vision-camera-text-recognition (Android)

This package has a Kotlin type mismatch error on Android. Fix by editing:

```bash
node_modules/.pnpm/react-native-vision-camera-text-recognition@*/node_modules/react-native-vision-camera-text-recognition/android/src/main/java/com/visioncameratextrecognition/VisionCameraTextRecognitionPlugin.kt
```

Change lines 54 and 58 from:

```kotlin
return WritableNativeMap().toHashMap()
return data.toHashMap()
```

To:

```kotlin
@Suppress("UNCHECKED_CAST")
return WritableNativeMap().toHashMap() as HashMap<String, Any>?

@Suppress("UNCHECKED_CAST")
return data.toHashMap() as HashMap<String, Any>?
```

### GoogleMLKit Version Conflict (iOS)

There's a CocoaPods conflict between `@react-native-ml-kit/text-recognition` (requires GoogleMLKit 8.0.0) and `vision-camera-face-detection` (requires GoogleMLKit 7.0.0).

**Option 1:** Remove one of the conflicting packages if not needed.

**Option 2:** Use version overrides in `ios/Podfile`:

```ruby
# Add at the top of the Podfile, after `platform :ios`
$GoogleMLKitVersion = '7.0.0'

# In the target block, add:
pod 'GoogleMLKit/MLKitCore', $GoogleMLKitVersion, :modular_headers => true
pod 'GoogleMLKit/TextRecognition', :modular_headers => true
pod 'GoogleMLKit/FaceDetection', $GoogleMLKitVersion, :modular_headers => true
```

**Option 3:** Downgrade `@react-native-ml-kit/text-recognition` to a version compatible with GoogleMLKit 7.0.0.

Then run:

```bash
cd ios && pod install --repo-update
```

### Regula Face SDK (Android)

The Regula Face SDK requires its Maven repository. Add to `android/build.gradle` in `allprojects.repositories`:

```gradle
maven { url 'https://maven.regulaforensics.com/RegulaDocumentReader' }
```

### Native Dependencies Rebuild

After adding packages with native code, rebuild the app:

```bash
# Android
npx expo run:android

# iOS (after fixing pod conflicts)
npx expo run:ios
```

## Code Style

- Use TypeScript
- Follow existing code patterns
- Do not add or remove comments unless asked
- Preserve existing formatting
