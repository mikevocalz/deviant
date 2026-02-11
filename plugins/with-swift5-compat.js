/**
 * Expo Config Plugin: Swift 5.9 Compatibility
 *
 * expo-modules-core@55.0.8 sets swift_version = '6.0' in its podspec,
 * but the code isn't fully Swift 6 compliant — strict concurrency is
 * always enforced as ERRORS in Swift 6 language mode (the
 * SWIFT_STRICT_CONCURRENCY build setting is IGNORED in Swift 6 mode).
 *
 * This plugin:
 * 1. Patches the ExpoModulesCore podspec: swift_version '6.0' → '5.9'
 * 2. Patches 2 source files that use Swift 6-only "@MainActor" on
 *    conformances syntax (not available in Swift 5.9)
 * 3. Adds a post_install hook setting SWIFT_STRICT_CONCURRENCY=minimal
 *    for Expo pods (this setting IS respected in Swift 5.9 mode)
 */

const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ── Source patches ──────────────────────────────────────────────────
// These files use `@MainActor` on protocol conformances, which is
// Swift 6-only syntax. We rewrite them to Swift 5.9-compatible form.
const SOURCE_PATCHES = [
  {
    // SwiftUIHostingView.swift:45
    // FROM: ExpoView, @MainActor AnyExpoSwiftUIHostingView
    // TO:   ExpoView, AnyExpoSwiftUIHostingView
    glob: "ios/Core/Views/SwiftUI/SwiftUIHostingView.swift",
    find: ", @MainActor AnyExpoSwiftUIHostingView",
    replace: ", AnyExpoSwiftUIHostingView",
  },
  {
    // ViewDefinition.swift:125
    // FROM: extension UIView: @MainActor AnyArgument
    // TO:   extension UIView: AnyArgument
    glob: "ios/Core/Views/ViewDefinition.swift",
    find: "extension UIView: @MainActor AnyArgument",
    replace: "extension UIView: AnyArgument",
  },
];

// ── Podfile post_install snippet ────────────────────────────────────
const POST_INSTALL_SNIPPET = `
    # ── Swift 5.9 compat: disable strict concurrency for Expo pods ──
    # ExpoModulesCore podspec patched to swift_version='5.9'.
    # SWIFT_STRICT_CONCURRENCY=minimal is respected in Swift 5.9 mode
    # (unlike Swift 6 mode where it is always 'complete').
    installer.pods_project.targets.each do |target|
      next unless target.name.start_with?('Expo') || target.name == 'EXUpdates'
      target.build_configurations.each do |config|
        config.build_settings['SWIFT_VERSION'] = '5.9'
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
      end
    end`;

function findExpoModulesCoreDir(projectRoot) {
  // Try common locations
  const candidates = [
    path.join(projectRoot, "node_modules", "expo-modules-core"),
    path.join(projectRoot, "node_modules", ".pnpm"),
  ];

  // Direct node_modules path
  if (fs.existsSync(candidates[0])) {
    return candidates[0];
  }

  // pnpm: find via glob
  try {
    const result = execSync(
      `find "${projectRoot}/node_modules" -path "*/expo-modules-core/ExpoModulesCore.podspec" -maxdepth 5 2>/dev/null | head -1`,
      { encoding: "utf8" },
    ).trim();
    if (result) {
      return path.dirname(result);
    }
  } catch (e) {
    // ignore
  }

  return null;
}

function patchPodspec(emcDir) {
  const podspecPath = path.join(emcDir, "ExpoModulesCore.podspec");
  if (!fs.existsSync(podspecPath)) return false;

  let content = fs.readFileSync(podspecPath, "utf8");
  if (content.includes("s.swift_version  = '6.0'")) {
    content = content.replace(
      "s.swift_version  = '6.0'",
      "s.swift_version  = '5.9'",
    );
    fs.writeFileSync(podspecPath, content, "utf8");
    console.log(
      "[with-swift5-compat] Patched podspec: swift_version 6.0 → 5.9",
    );
    return true;
  } else if (content.includes("s.swift_version = '6.0'")) {
    content = content.replace(
      "s.swift_version = '6.0'",
      "s.swift_version = '5.9'",
    );
    fs.writeFileSync(podspecPath, content, "utf8");
    console.log(
      "[with-swift5-compat] Patched podspec: swift_version 6.0 → 5.9",
    );
    return true;
  }
  console.log(
    "[with-swift5-compat] Podspec already patched or different format",
  );
  return false;
}

function patchSourceFiles(emcDir) {
  for (const patch of SOURCE_PATCHES) {
    const filePath = path.join(emcDir, patch.glob);
    if (!fs.existsSync(filePath)) {
      console.log(`[with-swift5-compat] Source file not found: ${patch.glob}`);
      continue;
    }
    let content = fs.readFileSync(filePath, "utf8");
    if (content.includes(patch.find)) {
      content = content.replace(patch.find, patch.replace);
      fs.writeFileSync(filePath, content, "utf8");
      console.log(
        `[with-swift5-compat] Patched ${patch.glob}: removed @MainActor from conformance`,
      );
    } else {
      console.log(
        `[with-swift5-compat] ${patch.glob}: already patched or pattern not found`,
      );
    }
  }
}

function injectPodfileHook(podfilePath) {
  let podfile = fs.readFileSync(podfilePath, "utf8");

  const marker = "# ── Swift 5.9 compat: disable strict concurrency";

  if (podfile.includes(marker)) return;

  const lines = podfile.split("\n");
  let insertIndex = -1;

  // Strategy 1: Find react_native_post_install(...) and insert AFTER
  const startIdx = lines.findIndex((l) =>
    l.includes("react_native_post_install("),
  );
  if (startIdx !== -1) {
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

  // Strategy 2: Insert before closing 'end' of post_install block
  if (insertIndex === -1) {
    const postInstallIdx = lines.findIndex((l) =>
      l.includes("post_install do |installer|"),
    );
    if (postInstallIdx !== -1) {
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
    podfile += `\npost_install do |installer|\n${POST_INSTALL_SNIPPET}\nend\n`;
  }

  fs.writeFileSync(podfilePath, podfile, "utf8");
  console.log("[with-swift5-compat] Injected Podfile post_install hook");
}

function withSwift5Compat(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const projectRoot = config.modRequest.projectRoot;

      // 1. Find expo-modules-core
      const emcDir = findExpoModulesCoreDir(projectRoot);
      if (emcDir) {
        // 2. Patch podspec
        patchPodspec(emcDir);
        // 3. Patch source files
        patchSourceFiles(emcDir);
      } else {
        console.warn(
          "[with-swift5-compat] Could not find expo-modules-core directory!",
        );
      }

      // 4. Inject Podfile hook
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );
      injectPodfileHook(podfilePath);

      return config;
    },
  ]);
}

module.exports = withSwift5Compat;
