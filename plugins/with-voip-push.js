/**
 * Expo Config Plugin: iOS VoIP Push Notifications
 *
 * Adds PushKit framework and AppDelegate modifications for VoIP push.
 * When a VoIP push arrives, iOS wakes the app and we MUST immediately
 * report to CallKit (Apple requirement on iOS 13+).
 *
 * This plugin:
 * 1. Links PushKit.framework
 * 2. Adds VoIP push delegate methods to AppDelegate
 * 3. Ensures UIBackgroundModes includes "voip" and "remote-notification"
 */

const {
  withInfoPlist,
  withAppDelegate,
  withXcodeProject,
  IOSConfig,
} = require("expo/config-plugins");

/**
 * Add PushKit.framework to the Xcode project
 */
function withPushKitFramework(config) {
  return withXcodeProject(config, (config) => {
    const target = IOSConfig.XcodeUtils.getApplicationNativeTarget({
      project: config.modResults,
      projectName: config.modRequest.projectName,
    });
    config.modResults.addFramework("PushKit.framework", {
      target: target.uuid,
    });
    return config;
  });
}

/**
 * Ensure UIBackgroundModes includes voip and remote-notification
 */
function withBackgroundModes(config) {
  return withInfoPlist(config, (config) => {
    if (!Array.isArray(config.modResults.UIBackgroundModes)) {
      config.modResults.UIBackgroundModes = [];
    }
    const modes = config.modResults.UIBackgroundModes;
    if (!modes.includes("voip")) modes.push("voip");
    if (!modes.includes("remote-notification")) modes.push("remote-notification");
    return config;
  });
}

/**
 * Add PushKit VoIP delegate methods to AppDelegate.swift
 *
 * This is the CRITICAL part — when a VoIP push arrives, we must
 * call CXProvider.reportNewIncomingCall() IMMEDIATELY before JS boots.
 * react-native-callkeep's RNCallKeep handles this for us.
 */
function withAppDelegateVoIP(config) {
  return withAppDelegate(config, (config) => {
    let contents = config.modResults.contents;

    // Skip if already patched
    if (contents.includes("PKPushRegistryDelegate")) {
      return config;
    }

    // Add PushKit import at the top
    if (!contents.includes("import PushKit")) {
      contents = contents.replace(
        "import UIKit",
        "import UIKit\nimport PushKit"
      );
    }

    // Add RNVoipPushNotificationManager import
    if (!contents.includes("RNVoipPushNotificationManager")) {
      contents = contents.replace(
        "import UIKit",
        'import UIKit\n#if canImport(RNVoipPushNotificationManager)\nimport RNVoipPushNotificationManager\n#endif'
      );
    }

    // Find the AppDelegate class declaration and add PKPushRegistryDelegate conformance
    // Expo SDK 55 uses Swift AppDelegate
    const classRegex = /class\s+AppDelegate\s*:\s*([^{]+)\{/;
    const classMatch = contents.match(classRegex);
    if (classMatch) {
      const existingConformance = classMatch[1].trim();
      if (!existingConformance.includes("PKPushRegistryDelegate")) {
        contents = contents.replace(
          classRegex,
          `class AppDelegate: ${existingConformance}, PKPushRegistryDelegate {`
        );
      }
    }

    // Add VoIP registration in didFinishLaunchingWithOptions
    // We need to register for VoIP pushes as early as possible
    const didFinishRegex = /func\s+application\s*\([^)]*didFinishLaunchingWithOptions[^)]*\)\s*->\s*Bool\s*\{/;
    if (didFinishRegex.test(contents) && !contents.includes("PKPushRegistry")) {
      contents = contents.replace(
        didFinishRegex,
        `$&
    // Register for VoIP push notifications
    let voipRegistry = PKPushRegistry(queue: DispatchQueue.main)
    voipRegistry.delegate = self
    voipRegistry.desiredPushTypes = [.voIP]
`
      );
    }

    // Add the PKPushRegistryDelegate methods at the end of the class
    // These MUST call RNVoipPushNotificationManager and report to CallKit ASAP
    const delegateMethods = `

  // MARK: - PKPushRegistryDelegate (VoIP Push)

  func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    // Forward VoIP token to JS via react-native-voip-push-notification
    RNVoipPushNotificationManager.didUpdate(pushCredentials, forType: type.rawValue)
  }

  func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
    // Extract call data from VoIP push payload
    let callUUID = UUID().uuidString
    let callerName = payload.dictionaryPayload["callerName"] as? String ?? "Unknown"
    let handle = payload.dictionaryPayload["handle"] as? String ?? "Unknown"
    let hasVideo = payload.dictionaryPayload["hasVideo"] as? Bool ?? false

    // CRITICAL: Must report to CallKit IMMEDIATELY (Apple requirement on iOS 13+)
    // If we don't, Apple will terminate the app and stop delivering VoIP pushes.
    RNCallKeep.reportNewIncomingCall(
      callUUID,
      handle: handle,
      handleType: "generic",
      hasVideo: hasVideo,
      localizedCallerName: callerName
    )

    // Store completion handler for react-native-voip-push-notification
    RNVoipPushNotificationManager.addCompletionHandler(callUUID, completionHandler: completion)

    // Forward to JS side for additional handling
    RNVoipPushNotificationManager.didReceiveIncomingPush(with: payload, forType: type.rawValue)
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    // Token invalidated — JS side will handle re-registration
  }
`;

    // Insert before the last closing brace of the class
    const lastBraceIndex = contents.lastIndexOf("}");
    if (lastBraceIndex !== -1) {
      contents =
        contents.substring(0, lastBraceIndex) +
        delegateMethods +
        "\n" +
        contents.substring(lastBraceIndex);
    }

    config.modResults.contents = contents;
    return config;
  });
}

/**
 * Combined plugin
 */
function withVoipPush(config) {
  config = withPushKitFramework(config);
  config = withBackgroundModes(config);
  config = withAppDelegateVoIP(config);
  return config;
}

module.exports = withVoipPush;
