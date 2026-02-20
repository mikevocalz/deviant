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
    # [fix-wgpu-headers] Disable header maps for react-native-wgpu only.
    # Must run AFTER react_native_post_install to avoid being overwritten.
    installer.pods_project.targets.each do |t|
      next unless t.name == 'react-native-wgpu'
      t.build_configurations.each do |config|
        config.build_settings['USE_HEADERMAP'] = 'NO'
        config.build_settings['ALWAYS_SEARCH_USER_PATHS'] = 'NO'
      end
    end`;

      // Inject just before the closing '  end' of the post_install block.
      // post_install uses 2-space indent, so its closing line is '\n  end'.
      // We must inject AFTER react_native_post_install so settings aren't overwritten.
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
