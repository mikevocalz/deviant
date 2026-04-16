#!/usr/bin/env bash
# patch-expo-root-view-factory.sh
# RN 0.84+: RCTReactNativeFactory.startReactNativeWithModuleName calls the 5-param
# viewWithModuleName:initialProperties:launchOptions:bundleConfiguration:devMenuConfiguration:
# but EXReactRootViewFactory only overrides the 4-param version (without bundleConfiguration).
# This means the Expo delegate handler chain (including expo-dev-launcher) is NEVER invoked,
# RCTHost is created immediately with bundleURL() → nil → crash:
#   "No script URL provided. unsanitizedScriptURLString = (null)"
#
# Fix: Add the missing 5-param override to EXReactRootViewFactory.mm so the handler chain
# (and thus the dev launcher) is properly invoked during app boot.

set -euo pipefail

# Find expo package
EXPO_DIR=$(node -e "
  try {
    const p = require.resolve('expo/package.json');
    console.log(require('path').dirname(p));
  } catch {
    console.log('');
  }
" 2>/dev/null)

if [ -z "$EXPO_DIR" ] || [ ! -d "$EXPO_DIR" ]; then
  echo "[patch-expo-root-view-factory] WARNING: expo not found, skipping"
  exit 0
fi

TARGET="$EXPO_DIR/ios/AppDelegates/EXReactRootViewFactory.mm"

if [ ! -f "$TARGET" ]; then
  echo "[patch-expo-root-view-factory] WARNING: EXReactRootViewFactory.mm not found, skipping"
  exit 0
fi

# Check if already patched (look for our comment marker) AND that the cast is correct.
# Early versions of this patch omitted the (id<EXReactDelegateProtocol>) cast, which
# causes "receiver type EXReactDelegate is a forward declaration" build errors.
if grep -q "patched for RN 0.84" "$TARGET" 2>/dev/null; then
  if grep -q 'self.reactDelegate) createReactRootView' "$TARGET" 2>/dev/null && ! grep -q '\[self\.reactDelegate createReactRootView' "$TARGET" 2>/dev/null; then
    echo "[patch-expo-root-view-factory] Already patched, skipping"
    exit 0
  fi
  # Fix missing casts in previously-patched file
  python3 - "$TARGET" <<'FIXEOF'
import sys
from pathlib import Path
path = Path(sys.argv[1])
content = path.read_text()
old = "    return [self.reactDelegate createReactRootViewWithModuleName:moduleName initialProperties:initialProperties launchOptions:launchOptions];"
new = "    return [((id<EXReactDelegateProtocol>)self.reactDelegate) createReactRootViewWithModuleName:moduleName initialProperties:initialProperties launchOptions:launchOptions];"
count = content.count(old)
if count > 0:
    path.write_text(content.replace(old, new))
    print(f"[patch-expo-root-view-factory] Fixed {count} bare reactDelegate calls (missing protocol cast)")
else:
    print("[patch-expo-root-view-factory] Already patched correctly, skipping")
FIXEOF
  exit 0
fi

python3 - "$TARGET" <<'PYEOF'
import sys

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

# The 5-param override must be added inside the #if TARGET_OS_IOS || TARGET_OS_TV block,
# right after the existing 4-param viewWithModuleName override.

# Find the anchor: the closing brace of the existing 4-param viewWithModuleName override
# followed by the superViewWithModuleName method
anchor = """- (UIView *)superViewWithModuleName:(NSString *)moduleName
                  initialProperties:(nullable NSDictionary *)initialProperties
                      launchOptions:(nullable NSDictionary *)launchOptions
              bundleConfiguration:(nullable RCTBundleConfiguration *)bundleConfiguration
               devMenuConfiguration:(nullable RCTDevMenuConfiguration *)devMenuConfiguration
{"""

patch_block = """// patched for RN 0.84: 5-param override so Expo handler chain (dev launcher) is invoked
- (UIView *)viewWithModuleName:(NSString *)moduleName
             initialProperties:(nullable NSDictionary *)initialProperties
                 launchOptions:(nullable NSDictionary *)launchOptions
           bundleConfiguration:(RCTBundleConfiguration *)bundleConfiguration
          devMenuConfiguration:(RCTDevMenuConfiguration *)devMenuConfiguration
{
  if (self.reactDelegate != nil) {
    return [((id<EXReactDelegateProtocol>)self.reactDelegate) createReactRootViewWithModuleName:moduleName initialProperties:initialProperties launchOptions:launchOptions];
  }
  return [super viewWithModuleName:moduleName initialProperties:initialProperties launchOptions:launchOptions bundleConfiguration:bundleConfiguration devMenuConfiguration:devMenuConfiguration];
}

"""

if anchor in content:
    content = content.replace(anchor, patch_block + anchor)
    with open(path, 'w') as f:
        f.write(content)
    print("[patch-expo-root-view-factory] Patched successfully: added 5-param viewWithModuleName override")
    sys.exit(0)

# Fallback: try to insert before @end
fallback_anchor = "\n@end"
if fallback_anchor in content:
    # Need to add inside #if TARGET_OS_IOS block - find the last #endif before @end
    # Simpler: just add before @end since the method works on all platforms
    content = content.replace(fallback_anchor, "\n" + patch_block + fallback_anchor)
    with open(path, 'w') as f:
        f.write(content)
    print("[patch-expo-root-view-factory] Patched (fallback): added 5-param viewWithModuleName override before @end")
    sys.exit(0)

print("[patch-expo-root-view-factory] WARNING: Could not find anchor point, skipping")
sys.exit(0)
PYEOF
