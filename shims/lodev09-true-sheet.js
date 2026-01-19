// Server-side stub for @lodev09/react-native-true-sheet
const TrueSheet = ({ children }) => children;
const createTrueSheetNavigator = () => ({
  Navigator: ({ children }) => children,
  Screen: ({ children }) => children,
});

TrueSheet.defaultProps = {};

module.exports = {
  default: TrueSheet,
  TrueSheet,
  createTrueSheetNavigator,
};
