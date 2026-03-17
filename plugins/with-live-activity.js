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
  // iOS
  config = withLiveActivityInfoPlist(config);
  config = withAppGroupsEntitlement(config);
  config = withLiveActivitySwiftFiles(config);
  config = withWidgetExtensionTarget(config);

  // Android
  config = withAndroidLiveNotification(config);
  config = withAndroidNotificationFiles(config);

  return config;
}

module.exports = withLiveActivity;
