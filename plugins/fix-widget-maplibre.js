/**
 * Expo Config Plugin: Fix MapLibre SPM leak into Widget Extension
 *
 * Problem: $MLRN.post_install(installer) from @maplibre/maplibre-react-native
 * iterates ALL user_targets and adds MapLibre SPM to each one, including
 * DVNTHomeWidgetExtension. The widget is pure SwiftUI and doesn't use MapLibre,
 * but dyld tries to load it at extension launch → instant DYLD crash:
 *   "Library not loaded: @rpath/MapLibre.framework/MapLibre"
 *
 * Execution order during EAS build:
 *   1. expo prebuild  → config plugins (withXcodeProject) run → writes pbxproj
 *   2. pod install    → $MLRN.post_install RE-ADDS MapLibre to widget target
 *   3. Xcode build    → widget links MapLibre → dyld crash
 *
 * Fix strategy (belt AND suspenders):
 *   A) withDangerousMod: Inject Ruby into Podfile post_install that strips
 *      MapLibre from widget target AFTER $MLRN.post_install, then calls
 *      proj.save to persist changes (CocoaPods does NOT re-save the user
 *      project after post_install hooks).
 *   B) withXcodeProject: Strip from committed pbxproj at prebuild time
 *      (handles local builds where pod install may not run).
 */

const { withXcodeProject, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const WIDGET_TARGET = "DVNTHomeWidgetExtension";

// ─── A) Podfile Ruby snippet ───────────────────────────────────────────────
// Runs inside post_install AFTER $MLRN.post_install(installer).
// Strips MapLibre SPM from the widget target, then saves the user project.
const PODFILE_STRIP_SNIPPET = `
    # [fix-widget-maplibre] Strip MapLibre SPM from widget extension.
    # $MLRN.post_install adds MapLibre to ALL user_targets — the widget
    # is pure SwiftUI and must NOT link it. proj.save is required because
    # CocoaPods does not re-save the user project after post_install.
    installer.aggregate_targets.group_by(&:user_project).each do |proj, _|
      proj.native_targets.each do |nt|
        next unless nt.name == '${WIDGET_TARGET}'
        before = nt.package_product_dependencies.count
        nt.package_product_dependencies.delete_if { |d| d.product_name == 'MapLibre' }
        after = nt.package_product_dependencies.count
        if before != after
          Pod::UI.puts "[fix-widget-maplibre] Stripped MapLibre SPM from ${WIDGET_TARGET} (#{before} -> #{after} deps)"
        end
      end
      proj.save
    end`;

function withPodfileStrip(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );

      if (!fs.existsSync(podfilePath)) {
        console.warn("[fix-widget-maplibre] Podfile not found, skipping");
        return config;
      }

      let podfile = fs.readFileSync(podfilePath, "utf-8");

      // Already patched?
      if (podfile.includes("[fix-widget-maplibre]")) {
        console.log("[fix-widget-maplibre] Podfile already patched");
        return config;
      }

      // Insert AFTER the $MLRN.post_install generated block
      const mlrnEndMarker =
        "# @generated end @maplibre/maplibre-react-native:post-install";

      if (podfile.includes(mlrnEndMarker)) {
        podfile = podfile.replace(
          mlrnEndMarker,
          mlrnEndMarker + "\n" + PODFILE_STRIP_SNIPPET,
        );
        console.log(
          "[fix-widget-maplibre] Injected strip+save after $MLRN.post_install",
        );
      } else {
        // Fallback: insert before react_native_post_install
        const fallback = "react_native_post_install(";
        if (podfile.includes(fallback)) {
          podfile = podfile.replace(
            fallback,
            PODFILE_STRIP_SNIPPET + "\n    " + fallback,
          );
          console.log(
            "[fix-widget-maplibre] Injected strip+save (fallback position)",
          );
        } else {
          console.error(
            "[fix-widget-maplibre] Could not find insertion point in Podfile!",
          );
        }
      }

      fs.writeFileSync(podfilePath, podfile, "utf-8");
      return config;
    },
  ]);
}

// ─── B) pbxproj strip (belt-and-suspenders) ────────────────────────────────
// Runs at prebuild time. Handles the committed pbxproj and local builds.
function withPbxprojStrip(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const pbxNativeTargets = project.hash.project.objects["PBXNativeTarget"];
    const spmDeps =
      project.hash.project.objects["XCSwiftPackageProductDependency"] || {};

    for (const [, target] of Object.entries(pbxNativeTargets)) {
      if (typeof target !== "object" || target.name !== WIDGET_TARGET) continue;

      const deps = target.packageProductDependencies || [];
      const before = deps.length;
      const maplibreUUIDs = [];

      target.packageProductDependencies = deps.filter((ref) => {
        const depUUID = typeof ref === "object" ? ref.value : ref;
        const depComment = typeof ref === "object" ? ref.comment : "";
        const depEntry = spmDeps[depUUID];
        const isMapLibre =
          depComment === "MapLibre" ||
          (depEntry && depEntry.productName === "MapLibre");
        if (isMapLibre) {
          maplibreUUIDs.push(depUUID);
          return false;
        }
        return true;
      });

      for (const depUUID of maplibreUUIDs) {
        delete spmDeps[depUUID];
        delete spmDeps[depUUID + "_comment"];
      }

      if (before !== deps.length) {
        console.log(
          `[fix-widget-maplibre] pbxproj: stripped MapLibre from ${WIDGET_TARGET}`,
        );
      }
    }

    return config;
  });
}

// ─── Compose both fixes ────────────────────────────────────────────────────
function withFixWidgetMaplibre(config) {
  config = withPodfileStrip(config); // A) Podfile Ruby strip + proj.save
  config = withPbxprojStrip(config); // B) pbxproj strip at prebuild time
  return config;
}

module.exports = withFixWidgetMaplibre;
