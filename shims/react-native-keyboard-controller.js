// Server-side stub for react-native-keyboard-controller
const KeyboardProvider = ({ children }) => children;
const KeyboardAvoidingView = ({ children, style }) => children;
const KeyboardStickyView = ({ children }) => children;
const KeyboardToolbar = ({ children }) => children;
const useKeyboardAnimation = () => ({
  height: { value: 0 },
  progress: { value: 0 },
});
const useKeyboardHandler = () => {};
const useReanimatedKeyboardAnimation = () => ({
  height: { value: 0 },
  progress: { value: 0 },
});
const useFocusedInputHandler = () => {};
const useKeyboardContext = () => ({ isVisible: false, height: 0 });
const KeyboardController = {
  setInputMode: () => {},
  setDefaultMode: () => {},
  dismiss: () => {},
};
const KeyboardEvents = { addListener: () => ({ remove: () => {} }) };
const AndroidSoftInputModes = {
  SOFT_INPUT_ADJUST_NOTHING: 0,
  SOFT_INPUT_ADJUST_PAN: 1,
  SOFT_INPUT_ADJUST_RESIZE: 2,
  SOFT_INPUT_ADJUST_UNSPECIFIED: 3,
};

module.exports = {
  KeyboardProvider,
  KeyboardAvoidingView,
  KeyboardStickyView,
  KeyboardToolbar,
  useKeyboardAnimation,
  useKeyboardHandler,
  useReanimatedKeyboardAnimation,
  useFocusedInputHandler,
  useKeyboardContext,
  KeyboardController,
  KeyboardEvents,
  AndroidSoftInputModes,
};
