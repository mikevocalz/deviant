/**
 * Expo Config Plugin: DVNT Live Activity
 * Combined entry point for iOS + Android live surface plugins.
 */

const {
  withLiveActivityInfoPlist,
  withAppGroupsEntitlement,
  withLiveActivitySwiftFiles,
  withWidgetExtensionTarget,
} = require("./with-live-activity-ios");

const {
  withAndroidLiveNotification,
  withAndroidNotificationFiles,
} = require("./with-live-activity-android");

function withLiveActivity(config) {
  // iOS is now handled by the "voltra" plugin — see app.config.js

  // Android
  config = withAndroidLiveNotification(config);
  config = withAndroidNotificationFiles(config);

  return config;
}

module.exports = withLiveActivity;
