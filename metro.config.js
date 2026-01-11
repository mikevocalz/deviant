const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

// Add .riv file support for Rive animations
config.resolver.assetExts.push("riv");

module.exports = withRorkMetro(withNativeWind(config, { input: "./global.css" }));
