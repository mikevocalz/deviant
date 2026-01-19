// Server-side stub for @gorhom/bottom-sheet
const BottomSheet = ({ children }) => children;
const BottomSheetModal = ({ children }) => children;
const BottomSheetModalProvider = ({ children }) => children;
const BottomSheetScrollView = ({ children }) => children;
const BottomSheetFlatList = ({ data, renderItem }) => null;
const BottomSheetSectionList = ({ sections, renderItem }) => null;
const BottomSheetView = ({ children }) => children;
const BottomSheetTextInput = () => null;
const BottomSheetBackdrop = () => null;
const BottomSheetHandle = () => null;
const BottomSheetFooter = ({ children }) => children;
const useBottomSheet = () => ({
  expand: () => {},
  collapse: () => {},
  close: () => {},
  snapToIndex: () => {},
  snapToPosition: () => {},
});
const useBottomSheetModal = () => ({
  present: () => {},
  dismiss: () => {},
  dismissAll: () => {},
});
const useBottomSheetDynamicSnapPoints = () => ({
  animatedHandleHeight: { value: 0 },
  animatedSnapPoints: { value: [] },
  animatedContentHeight: { value: 0 },
  handleContentLayout: () => {},
});
const useBottomSheetSpringConfigs = () => ({});
const useBottomSheetTimingConfigs = () => ({});

BottomSheet.defaultProps = {};
BottomSheetModal.defaultProps = {};

module.exports = {
  default: BottomSheet,
  BottomSheet,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetScrollView,
  BottomSheetFlatList,
  BottomSheetSectionList,
  BottomSheetView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
  BottomSheetHandle,
  BottomSheetFooter,
  useBottomSheet,
  useBottomSheetModal,
  useBottomSheetDynamicSnapPoints,
  useBottomSheetSpringConfigs,
  useBottomSheetTimingConfigs,
};
