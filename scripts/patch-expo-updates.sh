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

  # Skip if already patched
  if grep -q "Fall back to the embedded JS bundle" "$swift" 2>/dev/null; then
    echo "[patch-expo-updates] iOS bundleURL fallback already patched"
    continue
  fi

  # Replace the one-liner bundleURL with a nil-safe fallback version
  python3 - "$swift" <<'PYEOF'
import sys

path = sys.argv[1]
with open(path, 'r') as f:
    src = f.read()

old = """  public override func bundleURL(reactDelegate: ExpoReactDelegate) -> URL? {
    AppController.sharedInstance.launchAssetUrl()
  }"""

new = """  public override func bundleURL(reactDelegate: ExpoReactDelegate) -> URL? {
    // When the controller is disabled (e.g. DB init failed on iOS 26 beta sandbox path change),
    // launchAssetUrl() returns nil because start() was never called (createReactRootView bailed
    // early on !isActiveController). Fall back to the embedded JS bundle to prevent the
    // preconditionFailure / brk 1 crash in RCTRootViewFactory.
    if let url = AppController.sharedInstance.launchAssetUrl() {
      return url
    }
    return Bundle.main.url(
      forResource: "main",
      withExtension: "jsbundle"
    )
  }"""

if old not in src:
    print("[patch-expo-updates] WARNING: iOS bundleURL pattern not found — may already be patched or version changed")
    sys.exit(0)

src = src.replace(old, new)
with open(path, 'w') as f:
    f.write(src)
print("[patch-expo-updates] Patched iOS ExpoUpdatesReactDelegateHandler.swift bundleURL fallback")
PYEOF

done
