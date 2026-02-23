/**
 * Expo Config Plugin: Fix MapLibre SPM leak into Widget Extension
 *
 * Problem: $MLRN.post_install(installer) from @maplibre/maplibre-react-native
 * adds MapLibre SPM to ALL user_targets, including DVNTHomeWidgetExtension.
 * The widget is pure SwiftUI and doesn't use MapLibre, but dyld tries to load
 * it at extension launch → instant DYLD crash:
 *   "Library not loaded: @rpath/MapLibre.framework/MapLibre"
 *
 * Fix: Inject a post_install hook in the Podfile that strips MapLibre
 * package_product_dependencies from the widget extension target AFTER
 * $MLRN.post_install runs.
 */

const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const WIDGET_TARGET = "DVNTHomeWidgetExtension";

const STRIP_SNIPPET = `
    # [fix-widget-maplibre] Strip MapLibre SPM from widget extension target.
    # $MLRN.post_install adds MapLibre to ALL user_targets including the widget,
    # which is pure SwiftUI and doesn't need it. Without this, the widget crashes
    # at launch with DYLD "Library not loaded: @rpath/MapLibre.framework/MapLibre".
    installer.aggregate_targets.group_by(&:user_project).each do |proj, _|
      proj.native_targets.each do |nt|
        next unless nt.name == '${WIDGET_TARGET}'
        before = nt.package_product_dependencies.count
        nt.package_product_dependencies.delete_if { |d| d.product_name == 'MapLibre' }
        after = nt.package_product_dependencies.count
        if before != after
          Pod::UI.puts "[fix-widget-maplibre] Removed MapLibre SPM from ${WIDGET_TARGET} (#{before} -> #{after} deps)"
        end
      end
    end`;

function withFixWidgetMaplibre(config) {
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
        console.log("[fix-widget-maplibre] Already patched, skipping");
        return config;
      }

      // Insert AFTER $MLRN.post_install(installer) line
      const mlrnMarker =
        "# @generated end @maplibre/maplibre-react-native:post-install";

      if (podfile.includes(mlrnMarker)) {
        podfile = podfile.replace(mlrnMarker, mlrnMarker + "\n" + STRIP_SNIPPET);
        console.log(
          "[fix-widget-maplibre] Injected MapLibre strip hook after $MLRN.post_install",
        );
      } else {
        // Fallback: insert before react_native_post_install
        const fallbackMarker = "react_native_post_install(";
        if (podfile.includes(fallbackMarker)) {
          podfile = podfile.replace(
            fallbackMarker,
            STRIP_SNIPPET + "\n    " + fallbackMarker,
          );
          console.log(
            "[fix-widget-maplibre] Injected MapLibre strip hook (fallback position)",
          );
        } else {
          console.error(
            "[fix-widget-maplibre] Could not find insertion point in Podfile",
          );
        }
      }

      fs.writeFileSync(podfilePath, podfile, "utf-8");
      return config;
    },
  ]);
}

module.exports = withFixWidgetMaplibre;
