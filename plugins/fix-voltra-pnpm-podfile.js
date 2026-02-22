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
        "Podfile",
      );

      if (!fs.existsSync(podfilePath)) return config;

      let contents = fs.readFileSync(podfilePath, "utf-8");
      const before = contents;

      // Approach 1: Insert realpath resolution right after the node_modules_podspec assignment.
      // This makes the Voltra Podfile block resolve pnpm symlinks so the path matches autolinking.
      const assignLine =
        "node_modules_podspec = File.join(project_root, 'node_modules', 'voltra', 'ios', podspec_name)";
      if (contents.includes(assignLine)) {
        contents = contents.replace(
          assignLine,
          assignLine +
            "\n  node_modules_podspec = Pathname.new(node_modules_podspec).realpath.to_path if File.exist?(node_modules_podspec)",
        );
      }

      // Approach 2 (fallback): also patch File.dirname and relative_path_from
      contents = contents.replace(
        /podspec_dir_path = File\.dirname\(node_modules_podspec\)/g,
        "podspec_dir_path = File.dirname(Pathname.new(node_modules_podspec).realpath.to_path)",
      );
      contents = contents.replace(
        /\.relative_path_from\(Pathname\.new\(__dir__\)\)\.to_path/g,
        ".relative_path_from(Pathname.new(__dir__).realpath).to_path",
      );

      if (contents !== before) {
        fs.writeFileSync(podfilePath, contents, "utf-8");
        console.log(
          "[fix-voltra-pnpm] Patched Podfile for pnpm symlink resolution",
        );
      } else {
        console.warn(
          "[fix-voltra-pnpm] WARNING: No patches applied — Voltra Podfile block not found",
        );
      }

      return config;
    },
  ]);
}

module.exports = withFixVoltraPnpmPodfile;
