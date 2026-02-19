#!/usr/bin/env bash
# patch-expo-updates.sh
# Fixes expo-updates@55.0.7 compilation error with RN 0.84.
# The module imports expo.modules.rncompatibility.ReactNativeFeatureFlags which doesn't exist.
# We replace it with the direct RN 0.84 API: com.facebook.react.internal.featureflags.ReactNativeFeatureFlags
# and change property access to method call (enableBridgelessArchitecture -> enableBridgelessArchitecture())

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
