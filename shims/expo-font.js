// Server-side stub for expo-font
const noop = () => {};
const noopAsync = async () => {};

module.exports = {
  useFonts: () => [true, null],
  loadAsync: noopAsync,
  isLoaded: () => true,
  isLoading: () => false,
};
