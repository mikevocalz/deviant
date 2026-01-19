// Server-side stub for react-native-reanimated
const Animated = {
  View: ({ children, style, ...props }) => null,
  Text: ({ children, style, ...props }) => null,
  Image: ({ style, ...props }) => null,
  ScrollView: ({ children, style, ...props }) => null,
  FlatList: ({ data, renderItem, ...props }) => null,
  createAnimatedComponent: (Component) => Component,
};

const useSharedValue = (initialValue) => ({ value: initialValue });
const useAnimatedStyle = (updater) => ({});
const useDerivedValue = (updater) => ({ value: updater() });
const useAnimatedScrollHandler = () => ({});
const useAnimatedGestureHandler = () => ({});
const withTiming = (toValue) => toValue;
const withSpring = (toValue) => toValue;
const withDelay = (delay, animation) => animation;
const withSequence = (...animations) => animations[0];
const withRepeat = (animation) => animation;
const interpolate = (value, inputRange, outputRange) => outputRange[0];
const Extrapolate = { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" };
const Easing = {
  linear: (t) => t,
  ease: (t) => t,
  quad: (t) => t,
  cubic: (t) => t,
  poly: () => (t) => t,
  sin: (t) => t,
  circle: (t) => t,
  exp: (t) => t,
  elastic: () => (t) => t,
  back: () => (t) => t,
  bounce: (t) => t,
  bezier: () => (t) => t,
  in: (easing) => easing,
  out: (easing) => easing,
  inOut: (easing) => easing,
};
const FadeIn = { duration: () => FadeIn, easing: () => FadeIn };
const FadeOut = { duration: () => FadeOut, easing: () => FadeOut };
const SlideInRight = { duration: () => SlideInRight };
const SlideOutLeft = { duration: () => SlideOutLeft };
const runOnJS = (fn) => fn;
const runOnUI = (fn) => fn;
const cancelAnimation = () => {};
const measure = () => null;
const scrollTo = () => {};
const setGestureState = () => {};

module.exports = {
  default: Animated,
  Animated,
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useAnimatedScrollHandler,
  useAnimatedGestureHandler,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  interpolate,
  Extrapolate,
  Easing,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  runOnJS,
  runOnUI,
  cancelAnimation,
  measure,
  scrollTo,
  setGestureState,
};
