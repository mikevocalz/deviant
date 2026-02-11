/**
 * Expo Config Plugin: iOS VoIP Push Notifications
 *
 * Adds PushKit framework and an Objective-C AppDelegate category for VoIP push.
 * When a VoIP push arrives, iOS wakes the app and we MUST immediately
 * report to CallKit (Apple requirement on iOS 13+).
 *
 * This plugin:
 * 1. Links PushKit.framework + CallKit.framework
 * 2. Adds an Objective-C file (AppDelegate+VoIPPush) to the Xcode project
 * 3. Ensures UIBackgroundModes includes "voip" and "remote-notification"
 *
 * We use Objective-C (not Swift) because RNVoipPushNotificationManager and
 * RNCallKeep are Objective-C classes — they aren't visible from Swift without
 * a bridging header, which Expo's managed workflow doesn't expose.
 */

const {
  withInfoPlist,
  withXcodeProject,
  withDangerousMod,
  IOSConfig,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// ── Objective-C source for PushKit VoIP handling ────────────────────────
// This gets written to ios/<ProjectName>/AppDelegate+VoIPPush.m
const OBJC_VOIP_SOURCE = `//
// AppDelegate+VoIPPush.m
// VoIP Push Notification handler via PushKit
//
// CRITICAL: On iOS 13+, every VoIP push MUST immediately report to CallKit.
// Failure to do so causes Apple to terminate the app and revoke VoIP push delivery.
//

#import <objc/runtime.h>
#import <PushKit/PushKit.h>
#import "RNVoipPushNotificationManager.h"
#import "RNCallKeep.h"

@interface AppDelegate (VoIPPush) <PKPushRegistryDelegate>
@end

static PKPushRegistry *_voipRegistry = nil;

@implementation AppDelegate (VoIPPush)

// Called on app launch — register for VoIP push tokens
// We use +load to ensure this runs before didFinishLaunching
+ (void)load {
  // Schedule VoIP registration on the main queue after app finishes launching
  [[NSNotificationCenter defaultCenter]
    addObserverForName:UIApplicationDidFinishLaunchingNotification
    object:nil
    queue:[NSOperationQueue mainQueue]
    usingBlock:^(NSNotification *note) {
      _voipRegistry = [[PKPushRegistry alloc] initWithQueue:dispatch_get_main_queue()];
      _voipRegistry.delegate = (id<PKPushRegistryDelegate>)[UIApplication sharedApplication].delegate;
      _voipRegistry.desiredPushTypes = [NSSet setWithObject:PKPushTypeVoIP];
    }];
}

#pragma mark - PKPushRegistryDelegate

- (void)pushRegistry:(PKPushRegistry *)registry
  didUpdatePushCredentials:(PKPushCredentials *)credentials
  forType:(PKPushType)type
{
  // Forward VoIP device token to JS via react-native-voip-push-notification
  [RNVoipPushNotificationManager didUpdatePushCredentials:credentials forType:(NSString *)type];
}

- (void)pushRegistry:(PKPushRegistry *)registry
  didReceiveIncomingPushWithPayload:(PKPushPayload *)payload
  forType:(PKPushType)type
  withCompletionHandler:(void (^)(void))completion
{
  // Extract call data from VoIP push payload
  NSString *uuid = [[NSUUID UUID] UUIDString];
  NSDictionary *payloadDict = payload.dictionaryPayload;
  NSString *callerName = payloadDict[@"callerName"] ?: @"Unknown";
  NSString *handle = payloadDict[@"handle"] ?: @"Unknown";
  BOOL hasVideo = [payloadDict[@"hasVideo"] boolValue];

  // CRITICAL: Report to CallKit IMMEDIATELY (Apple iOS 13+ requirement)
  // This shows the native full-screen incoming call UI even when app is killed.
  [RNCallKeep reportNewIncomingCall:uuid
                             handle:handle
                         handleType:@"generic"
                           hasVideo:hasVideo
                localizedCallerName:callerName
                    supportsHolding:YES
                       supportsDTMF:YES
                   supportsGrouping:YES
                 supportsUngrouping:YES
                        fromPushKit:YES
                            payload:payloadDict];

  // Store completion handler so react-native-voip-push-notification can call it
  [RNVoipPushNotificationManager addCompletionHandler:uuid completionHandler:completion];

  // Forward to JS side for additional handling
  [RNVoipPushNotificationManager didReceiveIncomingPushWithPayload:payload forType:(NSString *)type];
}

- (void)pushRegistry:(PKPushRegistry *)registry
  didInvalidatePushTokenForType:(PKPushType)type
{
  // Token invalidated — JS side will handle re-registration
}

@end
`;

/**
 * Ensure a header search path exists in all build configurations
 * (borrowed from @config-plugins/react-native-callkeep)
 */
function ensureHeaderSearchPath(project, searchPath) {
  const dominated = /_comment$/;
  const configurations = Object.keys(project.pbxXCBuildConfigurationSection())
    .filter((k) => !dominated.test(k))
    .reduce((acc, k) => {
      acc[k] = project.pbxXCBuildConfigurationSection()[k];
      return acc;
    }, {});

  const INHERITED = '"$(inherited)"';
  for (const config in configurations) {
    const buildSettings = configurations[config].buildSettings;
    const productName = buildSettings["PRODUCT_NAME"];
    if (
      productName &&
      productName.replace(/^"|"$/g, "") !== project.productName
    ) {
      continue;
    }
    if (!buildSettings["HEADER_SEARCH_PATHS"]) {
      buildSettings["HEADER_SEARCH_PATHS"] = [INHERITED];
    }
    if (!buildSettings["HEADER_SEARCH_PATHS"].includes(searchPath)) {
      buildSettings["HEADER_SEARCH_PATHS"].push(searchPath);
    }
  }
}

/**
 * Add PushKit.framework to the Xcode project,
 * add header search paths for RNVoipPushNotification and RNCallKeep,
 * and add the Objective-C VoIP push file to build sources.
 */
function withVoipXcodeProject(config) {
  return withXcodeProject(config, (config) => {
    const projectName = config.modRequest.projectName;
    const target = IOSConfig.XcodeUtils.getApplicationNativeTarget({
      project: config.modResults,
      projectName,
    });

    // Link PushKit.framework
    config.modResults.addFramework("PushKit.framework", {
      target: target.uuid,
    });

    // Add header search paths so AppDelegate+VoIPPush.m can find the ObjC headers
    const voipHeaderPath =
      '"$(SRCROOT)/../node_modules/react-native-voip-push-notification/ios/RNVoipPushNotification"';
    const callkeepHeaderPath =
      '"$(SRCROOT)/../node_modules/react-native-callkeep/ios/RNCallKeep"';
    ensureHeaderSearchPath(config.modResults, voipHeaderPath);
    ensureHeaderSearchPath(config.modResults, callkeepHeaderPath);

    // Add the Objective-C file to the Xcode project build sources
    const voipFileName = "AppDelegate+VoIPPush.m";

    // Add file to the project - let xcode library auto-detect the group
    // CRITICAL: Don't pass group parameter - the library figures out the correct group
    // based on the file path. Passing group explicitly causes "Cannot read properties
    // of null" errors in xcode@3.0.1
    config.modResults.addSourceFile(
      `${projectName}/${voipFileName}`,
      { target: target.uuid },
    );

    return config;
  });
}

/**
 * Write the Objective-C VoIP push file to the iOS project directory
 */
function withVoipObjcFile(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectName = config.modRequest.projectName;
      const iosDir = path.join(
        config.modRequest.platformProjectRoot,
        projectName,
      );
      const filePath = path.join(iosDir, "AppDelegate+VoIPPush.m");

      // Write the Objective-C file
      fs.writeFileSync(filePath, OBJC_VOIP_SOURCE, "utf-8");
      console.log(`[with-voip-push] Wrote ${filePath}`);

      return config;
    },
  ]);
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
    if (!modes.includes("remote-notification"))
      modes.push("remote-notification");
    return config;
  });
}

/**
 * Combined plugin
 */
function withVoipPush(config) {
  config = withBackgroundModes(config);
  config = withVoipObjcFile(config);
  config = withVoipXcodeProject(config);
  return config;
}

module.exports = withVoipPush;
