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
        "Podfile",
      );
      let podfile = fs.readFileSync(podfilePath, "utf8");

      const snippet = `
    # [fix-wgpu-headers] Add wgpu's cpp/ to HEADER_SEARCH_PATHS so qualified
    # includes like "jsi/WGPUJSIConverter.h" resolve to wgpu's own headers.
    installer.pods_project.targets.each do |t|
      next unless t.name == 'react-native-wgpu'
      t.build_configurations.each do |config|
        existing = config.build_settings['HEADER_SEARCH_PATHS'] || '$(inherited)'
        existing = [existing] if existing.is_a?(String)
        existing << '"$(PODS_TARGET_SRCROOT)/cpp"' unless existing.any? { |p| p.include?('PODS_TARGET_SRCROOT)/cpp"') }
        config.build_settings['HEADER_SEARCH_PATHS'] = existing
      end
    end`;

      // Inject just before the closing '  end' of the post_install block (after react_native_post_install)
      if (!podfile.includes("[fix-wgpu-headers]")) {
        const marker = "\n  end\nend";
        const idx = podfile.lastIndexOf(marker);
        if (idx !== -1) {
          podfile =
            podfile.slice(0, idx) +
            snippet +
            marker +
            podfile.slice(idx + marker.length);
        }
      }

      fs.writeFileSync(podfilePath, podfile, "utf8");
      return config;
    },
  ]);
}

module.exports = withFixWgpuHeaders;
