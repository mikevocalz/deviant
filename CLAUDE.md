# DEVIANT - AI Assistant Instructions

> **⚠️ READ THIS FILE FIRST** - Before making ANY changes to this project, read this entire file.

## 📍 CMS Location

The Payload CMS project lives in a **separate folder**:
```
/Users/mikevocalz/Downloads/payload-cms-setup
```

When making changes to CMS collections, they must be synced to that folder and the CMS must be redeployed separately.

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
    presets: [
      [
        "babel-preset-expo",
        { jsxImportSource: "nativewind", unstable_transformImportMeta: true },
      ],
    ],
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

module.exports = withRorkMetro(
  withNativeWind(config, { input: "./global.css" }),
);
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

**Problem:** `@react-native-ml-kit/text-recognition` and `vision-camera-face-detection` require incompatible GoogleMLKit versions. The text-recognition package hardcodes specific GoogleMLKit versions in its podspec that conflict with face-detection.

**Solution:** Remove `@react-native-ml-kit/text-recognition` and `react-native-vision-camera-text-recognition` packages, keep only FaceDetection in Podfile:

```bash
# Remove conflicting packages
pnpm remove @react-native-ml-kit/text-recognition react-native-vision-camera-text-recognition
```

In `ios/Podfile`, use only FaceDetection:

```ruby
$GoogleMLKitVersion = '7.0.0'

target 'DVNT' do
  pod 'GoogleMLKit/FaceDetection', $GoogleMLKitVersion, :modular_headers => true
  # ... rest of target
end
```

Then run:

```bash
cd ios && pod install --repo-update
```

**Note:** If text recognition is needed later, find a version of `@react-native-ml-kit/text-recognition` compatible with GoogleMLKit 7.0.0, or use a different OCR solution.

### Android - TextRecognition Import Error

**Error:** `Unable to resolve "@react-native-ml-kit/text-recognition"` when building Android after removing the package.

**Cause:** The `IdScanTab.tsx` component imports TextRecognition which was removed due to GoogleMLKit conflicts.

**Fix:** The import in `components/verification/tabs/IdScanTab.tsx` has been commented out:

```tsx
// TextRecognition removed due to GoogleMLKit version conflict - see CLAUDE.md
// TODO: Re-add OCR when compatible version is available
```

**Prevention:** When removing any native package, ALWAYS search the codebase for imports:

```bash
grep -r "package-name" --include="*.tsx" --include="*.ts" .
```

### Android - Metro Bundler Cache Issues

**Error:** Changes not reflected after editing files, old errors persist.

**Fix:** Kill Metro and restart with clear cache:

```bash
lsof -ti:8081 | xargs kill -9
npx expo start --clear --android
```

### Native Rebuild Commands

After adding packages with native code:

```bash
# Android
npx expo run:android

# iOS (after fixing pod conflicts)
npx expo run:ios
```

### Android - Notification Icon Required

**Error:** `ENOENT: no such file or directory, open './assets/images/notification-icon.png'`

**Cause:** `expo-notifications` plugin requires a notification icon for Android.

**Fix:** Ensure `assets/images/notification-icon.png` exists. For Android, this should ideally be a white silhouette on transparent background (96x96px). As a quick fix, copy the app icon:

```bash
cp assets/images/icon.png assets/images/notification-icon.png
```

### ⚠️ Pre-Build Checklist

Before running native builds, verify:

1. **Check for removed package imports** - Search codebase for any imports of removed packages
2. **Read CLAUDE.md** - Always read this file for known fixes before building
3. **Clear Metro cache** - If builds fail unexpectedly, clear the cache
4. **Check Podfile/build.gradle** - Ensure native config matches package requirements
5. **Notification icon exists** - `assets/images/notification-icon.png` must exist for Android builds

---

## 🚨 CRITICAL: Update Toast Functionality

**⚠️ NEVER REMOVE OR DISABLE THE UPDATE TOAST**

The update toast in `lib/hooks/use-updates.ts` is **CRITICAL** for OTA (Over-The-Air) updates. This toast **MUST ALWAYS** show when an update is available.

**Rules:**
1. **NEVER** remove the `showUpdateToast()` function
2. **NEVER** disable or skip the toast notification
3. **NEVER** remove the toast import or usage
4. **ALWAYS** ensure the toast shows with retry logic and Alert fallback
5. The toast **MUST** have `duration: Infinity` to never auto-dismiss
6. The toast **MUST** have TWO buttons:
   - **"Update Later"** (left/cancel button) - dismisses the toast
   - **"Restart App Now"** (right/action button) - restarts the app
7. If toast fails, **MUST** fall back to native Alert with same two buttons
8. **NEVER remove or disable this toast** - it is critical for OTA updates
9. The toast can be dismissed with "Update Later" but will show again if update is still pending

**Why this is critical:**
- Users need to know when updates are available
- Without the toast, users won't restart to get new features/fixes
- OTA updates are essential for the app's update mechanism
- The toast MUST always be visible when an update is available

**Location:** `lib/hooks/use-updates.ts` - `showUpdateToast()` function

**⚠️ CRITICAL: This toast must NEVER be removed, disabled, or modified to prevent showing. It is essential for the app's update mechanism.**

---

## 📝 Code Style

- Use **TypeScript**
- Follow existing code patterns
- Do not add or remove comments unless asked
- Preserve existing formatting
- Use Zustand stores instead of useState hooks
- **ALWAYS use sonner-native toasts instead of Alert** - Use `useUIStore.showToast()` for all user feedback:

  ```tsx
  import { useUIStore } from "@/lib/stores/ui-store";

  const showToast = useUIStore((s) => s.showToast);

  // Instead of: Alert.alert("Error", "Something went wrong")
  showToast("error", "Error", "Something went wrong");

  // Types: "success" | "error" | "warning" | "info"
  showToast("success", "Done", "Post created successfully");
  ```

---

## 📂 Key Directories

- `app/` - Expo Router screens and layouts
- `components/` - Reusable UI components
- `lib/` - Utilities, hooks, stores, and services
- `backend/` - Backend/API related code
- `assets/` - Static assets (images, fonts, etc.)
- `theme/` - Theme configuration

---

## 🎬 Screen Transitions & Animations

- Use **@legendapp/motion** (`Motion.View`) for animations instead of `react-native-reanimated` `Animated.View`
- For smooth modal transitions, use Expo Router's modal presentation:

  ```tsx
  // In _layout.tsx
  <Stack screenOptions={{ presentation: "modal" }} />
  ```

- Enable shared element transitions for seamless navigation between screens
- Use spring animations with `type: "spring", damping: 20, stiffness: 300` for natural motion
- Avoid `LayoutAnimation` as it's deprecated in the New Architecture

---

## 📍 Location Autocomplete & Maps

### Google Places Autocomplete

Use the `LocationAutocomplete` component for location search inputs:

```tsx
import {
  LocationAutocomplete,
  type LocationData,
} from "@/components/ui/location-autocomplete";

// In your component
<LocationAutocomplete
  value={location}
  placeholder="Search location..."
  onLocationSelect={(data: LocationData) => {
    // data contains: name, latitude, longitude, placeId
    setLocationData(data);
  }}
  onClear={() => setLocationData(null)}
/>;
```

**Requirements:**

- Set `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` environment variable
- Package: `react-native-google-places-autocomplete` (already installed)

### Expo Maps (Event Location Preview)

For displaying maps with location markers (events screen):

```tsx
import { AppleMaps, GoogleMaps } from "expo-maps";
import { Platform } from "react-native";

// Render platform-specific map
{
  Platform.OS === "ios" ? (
    <AppleMaps.View
      style={{ flex: 1 }}
      cameraPosition={{
        coordinates: { latitude, longitude },
        zoom: 15,
      }}
      markers={[
        {
          id: "location",
          coordinates: { latitude, longitude },
        },
      ]}
    />
  ) : (
    <GoogleMaps.View
      style={{ flex: 1 }}
      cameraPosition={{
        coordinates: { latitude, longitude },
        zoom: 15,
      }}
      markers={[
        {
          id: "location",
          coordinates: { latitude, longitude },
        },
      ]}
    />
  );
}
```

**Requirements:**

- Package: `expo-maps` (already installed)
- Google Maps API key configured via environment variable

### Secure API Key Configuration

API keys are securely configured in `app.config.js` using environment variables:

```bash
# Copy .env.example to .env and set your keys
cp .env.example .env

# Required environment variables:
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_key_here
```

Get API keys from [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Enable:

- Maps SDK for Android
- Maps SDK for iOS
- Places API

**Important:** After changing environment variables, run `npx expo prebuild --clean` to regenerate native code with new keys.

---

## 🔌 Payload CMS Integration

### Architecture

```
Expo Client (iOS/Android/Web)
         ↓
Expo Router API Route (+api.ts)
         ↓
Payload REST Client (lib/payload.server.ts)
         ↓
Payload CMS
```

**Security:** Payload API keys are NEVER exposed to the client. All CMS access goes through server-side API routes.

### Server-only Payload Client

`lib/payload.server.ts` - Import ONLY in `+api.ts` files:

```typescript
import {
  payloadClient,
  getCookiesFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

export async function GET(request: Request) {
  const cookies = getCookiesFromRequest(request);
  const result = await payloadClient.find(
    {
      collection: "posts",
      limit: 10,
      page: 1,
      depth: 2,
      sort: "-createdAt",
      where: { status: { equals: "published" } },
    },
    cookies,
  );
  return Response.json(result);
}
```

### Client-side API Usage

`lib/api-client.ts` - Use in React components:

```typescript
import { posts, users, createCollectionAPI } from "@/lib/api-client";

// Fetch posts
const { docs, totalPages } = await posts.find({ limit: 10, page: 1 });

// Get single post
const post = await posts.findByID("abc123");

// Create post
const newPost = await posts.create({ title: "Hello", content: "..." });

// Get current user
const { user } = await users.me();

// Generic collection
const events = createCollectionAPI("events");
const { docs } = await events.find({ limit: 5 });
```

### API Routes Structure

```
app/
  api/
    posts+api.ts          # GET (list), POST (create)
    posts/[id]+api.ts     # GET, PATCH, DELETE by ID
    users+api.ts          # GET (list), POST (register)
    users/me+api.ts       # GET current user
```

### Environment Variables

```bash
# Server-only (NEVER prefix with EXPO_PUBLIC_)
PAYLOAD_URL=http://localhost:3000
PAYLOAD_API_KEY=your_api_key_here
```

### Auth Forwarding

Cookies are automatically forwarded from client requests to Payload for user authentication:

```typescript
const cookies = getCookiesFromRequest(request);
await payloadClient.find({ collection: "posts" }, cookies);
```

---

## 🔐 Better Auth Integration

### Architecture

```
Expo Client (iOS/Android/Web)
         ↓
Better Auth Client (lib/auth-client.ts)
         ↓
Expo Router API Route (app/api/auth/[...all]+api.ts)
         ↓
Better Auth Server (lib/auth.ts)
         ↓
PostgreSQL Database
```

### Server Configuration

`lib/auth.ts` - Import ONLY in `+api.ts` files:

```typescript
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";

export const auth = betterAuth({
  database: { provider: "pg", url: DATABASE_URI },
  plugins: [expo()],
  emailAndPassword: { enabled: true },
  trustedOrigins: ["dvnt://", "dvnt://*"],
});
```

### Client Usage

`lib/auth-client.ts` - Use in React components:

```typescript
import {
  authClient,
  useSession,
  signIn,
  signUp,
  signOut,
} from "@/lib/auth-client";

// Sign up
await signUp.email({
  email: "user@example.com",
  password: "password123",
  name: "User Name",
});

// Sign in
await signIn.email({
  email: "user@example.com",
  password: "password123",
});

// Sign out
await signOut();

// Get session (hook)
const { data: session } = useSession();

// Social sign in
await signIn.social({
  provider: "google",
  callbackURL: "/dashboard", // converts to dvnt://dashboard
});
```

### Making Authenticated Requests

```typescript
import { authenticatedFetch, getAuthCookies } from "@/lib/auth-client";

// Option 1: Use helper
const response = await authenticatedFetch("/api/posts");

// Option 2: Manual cookies
const cookies = getAuthCookies();
const response = await fetch("/api/posts", {
  headers: { Cookie: cookies || "" },
  credentials: "omit",
});
```

### Environment Variables

```bash
# Server-only
BETTER_AUTH_SECRET=your_secret_here
DATABASE_URI=postgresql://...

# Client-accessible
EXPO_PUBLIC_AUTH_URL=http://localhost:8081
```

### API Routes Structure

```
app/
  api/
    auth/[...all]+api.ts  # All auth endpoints (sign in, sign up, etc.)
```

---

## 📤 Post/Upload Progress Pattern

When creating content (posts, events, etc.), use the `Progress` component with an overlay:

```tsx
import { Progress } from "@/components/ui/progress";

// State
const [isSubmitting, setIsSubmitting] = useState(false);
const [uploadProgress, setUploadProgress] = useState(0);

// Simulate progress during upload
const progressInterval = setInterval(() => {
  setUploadProgress((prev) => (prev >= 90 ? prev : prev + 10));
}, 200);

// On complete
setUploadProgress(100);

// Progress Overlay JSX
{
  isSubmitting && (
    <View className="absolute inset-0 bg-black/80 items-center justify-center z-50">
      <Motion.View
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="bg-card rounded-3xl p-8 items-center gap-4"
      >
        <View className="w-48 mb-2">
          <Progress value={uploadProgress} />
        </View>
        <Text className="text-lg font-semibold text-foreground">
          Creating...
        </Text>
      </Motion.View>
    </View>
  );
}
```

---

## 🚀 Production Deployment (API Routes)

### Live Deployments

| Service               | URL                                         |
| --------------------- | ------------------------------------------- |
| **Payload CMS**       | `https://payload-cms-setup-gray.vercel.app` |
| **API Server (Hono)** | `https://server-zeta-lovat.vercel.app`      |
| **Bunny CDN**         | `https://dvnt.b-cdn.net`                    |

### EAS Environment Variables

These are configured in EAS project settings and referenced in `eas.json`:

| Variable               | EAS Secret Name | Value                                       |
| ---------------------- | --------------- | ------------------------------------------- |
| `EXPO_PUBLIC_API_URL`  | `API_URL`       | `https://payload-cms-setup-gray.vercel.app` |
| `EXPO_PUBLIC_AUTH_URL` | -               | `https://server-zeta-lovat.vercel.app`      |
| `EXPO_PUBLIC_BUNNY_*`  | `BUNNY_*`       | See EAS secrets                             |

### Architecture Overview

```
Native App (iOS/Android)
         ↓
EXPO_PUBLIC_API_URL (https://payload-cms-setup-gray.vercel.app)
         ↓
Payload CMS API
         ↓
Supabase PostgreSQL
```

**Important:** Expo Router's web export with `output: "server"` cannot bundle native React Native modules for SSR. Use the standalone `server/` directory for production API deployment.

### Standalone API Server

The `server/` directory contains a Hono-based API server that mirrors the Expo Router API routes but runs in pure Node.js without React Native dependencies.

```bash
# Install server dependencies
cd server
npm install

# Development
npm run dev

# Production build
npm run build
npm start
```

### Deployment Steps

1. **Deploy the standalone server** to Vercel/Railway/Render:

   ```bash
   cd server
   vercel deploy
   # or
   railway deploy
   ```

2. **Set environment variables** on your deployment:

   ```bash
   PORT=3001
   PAYLOAD_URL=https://payload-cms-setup-gray.vercel.app
   PAYLOAD_API_KEY=your_api_key
   BETTER_AUTH_SECRET=your_secret
   DATABASE_URI=postgresql://...
   ```

3. **Configure native app** to use deployed API:

   Environment variables are set via EAS secrets and referenced in `eas.json`:

   ```json
   {
     "build": {
       "production": {
         "env": {
           "EXPO_PUBLIC_API_URL": "${API_URL}",
           "EXPO_PUBLIC_AUTH_URL": "${AUTH_URL}"
         }
       }
     }
   }
   ```

4. **Rebuild native apps** with production config:

   ```bash
   eas build --platform all --profile production
   ```

### Local Development

For development, the Expo Router API routes work with the dev server:

```bash
# Start with tunnel for Android emulator/physical devices
npx expo start --tunnel --clear
```

Leave `EXPO_PUBLIC_API_URL` empty in development - the app uses relative URLs.

### Why Not Expo Web Export?

The app uses native modules that cannot run in Node.js SSR:

- `expo-secure-store`
- `expo-notifications`
- `react-native-vision-camera`
- `@regulaforensics/react-native-face-api`

These cause `__fbBatchedBridgeConfig is not set` errors during web export.
