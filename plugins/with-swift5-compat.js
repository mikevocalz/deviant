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
    # ── Disable strict concurrency for Expo pods ─────────────────────
    # ExpoModulesCore.podspec sets swift_version = '6.0' which makes
    # concurrency violations hard errors. Force Swift 5.9 (supports
    # @MainActor, async/await, etc.) with minimal concurrency checking.
    # MUST run AFTER react_native_post_install to override its settings.
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['SWIFT_VERSION'] = '5.9'
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
        # Strip any -swift-version 6 flags that may have been injected
        flags = config.build_settings['OTHER_SWIFT_FLAGS'] || ''
        config.build_settings['OTHER_SWIFT_FLAGS'] = flags.gsub(/-swift-version\\s+\\S+/, '')
      end
    end`;

function withSwift5Compat(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );

      let podfile = fs.readFileSync(podfilePath, "utf8");

      const marker = "# ── Disable strict concurrency for Expo pods";

      if (!podfile.includes(marker)) {
        const lines = podfile.split("\n");
        let insertIndex = -1;

        // Strategy 1: Find react_native_post_install(...) call and insert AFTER its closing )
        const startIdx = lines.findIndex((l) =>
          l.includes("react_native_post_install("),
        );
        if (startIdx !== -1) {
          // Track parens to find the matching close
          let depth = 0;
          for (let i = startIdx; i < lines.length; i++) {
            for (const ch of lines[i]) {
              if (ch === "(") depth++;
              if (ch === ")") depth--;
            }
            if (depth <= 0) {
              insertIndex = i + 1;
              break;
            }
          }
        }

        // Strategy 2: Insert before the closing 'end' of post_install block
        if (insertIndex === -1) {
          const postInstallIdx = lines.findIndex((l) =>
            l.includes("post_install do |installer|"),
          );
          if (postInstallIdx !== -1) {
            // Find the 'end' that closes the post_install block
            for (let i = lines.length - 1; i > postInstallIdx; i--) {
              if (lines[i].trim() === "end") {
                insertIndex = i;
                break;
              }
            }
          }
        }

        if (insertIndex !== -1) {
          lines.splice(insertIndex, 0, POST_INSTALL_SNIPPET);
          podfile = lines.join("\n");
        } else {
          // No post_install block — create one at the end
          podfile += `\npost_install do |installer|\n${POST_INSTALL_SNIPPET}\nend\n`;
        }

        fs.writeFileSync(podfilePath, podfile, "utf8");
        console.log(
          "[with-swift5-compat] Added Swift 5 compatibility to Podfile (after react_native_post_install)",
        );
      }

      return config;
    },
  ]);
}

module.exports = withSwift5Compat;
