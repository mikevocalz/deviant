/**
 * Expo Config Plugin: AppController.initializeWithoutStarting() before React launch
 *
 * Prevents "AppController.sharedInstance was called before the module was initialized"
 * crash. ExpoUpdatesReactDelegateHandler (and others) access AppController during
 * bundleURL() before it's initialized. Must call initializeWithoutStarting() first.
 * See: https://github.com/expo/expo/issues/32650
 */

const { withDangerousMod } = require("expo/config-plugins");
const path = require("path");
const fs = require("fs");

function withAppControllerInit(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const appName = config.modRequest.projectName || "DVNT";
      const appDelegatePath = path.join(
        config.modRequest.platformProjectRoot,
        appName,
        "AppDelegate.swift"
      );

      if (!fs.existsSync(appDelegatePath)) {
        console.warn("[withAppControllerInit] AppDelegate.swift not found, skipping");
        return config;
      }

      let content = fs.readFileSync(appDelegatePath, "utf8");

      const initBlock = `    // CRITICAL: Initialize AppController before React starts. Otherwise ExpoUpdatesReactDelegateHandler
    // (and others) access AppController.sharedInstance during bundleURL() → assertion crash.
    // See: https://github.com/expo/expo/issues/32650
    AppController.initializeWithoutStarting()
    // Must call start() when using factory.startReactNative() directly — otherwise createReactRootView
    // is never invoked, startupProcedure stays nil, and getConstantsForModule() crashes on JS init.
    let controller = AppController.sharedInstance
    if controller.isActiveController {
      controller.start()
    }

`;

      if (!content.includes("import EXUpdates") && !content.includes("internal import EXUpdates")) {
        content = content.replace(
          /(internal import Expo\r?\n)/,
          "$1internal import EXUpdates\n"
        );
      }

      let modified = false;

      // Case 1: Has init but missing controller.start() — add start block after init
      if (
        content.includes("AppController.initializeWithoutStarting()") &&
        !content.includes("controller.start()")
      ) {
        content = content.replace(
          /(AppController\.initializeWithoutStarting\(\)\s*\n)(\s*let delegate)/,
          `$1    let controller = AppController.sharedInstance
    if controller.isActiveController {
      controller.start()
    }

$2`
        );
        modified = true;
      }

      // Case 2: No init yet — insert full block
      if (!content.includes("AppController.initializeWithoutStarting()")) {
        content = content.replace(
          /(didFinishLaunchingWithOptions launchOptions: \[UIApplication\.LaunchOptionsKey: Any\]\? = nil\s*\) -> Bool \{\s*\n)(\s*let delegate)/,
          `$1${initBlock}$2`
        );
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(appDelegatePath, content);
      }
      return config;
    },
  ]);
}

module.exports = withAppControllerInit;
