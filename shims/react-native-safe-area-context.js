// Server-side stub for react-native-safe-area-context
const SafeAreaProvider = ({ children }) => children;
const SafeAreaView = ({ children, style, edges }) => children;
const SafeAreaInsetsContext = {
  Consumer: ({ children }) =>
    children({ top: 0, bottom: 0, left: 0, right: 0 }),
};
const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
const useSafeAreaFrame = () => ({ x: 0, y: 0, width: 0, height: 0 });
const initialWindowMetrics = {
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 0, height: 0 },
};
const withSafeAreaInsets = (Component) => Component;

module.exports = {
  SafeAreaProvider,
  SafeAreaView,
  SafeAreaInsetsContext,
  useSafeAreaInsets,
  useSafeAreaFrame,
  initialWindowMetrics,
  withSafeAreaInsets,
};
