const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("riv");

// Fix for react-native-pager-view commonjs/esm resolution
config.resolver.unstable_enablePackageExports = true;

module.exports = withRorkMetro(
  withNativeWind(config, { input: "./global.css" }),
);
