
import { Platform } from "react-native"

// Platform-specific imports
const SettingsScreenIOS = require("./settings.ios").default
const SettingsScreenAndroid = require("./settings.android").default

const SettingsScreen = Platform.OS === "ios" ? SettingsScreenIOS : SettingsScreenAndroid

export default SettingsScreen
