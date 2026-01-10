const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const config = getDefaultConfig(__dirname);

// Allow bundling Rive .riv assets.
config.resolver.assetExts.push("riv");

module.exports = withNativeWind(config, {
  input: "./global.css",
  inlineRem: 16,
});
