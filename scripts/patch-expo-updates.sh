#!/usr/bin/env bash
# patch-expo-updates.sh
# Fix 1: expo-updates@55.0.7 compilation error with RN 0.84.
#   The module imports expo.modules.rncompatibility.ReactNativeFeatureFlags which doesn't exist.
#   Replace with com.facebook.react.internal.featureflags.ReactNativeFeatureFlags
#   and change property access to method call (enableBridgelessArchitecture -> enableBridgelessArchitecture())
#
# Fix 2: iOS 26 beta crash — ExpoUpdatesReactDelegateHandler.bundleURL returns nil when
#   AppController is in DisabledAppController state (DB init fails on iOS 26 sandbox path change).
#   RCTRootViewFactory force-unwraps the URL → brk 1 / EXC_BREAKPOINT crash at launch.
#   Fix: fall back to Bundle.main main.jsbundle when launchAssetUrl() returns nil.

set -euo pipefail

PROCEDURES_PATTERN="expo-updates@*/node_modules/expo-updates/android/src/main/java/expo/modules/updates/procedures"

found=0
for dir in node_modules/.pnpm/$PROCEDURES_PATTERN; do
  [ -d "$dir" ] || continue
  found=1

  for kt in "$dir"/RelaunchProcedure.kt "$dir"/RestartReactAppExtensions.kt "$dir"/StartupProcedure.kt; do
    [ -f "$kt" ] || continue

    # Skip if already patched
    if grep -q "com.facebook.react.internal.featureflags.ReactNativeFeatureFlags" "$kt" 2>/dev/null; then
      echo "[patch-expo-updates] Already patched: $(basename "$kt")"
      continue
    fi

    # Replace import
    sed -i.bak 's/import expo\.modules\.rncompatibility\.ReactNativeFeatureFlags/import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags/' "$kt"
    # Replace property access with method call (enableBridgelessArchitecture -> enableBridgelessArchitecture())
    sed -i.bak 's/ReactNativeFeatureFlags\.enableBridgelessArchitecture\b/ReactNativeFeatureFlags.enableBridgelessArchitecture()/g' "$kt"
    # Clean up backup files
    rm -f "$kt.bak"

    echo "[patch-expo-updates] Patched: $(basename "$kt")"
  done
done

if [ "$found" -eq 0 ]; then
  echo "[patch-expo-updates] WARNING: No expo-updates procedures dir found to patch"
fi

# ── Fix 2: iOS 26 beta crash — bundleURL returns nil when DisabledAppController is used ──
IOS_DELEGATE_PATTERN="expo-updates@*/node_modules/expo-updates/ios/EXUpdates/ReactDelegateHandler/ExpoUpdatesReactDelegateHandler.swift"

for swift in node_modules/.pnpm/$IOS_DELEGATE_PATTERN; do
  [ -f "$swift" ] || continue

  # Skip if already patched (check for filesystem probe approach)
  if grep -q "FileManager.default.fileExists" "$swift" 2>/dev/null; then
    echo "[patch-expo-updates] iOS bundleURL fallback already patched (filesystem probe)"
    continue
  fi

  # Replace bundleURL with a filesystem-probe fallback.
  # Bundle(url:) requires the bundle to already be loaded — unreliable at launch.
  # FileManager.default.fileExists works on raw paths and is always reliable.
  python3 - "$swift" <<'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, 'r') as f:
    src = f.read()

new = """  public override func bundleURL(reactDelegate: ExpoReactDelegate) -> URL? {
    // Happy path: controller already started and has a launch URL.
    if let url = AppController.sharedInstance.launchAssetUrl() {
      return url
    }
    // iOS 26 fallback: DB init failed -> DisabledAppController was created but start() has NOT
    // been called yet (createReactRootView returned early on !isActiveController).
    // We must NOT call controller.start() here -- it has a precondition(!isStarted) guard.
    // Instead, directly probe the filesystem for the embedded JS bundle.
    //
    // Actual IPA layout: main.jsbundle is at DVNT.app/main.jsbundle
    // EXUpdates.bundle only contains app.manifest for this project.
    let mainBundlePath = Bundle.main.bundlePath
    let candidates: [(String, String)] = [
      (EmbeddedAppLoader.EXUpdatesEmbeddedBundleFilename, EmbeddedAppLoader.EXUpdatesEmbeddedBundleFileType),
      (EmbeddedAppLoader.EXUpdatesBareEmbeddedBundleFilename, EmbeddedAppLoader.EXUpdatesBareEmbeddedBundleFileType)
    ]
    let fm = FileManager.default
    // 1) EXUpdates.bundle/app.bundle (shallow)
    let exUpdatesBundlePath = (mainBundlePath as NSString).appendingPathComponent("EXUpdates.bundle")
    for (name, ext) in candidates {
      let filePath = ((exUpdatesBundlePath as NSString).appendingPathComponent(name) as NSString).appendingPathExtension(ext) ?? ""
      if fm.fileExists(atPath: filePath) { return URL(fileURLWithPath: filePath) }
    }
    // 2) Bundle root (main.jsbundle lives here in Expo managed + bare RN builds)
    for (name, ext) in candidates {
      let filePath = ((mainBundlePath as NSString).appendingPathComponent(name) as NSString).appendingPathExtension(ext) ?? ""
      if fm.fileExists(atPath: filePath) { return URL(fileURLWithPath: filePath) }
    }
    return nil
  }"""

# Match any existing bundleURL implementation (original or previously patched)
pattern = r'  public override func bundleURL\(reactDelegate: ExpoReactDelegate\) -> URL\? \{.*?\n  \}'
new_src, count = re.subn(pattern, new, src, count=1, flags=re.DOTALL)
if count:
    with open(path, 'w') as f:
        f.write(new_src)
    print("[patch-expo-updates] Patched iOS ExpoUpdatesReactDelegateHandler.swift bundleURL (filesystem probe)")
else:
    print("[patch-expo-updates] WARNING: bundleURL pattern not found in ExpoUpdatesReactDelegateHandler.swift")
PYEOF

done

# ── Fix 3: AppController.initializeWithoutStarting — call start() on DisabledAppController ──
# When DisabledAppController is created (DB init failure), start() must be called immediately
# so launchAssetUrl() is populated before bundleURL() is invoked by RCTRootViewFactory.
IOS_CONTROLLER_PATTERN="expo-updates@*/node_modules/expo-updates/ios/EXUpdates/AppController.swift"

for swift in node_modules/.pnpm/$IOS_CONTROLLER_PATTERN; do
  [ -f "$swift" ] || continue

  # AppController patch: no eager start() — bundleURL probes bundle locations directly.
  # (Calling start() eagerly caused a precondition(!isStarted) crash when start() was
  # called a second time by the normal createReactRootView flow.)
  if grep -q "bundleURL probes bundle" "$swift" 2>/dev/null; then
    echo "[patch-expo-updates] AppController already patched (no-op)"
    continue
  fi

  python3 - "$swift" <<'PYEOF'
import sys

path = sys.argv[1]
with open(path, 'r') as f:
    src = f.read()

# Revert any previous eager start() patch back to stock — bundleURL handles the fallback directly.
old_eager1 = """        let disabledController = DisabledAppController(error: cause)
        // iOS 26: start() immediately so launchAssetUrl() is populated before bundleURL() is called.
        // Without this, bundleURL returns nil and RCTRootViewFactory crashes with brk 1.
        disabledController.start()
        _sharedInstance = disabledController
        UpdatesControllerRegistry.sharedInstance.controller = _sharedInstance as? (any UpdatesInterface)
        return"""

stock1 = """        let disabledController = DisabledAppController(error: cause)
        _sharedInstance = disabledController
        UpdatesControllerRegistry.sharedInstance.controller = _sharedInstance as? (any UpdatesInterface)
        return"""

old_eager2 = """      let disabledController = DisabledAppController(error: nil)
      // iOS 26: start() immediately so launchAssetUrl() is populated before bundleURL() is called.
      disabledController.start()
      _sharedInstance = disabledController"""

stock2 = """      let disabledController = DisabledAppController(error: nil)
      _sharedInstance = disabledController"""

patched = False
if old_eager1 in src:
    src = src.replace(old_eager1, stock1)
    patched = True
if old_eager2 in src:
    src = src.replace(old_eager2, stock2)
    patched = True

# Add marker comment so skip-check works on subsequent runs
src = src.replace(
    "      _sharedInstance = disabledController\n    }",
    "      _sharedInstance = disabledController\n      // bundleURL probes bundle locations directly — no eager start() needed\n    }",
    1
)

if patched:
    with open(path, 'w') as f:
        f.write(src)
    print("[patch-expo-updates] Reverted eager start() from AppController.swift (bundleURL handles fallback)")
else:
    print("[patch-expo-updates] AppController.swift already at stock (no eager start patch present)")
PYEOF

done

# ── Fix 4: AppLauncherNoDatabase — try app.bundle (Expo managed) before main.jsbundle (bare) ──
IOS_LAUNCHER_PATTERN="expo-updates@*/node_modules/expo-updates/ios/EXUpdates/AppLauncher/AppLauncherNoDatabase.swift"

for swift in node_modules/.pnpm/$IOS_LAUNCHER_PATTERN; do
  [ -f "$swift" ] || continue

  if grep -q "EXUpdates.bundle" "$swift" 2>/dev/null; then
    echo "[patch-expo-updates] AppLauncherNoDatabase already patched"
    continue
  fi

  python3 - "$swift" <<'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, 'r') as f:
    src = f.read()

# Pattern 1: original bare Bundle.main lookup (fresh install)
old1 = """  public func launchUpdate() {
    precondition(assetFilesMap == nil, "assetFilesMap should be null for embedded updates")
    launchAssetUrl = Bundle.main.url(
      forResource: EmbeddedAppLoader.EXUpdatesBareEmbeddedBundleFilename,
      withExtension: EmbeddedAppLoader.EXUpdatesBareEmbeddedBundleFileType
    )
  }"""

new = """  public func launchUpdate() {
    precondition(assetFilesMap == nil, "assetFilesMap should be null for embedded updates")
    // In Expo managed builds the JS bundle lives inside EXUpdates.bundle (a resource bundle
    // embedded in the EXUpdates framework), NOT directly in Bundle.main.
    // Search order: EXUpdates.bundle -> Bundle.main (bare RN fallback).
    let candidates: [(String, String)] = [
      (EmbeddedAppLoader.EXUpdatesEmbeddedBundleFilename, EmbeddedAppLoader.EXUpdatesEmbeddedBundleFileType),
      (EmbeddedAppLoader.EXUpdatesBareEmbeddedBundleFilename, EmbeddedAppLoader.EXUpdatesBareEmbeddedBundleFileType)
    ]
    // 1) Try EXUpdates.bundle (Expo managed workflow)
    let frameworkBundle = Bundle(for: EmbeddedAppLoader.self)
    if let resourceUrl = frameworkBundle.resourceURL,
       let exUpdatesBundle = Bundle(url: resourceUrl.appendingPathComponent("EXUpdates.bundle")) {
      for (name, ext) in candidates {
        if let url = exUpdatesBundle.url(forResource: name, withExtension: ext) {
          launchAssetUrl = url
          return
        }
      }
    }
    // 2) Fallback: Bundle.main (bare RN workflow)
    for (name, ext) in candidates {
      if let url = Bundle.main.url(forResource: name, withExtension: ext) {
        launchAssetUrl = url
        return
      }
    }
  }"""

if old1 in src:
    src = src.replace(old1, new)
    with open(path, 'w') as f:
        f.write(src)
    print("[patch-expo-updates] Patched AppLauncherNoDatabase.swift (EXUpdates.bundle lookup)")
elif "Try Expo managed bundle" in src:
    # Old patch present but uses Bundle.main — rewrite the launchUpdate method
    pattern = r'(  public func launchUpdate\(\) \{).*?(  \})'
    new_src, count = re.subn(pattern, new, src, count=1, flags=re.DOTALL)
    if count:
        with open(path, 'w') as f:
            f.write(new_src)
        print("[patch-expo-updates] Re-patched AppLauncherNoDatabase.swift (EXUpdates.bundle lookup)")
    else:
        print("[patch-expo-updates] WARNING: Could not re-patch AppLauncherNoDatabase launchUpdate")
else:
    print("[patch-expo-updates] WARNING: AppLauncherNoDatabase pattern not found")
PYEOF

done
