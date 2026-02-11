/**
 * Expo Config Plugin: Swift 5 Compatibility
 *
 * Adds a post_install hook to the Podfile that forces all pods to use
 * Swift 5 language mode and disables strict concurrency checking.
 *
 * This is needed because ExpoModulesCore (and other Expo pods) are not yet
 * compatible with Swift 6 strict concurrency. Xcode 16.x defaults to Swift 6
 * for some targets, causing build failures with errors like:
 *   - "capture of 'X' with non-sendable type in a @Sendable closure"
 *   - "main actor-isolated property cannot be referenced from nonisolated context"
 *   - "unknown attribute 'MainActor'"
 */

const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const POST_INSTALL_SNIPPET = `
    # ── Swift 5 compatibility for Expo pods ──────────────────────────
    # ExpoModulesCore is not yet Swift 6 strict-concurrency safe.
    # Force Swift 5 language mode and minimal concurrency checking.
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['SWIFT_VERSION'] ||= '5.0'
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
        config.build_settings['OTHER_SWIFT_FLAGS'] ||= ['$(inherited)']
        unless config.build_settings['OTHER_SWIFT_FLAGS'].include?('-swift-version')
          config.build_settings['OTHER_SWIFT_FLAGS'] << ' -swift-version 5'
        end
      end
    end`;

function withSwift5Compat(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );

      let podfile = fs.readFileSync(podfilePath, "utf8");

      const marker = "# ── Swift 5 compatibility for Expo pods";

      if (!podfile.includes(marker)) {
        // Append to existing post_install block, or create one
        if (podfile.includes("post_install do |installer|")) {
          // Insert our snippet right after the post_install opening line
          podfile = podfile.replace(
            /post_install do \|installer\|/,
            `post_install do |installer|${POST_INSTALL_SNIPPET}`
          );
        } else {
          // No post_install block exists — add one at the end
          podfile += `\npost_install do |installer|${POST_INSTALL_SNIPPET}\nend\n`;
        }

        fs.writeFileSync(podfilePath, podfile, "utf8");
        console.log("[with-swift5-compat] Added Swift 5 compatibility to Podfile");
      }

      return config;
    },
  ]);
}

module.exports = withSwift5Compat;
