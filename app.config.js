export default {
  expo: {
    name: "DVNT",
    slug: "dvnt",
    version: "1.0.0",
    runtimeVersion: {
      policy: "appVersion",
    },
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#000000",
    },
    assetBundlePatterns: ["**/*"],
    updates: {
      url: "https://u.expo.dev/5c0d13a3-c544-4ffc-ae8f-8e897dda2663",
      fallbackToCacheTimeout: 0,
      checkAutomatically: "ON_LOAD",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.dvnt.app",
      buildNumber: "1.0.0",
      infoPlist: {
        NSCameraUsageDescription:
          "This app needs access to your camera to take photos and videos for posts and stories.",
        NSPhotoLibraryUsageDescription:
          "This app needs access to your photo library to select photos and videos for posts and stories.",
        NSMicrophoneUsageDescription:
          "This app needs access to your microphone to record videos with audio.",
        UIBackgroundModes: ["audio"],
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
      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
        "android.permission.ACCESS_MEDIA_LOCATION",
        "android.permission.READ_MEDIA_AUDIO",
        "android.permission.VIBRATE",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
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
      output: "server",
    },
    plugins: [
      [
        "expo-router",
        {
          origin: "http://localhost:8081",
        },
      ],
      [
        "expo-build-properties",
        {
          ios: {
            deploymentTarget: "16.0",
          },
        },
      ],
      [
        "expo-video",
        {
          supportsBackgroundPlayback: false,
          supportsPictureInPicture: false,
        },
      ],
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
      "expo-secure-store",
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
      reactCanary: true,
      reactCompiler: true,
    },
    extra: {
      router: {
        origin: "http://localhost:8081",
      },
      eas: {
        projectId: "5c0d13a3-c544-4ffc-ae8f-8e897dda2663",
      },
    },
  },
};
