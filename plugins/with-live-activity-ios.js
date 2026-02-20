/**
 * iOS portion of the Live Activity config plugin.
 * Adds Widget Extension target, Swift UI files, App Groups, ActivityKit.
 */

const {
  withInfoPlist,
  withXcodeProject,
  withDangerousMod,
  withEntitlementsPlist,
  IOSConfig,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const EXTENSION_NAME = "DVNTLiveActivityExtension";
const APP_GROUP_ID = "group.com.dvnt.app";
const BUNDLE_ID = "com.dvnt.app";
const EXTENSION_BUNDLE_ID = `${BUNDLE_ID}.live-activity`;
const DEPLOYMENT_TARGET = "16.4";

// ── Swift Source Templates (loaded from plugins/live-activity-swift/) ──

function getAttributesSwift() {
  return `import ActivityKit\nimport Foundation\n\n@available(iOS 16.1, *)\nstruct DVNTLiveAttributes: ActivityAttributes {\n    struct ContentState: Codable, Hashable {\n        var generatedAt: String\n        var currentTile: Int\n        var tile1EventId: String?\n        var tile1Title: String\n        var tile1StartAt: String?\n        var tile1VenueName: String?\n        var tile1City: String?\n        var tile1HeroThumbUrl: String?\n        var tile1IsUpcoming: Bool\n        var tile1DeepLink: String\n        var tile2WeekStartISO: String\n        var tile2Ids: [String]\n        var tile2ThumbUrls: [String]\n        var tile2DeepLinks: [String]\n        var tile2RecapDeepLink: String\n        var tile3EventIds: [String]\n        var tile3Titles: [String]\n        var tile3StartAts: [String]\n        var tile3VenueNames: [String]\n        var tile3DeepLinks: [String]\n        var tile3SeeAllDeepLink: String\n        var weatherIcon: String?\n        var weatherTempF: Int?\n        var weatherLabel: String?\n    }\n}\n`;
}

function getObjcModuleExport() {
  return `#import <React/RCTBridgeModule.h>\n\n@interface RCT_EXTERN_MODULE(DVNTLiveActivity, NSObject)\nRCT_EXTERN_METHOD(areLiveActivitiesEnabled:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)\nRCT_EXTERN_METHOD(updateLiveActivity:(NSString *)jsonPayload)\nRCT_EXTERN_METHOD(endLiveActivity)\n@end\n`;
}

// Info.plist
function withLiveActivityInfoPlist(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.NSSupportsLiveActivities = true;
    config.modResults.NSSupportsLiveActivitiesFrequentUpdates = true;
    return config;
  });
}

// App Groups entitlement
function withAppGroupsEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    if (!config.modResults["com.apple.security.application-groups"]) {
      config.modResults["com.apple.security.application-groups"] = [];
    }
    const groups = config.modResults["com.apple.security.application-groups"];
    if (!groups.includes(APP_GROUP_ID)) groups.push(APP_GROUP_ID);
    return config;
  });
}

// Write Swift files
function withLiveActivitySwiftFiles(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectName = config.modRequest.projectName;
      const iosDir = config.modRequest.platformProjectRoot;
      const projectDir = path.join(iosDir, projectName);
      const pluginDir = path.join(__dirname, "live-activity-swift");

      // Copy pre-written Swift files from plugins/live-activity-swift/
      const swiftSrcDir = pluginDir;
      const extDir = path.join(iosDir, EXTENSION_NAME);
      fs.mkdirSync(extDir, { recursive: true });

      // If pre-written files exist, copy them; otherwise generate inline
      const swiftFiles = [
        "DVNTLiveAttributes.swift",
        "DVNTLiveActivityWidget.swift",
        "DVNTWidgetBundle.swift",
      ];

      for (const f of swiftFiles) {
        const src = path.join(swiftSrcDir, f);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(extDir, f));
        }
      }

      // Also copy Attributes to main target (shared type)
      const attrSrc = path.join(swiftSrcDir, "DVNTLiveAttributes.swift");
      if (fs.existsSync(attrSrc)) {
        fs.copyFileSync(
          attrSrc,
          path.join(projectDir, "DVNTLiveAttributes.swift"),
        );
      } else {
        fs.writeFileSync(
          path.join(projectDir, "DVNTLiveAttributes.swift"),
          getAttributesSwift(),
          "utf-8",
        );
        fs.writeFileSync(
          path.join(extDir, "DVNTLiveAttributes.swift"),
          getAttributesSwift(),
          "utf-8",
        );
      }

      // Copy native module swift + objc bridge
      const moduleSrc = path.join(swiftSrcDir, "DVNTLiveActivityModule.swift");
      if (fs.existsSync(moduleSrc)) {
        fs.copyFileSync(
          moduleSrc,
          path.join(projectDir, "DVNTLiveActivityModule.swift"),
        );
      }
      fs.writeFileSync(
        path.join(projectDir, "DVNTLiveActivityBridge.m"),
        getObjcModuleExport(),
        "utf-8",
      );

      // Extension Info.plist
      const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n    <key>CFBundleDevelopmentRegion</key><string>$(DEVELOPMENT_LANGUAGE)</string>\n    <key>CFBundleDisplayName</key><string>DVNT Live</string>\n    <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>\n    <key>CFBundleIdentifier</key><string>${EXTENSION_BUNDLE_ID}</string>\n    <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>\n    <key>CFBundleName</key><string>$(PRODUCT_NAME)</string>\n    <key>CFBundlePackageType</key><string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>\n    <key>CFBundleShortVersionString</key><string>1.0</string>\n    <key>CFBundleVersion</key><string>1</string>\n    <key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict>\n    <key>NSSupportsLiveActivities</key><true/>\n</dict>\n</plist>`;
      fs.writeFileSync(path.join(extDir, "Info.plist"), plist, "utf-8");

      // Extension entitlements
      const ent = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n    <key>com.apple.security.application-groups</key>\n    <array><string>${APP_GROUP_ID}</string></array>\n</dict>\n</plist>`;
      fs.writeFileSync(
        path.join(extDir, `${EXTENSION_NAME}.entitlements`),
        ent,
        "utf-8",
      );

      console.log(`[with-live-activity] Wrote iOS files`);
      return config;
    },
  ]);
}

// Add native module files to main Xcode target (proven pattern from with-voip-push.js)
// NOTE: Widget Extension target is NOT created here — use expo-apple-targets or manual
// Xcode setup for the Lock Screen / Dynamic Island UI. The native module in the main
// target allows RN to start/update/end Live Activities via ActivityKit.
function withWidgetExtensionTarget(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = config.modRequest.projectName;

    // Fix: Adding Swift files to the main RN target triggers Swift/ObjC interop.
    // The ObjC bridge imports <React/RCTBridgeModule.h> which causes
    // -Wnon-modular-include-in-framework-module errors. This build setting suppresses them.
    const dominated = /_comment$/;
    const configs = Object.keys(project.pbxXCBuildConfigurationSection())
      .filter((k) => !dominated.test(k))
      .reduce((acc, k) => {
        acc[k] = project.pbxXCBuildConfigurationSection()[k];
        return acc;
      }, {});
    for (const key in configs) {
      const bs = configs[key].buildSettings;
      if (bs && bs["PRODUCT_NAME"]) {
        bs["CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES"] = "YES";
      }
    }

    // Add native module files to main target (same pattern as VoIP plugin)
    const nativeFiles = [
      { name: "DVNTLiveActivityModule.swift", type: "sourcecode.swift" },
      { name: "DVNTLiveActivityBridge.m", type: "sourcecode.c.objc" },
      { name: "DVNTLiveAttributes.swift", type: "sourcecode.swift" },
    ];

    for (const file of nativeFiles) {
      const hasFile = project.hasFile(`${projectName}/${file.name}`);
      if (!hasFile) {
        const fileRefUuid = project.generateUuid();
        const buildFileUuid = project.generateUuid();

        project.addToPbxFileReferenceSection({
          fileRef: fileRefUuid,
          basename: file.name,
          path: `${projectName}/${file.name}`,
          sourceTree: '"<group>"',
          fileEncoding: 4,
          lastKnownFileType: file.type,
          group: projectName,
        });

        project.addToPbxBuildFileSection({
          uuid: buildFileUuid,
          fileRef: fileRefUuid,
          basename: file.name,
          group: projectName,
        });

        project.addToPbxSourcesBuildPhase({
          uuid: buildFileUuid,
          fileRef: fileRefUuid,
          basename: file.name,
          group: projectName,
        });

        const mainGroupKey = project.findPBXGroupKey({ name: projectName });
        if (mainGroupKey) {
          project.addToPbxGroup(
            { fileRef: fileRefUuid, basename: file.name },
            mainGroupKey,
          );
        }
      }
    }

    console.log(
      `[with-live-activity] Added native module files to main target`,
    );
    return config;
  });
}

module.exports = {
  withLiveActivityInfoPlist,
  withAppGroupsEntitlement,
  withLiveActivitySwiftFiles,
  withWidgetExtensionTarget,
};
