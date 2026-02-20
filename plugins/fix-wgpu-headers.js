/**
 * Expo Config Plugin: Fix react-native-wgpu header collision with @shopify/react-native-skia
 *
 * Both packages ship a file named JSIConverter.h. Xcode's header map flattens them,
 * causing wgpu's #include "JSIConverter.h" to resolve to Skia's copy (which then
 * fails looking for utils/RNSkLog.h).
 *
 * Fix: In the post_install hook, disable header maps for the wgpu target only
 * and add its own cpp/jsi/ subdirectory to HEADER_SEARCH_PATHS so the compiler
 * finds wgpu's JSIConverter.h via standard include resolution.
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withFixWgpuHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let podfile = fs.readFileSync(podfilePath, "utf8");

      const snippet = `
    # [fix-wgpu-headers] Disable header maps for react-native-wgpu to prevent
    # JSIConverter.h name collision with @shopify/react-native-skia.
    installer.pods_project.targets.each do |target|
      if target.name == 'react-native-wgpu'
        target.build_configurations.each do |config|
          config.build_settings['USE_HEADERMAP'] = 'NO'
          paths = config.build_settings['HEADER_SEARCH_PATHS'] || ['$(inherited)']
          paths = [paths] if paths.is_a?(String)
          paths << '"$(PODS_TARGET_SRCROOT)/cpp"' unless paths.any? { |p| p.include?('PODS_TARGET_SRCROOT)/cpp"') }
          paths << '"$(PODS_TARGET_SRCROOT)/cpp/jsi"' unless paths.any? { |p| p.include?('cpp/jsi') }
          config.build_settings['HEADER_SEARCH_PATHS'] = paths
        end
      end
    end`;

      // Inject right after the post_install opener
      const hook = "post_install do |installer|";
      if (podfile.includes(hook) && !podfile.includes("[fix-wgpu-headers]")) {
        podfile = podfile.replace(hook, hook + snippet);
      }

      fs.writeFileSync(podfilePath, podfile, "utf8");
      return config;
    },
  ]);
}

module.exports = withFixWgpuHeaders;
