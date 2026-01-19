// Server-side stub for expo-image
const { View } = require("react-native");

const Image = View;
Image.prefetch = async () => false;
Image.clearDiskCache = async () => {};
Image.clearMemoryCache = async () => {};
Image.getCachePathAsync = async () => null;

module.exports = { Image };
