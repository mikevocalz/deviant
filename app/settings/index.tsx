import { Platform } from "react-native";

const SettingsScreenIOS =
  require("../../components/settings/screens/SettingsScreen.ios").default;
const SettingsScreenAndroid =
  require("../../components/settings/screens/SettingsScreen.android").default;

const SettingsScreen =
  Platform.OS === "ios" ? SettingsScreenIOS : SettingsScreenAndroid;

export default SettingsScreen;
