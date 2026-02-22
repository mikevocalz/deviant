/**
 * Expo Config Plugin: Fix Voltra VoltraWidget pod path for pnpm
 *
 * pnpm creates symlinks in node_modules/ that point to .pnpm/ store.
 * Expo autolinking resolves the real path, but Voltra's Podfile block uses
 * the symlink path. CocoaPods rejects duplicate sources for the same pod.
 * This plugin patches the Podfile to resolve symlinks via .realpath.
 */

const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withFixVoltraPnpmPodfile(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );

      if (!fs.existsSync(podfilePath)) return config;

      let contents = fs.readFileSync(podfilePath, "utf-8");

      // Replace the symlink-unaware dirname with realpath-aware version
      contents = contents.replace(
        /podspec_dir_path = File\.dirname\(node_modules_podspec\)/g,
        "podspec_dir_path = File.dirname(Pathname.new(node_modules_podspec).realpath.to_path)"
      );

      // Also resolve __dir__ with realpath for consistent relative path calculation
      contents = contents.replace(
        /\.relative_path_from\(Pathname\.new\(__dir__\)\)\.to_path/g,
        ".relative_path_from(Pathname.new(__dir__).realpath).to_path"
      );

      fs.writeFileSync(podfilePath, contents, "utf-8");
      console.log("[fix-voltra-pnpm] Patched Podfile for pnpm symlink resolution");

      return config;
    },
  ]);
}

module.exports = withFixVoltraPnpmPodfile;
