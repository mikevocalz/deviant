// Use 'single' output for pure SPA - no SSR/SSG means no Node.js execution of native modules
// Native modules (expo-secure-store, react-native-vision-camera, etc.) can't run in Node.js
// Use the standalone server/ directory for production API deployment
const webOutput = "single";

// Stability: gate experimental flags for production (EAS production profile sets APP_ENV=production)
const appEnv =
  process.env.APP_ENV ?? process.env.EXPO_PUBLIC_APP_ENV ?? "development";
const isProd = appEnv === "production";

// Dynamic origin - uses Supabase URL with production fallback
const routerOrigin =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://npfjanxturvmjyevoyfo.supabase.co";

const fishjamAppIdFallback = "28026441819941d78c40584fb830f851";

// Conservative native hardening rollout:
// - enable recent-app screenshot protection on iOS/Android
// - intentionally leave SSL pinning unset until real production pin material exists
// - keep iOS cache disabling off because it can impact offline/cached behavior
const appSecurityPlugin = [
  "@bam.tech/react-native-app-security",
  {
    preventRecentScreenshots: {
      ios: { enabled: true },
      android: { enabled: true },
    },
  },
];

export default {
  expo: {
    name: "DVNT",
    slug: "dvnt",
    version: "1.0.0",
    runtimeVersion: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#000000",
    },
    assetBundlePatterns: ["**/*"],
    updates: {
      url: "https://u.expo.dev/5c0d13a3-c544-4ffc-ae8f-8e897dda2663",
      fallbackToCacheTimeout: 30000, // 30 seconds fallback to prevent crashes
      checkAutomatically: "ON_LOAD",
      enableBsdiffPatchSupport: true,
      waitBeforeLaunchMs: 5000, // 5 seconds to allow rollback detection
      // Enhanced crash hardening
      // CRITICAL: Use appEnv (which reads APP_ENV from EAS profiles), NOT NODE_ENV
      // NODE_ENV defaults to "development" during Metro bundling even for production builds
      enabled: appEnv === "production" || appEnv === "preview", // Enable OTA for production and preview builds only
      runtimeVersion: "1.0.0", // Fixed runtime version for OTA safety
      message: "A new version is available. Restart to apply updates.", // User-friendly message
    },
    buildCacheProvider: "eas",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.dvnt.app",
      icon: "./assets/images/ios-icon.png",
      associatedDomains: ["applinks:dvntlive.app", "applinks:www.dvntlive.app"],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription:
          "This app needs access to your camera to take photos and videos for posts and stories.",
        NSPhotoLibraryUsageDescription:
          "This app needs access to your photo library to select photos and videos for posts and stories.",
        NSMicrophoneUsageDescription:
          "This app needs access to your microphone to record videos with audio.",
        UIBackgroundModes: ["audio", "voip"],
        NSPhotoLibraryAddUsageDescription:
          "Allow $(PRODUCT_NAME) to save photos.",
        NSLocationWhenInUseUsageDescription:
          "Allow $(PRODUCT_NAME) to access your location to show nearby events and venues.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#000000",
      },
      package: "com.dvnt.app",
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            { scheme: "https", host: "dvntlive.app", pathPrefix: "/" },
            { scheme: "https", host: "www.dvntlive.app", pathPrefix: "/" },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
      permissions: [
        // ── Media ──
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_AUDIO",
        "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
        "android.permission.ACCESS_MEDIA_LOCATION",
        // ── Location ──
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        // ── Notifications ──
        "android.permission.VIBRATE",
        "android.permission.POST_NOTIFICATIONS",
        // ── CallKeep / Telecom (ConnectionService) ──
        // READ_PHONE_STATE: required by CallKeep on Android < 30
        "android.permission.READ_PHONE_STATE",
        // READ_PHONE_NUMBERS: required by CallKeep on Android 30+ (API 30 = Android 11)
        // VoiceConnectionService.createConnection() calls telecomManager.getPhoneAccount()
        // which throws SecurityException without this permission.
        "android.permission.READ_PHONE_NUMBERS",
        // CALL_PHONE: required by CallKeep for outgoing call registration
        "android.permission.CALL_PHONE",
        // MANAGE_OWN_CALLS: required for self-managed ConnectionService
        "android.permission.MANAGE_OWN_CALLS",
        // BIND_TELECOM_CONNECTION_SERVICE: required for VoiceConnectionService
        "android.permission.BIND_TELECOM_CONNECTION_SERVICE",
        // Foreground service permissions for in-call notification
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_PHONE_CALL",
        "android.permission.FOREGROUND_SERVICE_CAMERA",
        "android.permission.FOREGROUND_SERVICE_MICROPHONE",
        // USE_FULL_SCREEN_INTENT: required for incoming call full-screen UI on Android 10+
        "android.permission.USE_FULL_SCREEN_INTENT",
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
      output: webOutput,
    },
    plugins: [
      "./plugins/disable-user-script-sandboxing",
      "./plugins/with-app-controller-init",
      "./plugins/android-fixes",
      "./plugins/fix-wgpu-headers",
      "./plugins/with-cube-luts",
      "./plugins/disable-frame-processors",
      "./plugins/fix-visioncamera-barcode-scanner-swift",
      "expo-asset",
      "expo-audio",
      "expo-font",
      "expo-image",
      "expo-web-browser",
      "@config-plugins/react-native-webrtc",
      [
        "@stripe/stripe-react-native",
        {
          merchantIdentifier: "merchant.com.deviant",
          enableGooglePay: true,
        },
      ],
      [
        "expo-router",
        {
          origin: routerOrigin,
        },
      ],
      appSecurityPlugin,
      "./plugins/with-swift5-compat",
      [
        "expo-build-properties",
        {
          ios: {
            deploymentTarget: "17.0",
          },
          // Disable experimental RN/Hermes flags in production to reduce SIGTRAP crash risk
          buildReactNativeFromSource: !isProd,
          // useHermesV1: !isProd, // Disabled due to version conflicts
        },
      ],
      [
        "expo-video",
        {
          supportsBackgroundPlayback: false,
          supportsPictureInPicture: false,
        },
      ],
      "react-native-video",
      [
        "expo-image-picker",
        {
          photosPermission:
            "Allow $(PRODUCT_NAME) to access your photos to share in posts and stories.",
          cameraPermission:
            "Allow $(PRODUCT_NAME) to access your camera to take photos and videos.",
          microphonePermission:
            "Allow $(PRODUCT_NAME) to access your microphone to record videos with audio.",
        },
      ],
      [
        "expo-media-library",
        {
          photosPermission:
            "Allow $(PRODUCT_NAME) to access your photo library.",
          savePhotosPermission: "Allow $(PRODUCT_NAME) to save photos.",
          isAccessMediaLocationEnabled: true,
        },
      ],
      [
        "expo-screen-orientation",
        {
          initialOrientation: "PORTRAIT_UP",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission: "Allow $(PRODUCT_NAME) to access your camera.",
          microphonePermission:
            "Allow $(PRODUCT_NAME) to access your microphone.",
          recordAudioAndroid: true,
        },
      ],
      "@react-native-community/datetimepicker",
      [
        "expo-maps",
        {
          android: {
            googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
          },
          ios: {
            googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
          },
          requestLocationPermission: true,
          locationPermission:
            "Allow $(PRODUCT_NAME) to access your location to show nearby events and venues.",
        },
      ],
      "@config-plugins/react-native-callkeep",
      "./plugins/with-voip-push",
      "./plugins/with-custom-ringtone",
      "./plugins/with-live-activity",
      ["./plugins/with-development-team", { teamId: "436WA3W63V" }],
      "expo-secure-store",
      "expo-sharing",
      [
        "./plugins/with-share-intent-fixed",
        {
          iosActivationRules: {
            NSExtensionActivationSupportsWebURLWithMaxCount: 1,
            NSExtensionActivationSupportsWebPageWithMaxCount: 1,
            NSExtensionActivationSupportsText: true,
            NSExtensionActivationSupportsImageWithMaxCount: 1,
            NSExtensionActivationSupportsMovieWithMaxCount: 1,
          },
          androidIntentFilters: ["text/*", "image/*"],
          androidMainActivityAttributes: {
            "android:launchMode": "singleTask",
          },
        },
      ],
      "react-native-compressor",
      [
        "expo-calendar",
        {
          calendarPermission:
            "Allow $(PRODUCT_NAME) to access your calendar to add event reminders.",
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Allow $(PRODUCT_NAME) to use your location.",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/notification-icon.png",
          color: "#ffffff",
          defaultChannel: "default",
        },
      ],
    ],
    scheme: "dvnt",
    experiments: {
      typedRoutes: true,
      // Disable experimental React canary/compiler in production to reduce startup crash risk
      reactCanary: !isProd,
      reactCompiler: !isProd,
    },
    extra: {
      ios: {
        widgetBundleIdentifier: "com.dvnt.app.DVNTHomeWidgetExtension",
        appGroupIdentifier: "group.com.dvnt.app",
      },
      router: {
        origin: routerOrigin,
      },
      fishjamAppId:
        process.env.EXPO_PUBLIC_FISHJAM_APP_ID ||
        process.env.FISHJAM_APP_ID ||
        fishjamAppIdFallback,
      eas: {
        projectId: "5c0d13a3-c544-4ffc-ae8f-8e897dda2663",
        build: {
          // Widget extension disabled — re-enable when live activity crash is fixed
          // experimental: {
          //   ios: {
          //     appExtensions: [
          //       {
          //         targetName: "DVNTHomeWidgetExtension",
          //         bundleIdentifier: "com.dvnt.app.DVNTHomeWidgetExtension",
          //         entitlements: {
          //           "com.apple.security.application-groups": [
          //             "group.com.dvnt.app",
          //           ],
          //         },
          //       },
          //     ],
          //   },
          // },
        },
      },
    },
  },
};
