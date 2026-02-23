/**
 * Expo Config Plugin: Fix MapLibre SPM leak into Widget Extension
 *
 * Problem: $MLRN.post_install(installer) from @maplibre/maplibre-react-native
 * adds MapLibre SPM to ALL native targets in the Xcode project, including
 * DVNTHomeWidgetExtension. The widget is pure SwiftUI and doesn't use MapLibre,
 * but dyld tries to load it at extension launch → instant DYLD crash:
 *   "Library not loaded: @rpath/MapLibre.framework/MapLibre"
 *
 * Fix: Use withXcodeProject to directly strip MapLibre XCSwiftPackageProductDependency
 * from the widget extension target in project.pbxproj. This runs AFTER all other
 * plugins (including MLRN) have modified the project.
 *
 * The previous Ruby-based Podfile approach was ineffective because MapLibre is
 * linked as an SPM dependency in the Xcode project, not as a CocoaPods dependency.
 */

const { withXcodeProject } = require("expo/config-plugins");

const WIDGET_TARGET = "DVNTHomeWidgetExtension";

function withFixWidgetMaplibre(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const pbxNativeTargets = project.hash.project.objects["PBXNativeTarget"];
    const spmDeps =
      project.hash.project.objects["XCSwiftPackageProductDependency"] || {};

    // Find the widget extension target
    for (const [uuid, target] of Object.entries(pbxNativeTargets)) {
      if (typeof target !== "object" || target.name !== WIDGET_TARGET) continue;

      const deps = target.packageProductDependencies || [];
      const before = deps.length;

      // Find and remove MapLibre dependency references
      const maplibreUUIDs = [];
      target.packageProductDependencies = deps.filter((ref) => {
        // ref can be { value: 'UUID', comment: 'MapLibre' } or just a string UUID
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

      // Also remove the XCSwiftPackageProductDependency entries themselves
      for (const depUUID of maplibreUUIDs) {
        delete spmDeps[depUUID];
        // Remove comment key too (pbxproj stores "UUID_comment" keys)
        delete spmDeps[depUUID + "_comment"];
      }

      const after = target.packageProductDependencies.length;
      if (before !== after) {
        console.log(
          `[fix-widget-maplibre] Removed MapLibre SPM from ${WIDGET_TARGET} (${before} -> ${after} deps)`,
        );
      }
    }

    return config;
  });
}

module.exports = withFixWidgetMaplibre;
