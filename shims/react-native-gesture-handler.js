// Server-side stub for react-native-gesture-handler
const GestureHandlerRootView = ({ children, style }) => children;
const GestureDetector = ({ children }) => children;
const Gesture = {
  Pan: () => ({
    onStart: () => Gesture.Pan(),
    onUpdate: () => Gesture.Pan(),
    onEnd: () => Gesture.Pan(),
  }),
  Tap: () => ({
    onStart: () => Gesture.Tap(),
    onEnd: () => Gesture.Tap(),
    maxDuration: () => Gesture.Tap(),
  }),
  LongPress: () => ({
    onStart: () => Gesture.LongPress(),
    onEnd: () => Gesture.LongPress(),
  }),
  Pinch: () => ({
    onStart: () => Gesture.Pinch(),
    onUpdate: () => Gesture.Pinch(),
    onEnd: () => Gesture.Pinch(),
  }),
  Rotation: () => ({
    onStart: () => Gesture.Rotation(),
    onUpdate: () => Gesture.Rotation(),
    onEnd: () => Gesture.Rotation(),
  }),
  Fling: () => ({ direction: () => Gesture.Fling() }),
  Simultaneous: () => ({}),
  Exclusive: () => ({}),
  Race: () => ({}),
};
const PanGestureHandler = ({ children }) => children;
const TapGestureHandler = ({ children }) => children;
const LongPressGestureHandler = ({ children }) => children;
const PinchGestureHandler = ({ children }) => children;
const RotationGestureHandler = ({ children }) => children;
const FlingGestureHandler = ({ children }) => children;
const NativeViewGestureHandler = ({ children }) => children;
const ScrollView = ({ children }) => children;
const FlatList = ({ data, renderItem }) => null;
const Switch = () => null;
const TextInput = () => null;
const DrawerLayout = ({ children }) => children;
const Swipeable = ({ children }) => children;
const TouchableOpacity = ({ children, onPress }) => children;
const TouchableHighlight = ({ children, onPress }) => children;
const TouchableWithoutFeedback = ({ children, onPress }) => children;
const TouchableNativeFeedback = ({ children, onPress }) => children;
const RectButton = ({ children }) => children;
const BorderlessButton = ({ children }) => children;
const BaseButton = ({ children }) => children;
const State = {
  UNDETERMINED: 0,
  FAILED: 1,
  BEGAN: 2,
  CANCELLED: 3,
  ACTIVE: 4,
  END: 5,
};
const Directions = { RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8 };

module.exports = {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
  PanGestureHandler,
  TapGestureHandler,
  LongPressGestureHandler,
  PinchGestureHandler,
  RotationGestureHandler,
  FlingGestureHandler,
  NativeViewGestureHandler,
  ScrollView,
  FlatList,
  Switch,
  TextInput,
  DrawerLayout,
  Swipeable,
  TouchableOpacity,
  TouchableHighlight,
  TouchableWithoutFeedback,
  TouchableNativeFeedback,
  RectButton,
  BorderlessButton,
  BaseButton,
  State,
  Directions,
};
