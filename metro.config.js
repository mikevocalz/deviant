const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("riv");

// Fix for react-native-pager-view commonjs/esm resolution
config.resolver.unstable_enablePackageExports = true;

// Map native packages to their server-side shim files
const nativePackageShims = {
  "react-native-reanimated": path.resolve(
    __dirname,
    "shims/react-native-reanimated.js",
  ),
  "react-native-gesture-handler": path.resolve(
    __dirname,
    "shims/react-native-gesture-handler.js",
  ),
  "react-native-safe-area-context": path.resolve(
    __dirname,
    "shims/react-native-safe-area-context.js",
  ),
  "react-native-keyboard-controller": path.resolve(
    __dirname,
    "shims/react-native-keyboard-controller.js",
  ),
  "react-native-animated-glow": path.resolve(
    __dirname,
    "shims/react-native-animated-glow.js",
  ),
  "@gorhom/bottom-sheet": path.resolve(
    __dirname,
    "shims/gorhom-bottom-sheet.js",
  ),
  "react-native-pager-view": path.resolve(
    __dirname,
    "shims/react-native-pager-view.js",
  ),
  "@lodev09/react-native-true-sheet": path.resolve(
    __dirname,
    "shims/lodev09-true-sheet.js",
  ),
  "react-native-vision-camera": path.resolve(
    __dirname,
    "shims/react-native-vision-camera.js",
  ),
  "expo-notifications": path.resolve(__dirname, "shims/expo-notifications.js"),
  "expo-secure-store": path.resolve(__dirname, "shims/expo-secure-store.js"),
  "expo-image": path.resolve(__dirname, "shims/expo-image.js"),
  "expo-video": path.resolve(__dirname, "shims/expo-video.js"),
  "expo-linear-gradient": path.resolve(
    __dirname,
    "shims/expo-linear-gradient.js",
  ),
  "expo-font": path.resolve(__dirname, "shims/expo-font.js"),
  "expo-splash-screen": path.resolve(__dirname, "shims/expo-splash-screen.js"),
  "expo-image-picker": path.resolve(__dirname, "shims/expo-image-picker.js"),
  "expo-media-library": path.resolve(__dirname, "shims/expo-media-library.js"),
};

// Track if we're bundling for server (set when getServerManifest is the entry)
let isServerBundleMode = false;

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Detect server manifest entry point and enable server mode
  if (
    moduleName.includes("getServerManifest") ||
    context.originModulePath?.includes("getServerManifest")
  ) {
    isServerBundleMode = true;
  }

  // Reset flag when we hit a new entry point (index.js)
  if (moduleName === "." && !context.originModulePath) {
    isServerBundleMode = false;
  }

  // Use shims in server bundle mode
  if (isServerBundleMode) {
    for (const [pkg, shimPath] of Object.entries(nativePackageShims)) {
      if (moduleName === pkg || moduleName.startsWith(pkg + "/")) {
        return { type: "sourceFile", filePath: shimPath };
      }
    }
  }

  // Fix: event-target-shim@6 exports only "." but Fishjam WebRTC imports
  // "event-target-shim/index" which isn't in the exports map.
  // Rewrite to the root specifier so the exports field resolves correctly.
  if (moduleName === "event-target-shim/index") {
    const rewritten = "event-target-shim";
    if (originalResolveRequest) {
      return originalResolveRequest(context, rewritten, platform);
    }
    return context.resolveRequest(context, rewritten, platform);
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
