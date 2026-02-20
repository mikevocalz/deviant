#!/usr/bin/env bash
# patch-expo-factory.sh
# Fixes expo@55.0.0-preview.11 for react-native 0.84 API changes.
#
# RN 0.84 changed RCTRootViewFactory.viewWithModuleName to require
# bundleConfiguration: parameter and made devMenuConfiguration: non-optional.
#
# Patches:
#   1. ExpoReactNativeFactory.swift — add bundleConfiguration:, unwrap devMenuConfiguration
#   2. EXReactRootViewFactory.mm    — add bundleConfiguration: to [super ...] calls and
#                                     superViewWithModuleName: implementation
#   3. EXReactRootViewFactory.h     — add bundleConfiguration: to superView declaration +
#                                     forward-declare RCTBundleConfiguration

set -euo pipefail

EXPO_IOS="node_modules/expo/ios/AppDelegates"

if [ ! -d "$EXPO_IOS" ]; then
  echo "[patch-expo-factory] WARNING: $EXPO_IOS not found, skipping"
  exit 0
fi

# Idempotency check
if grep -q 'bundleConfiguration: .defaultConfiguration()' "$EXPO_IOS/ExpoReactNativeFactory.swift" 2>/dev/null; then
  echo "[patch-expo-factory] Already patched, skipping"
  exit 0
fi

python3 - "$EXPO_IOS" <<'PYEOF'
import sys, os

base = sys.argv[1]
errors = []

# ── 1. ExpoReactNativeFactory.swift ──
swift_path = os.path.join(base, "ExpoReactNativeFactory.swift")
with open(swift_path, 'r') as f:
    swift = f.read()

# 1a. Fix the else branch: rootViewFactory.view() — add bundleConfiguration, unwrap devMenuConfiguration
swift = swift.replace(
    """      rootView = rootViewFactory.view(
        withModuleName: moduleName ?? defaultModuleName,
        initialProperties: initialProps,
        launchOptions: launchOptions,
        devMenuConfiguration: self.devMenuConfiguration
      )""",
    """      rootView = rootViewFactory.view(
        withModuleName: moduleName ?? defaultModuleName,
        initialProperties: initialProps,
        launchOptions: launchOptions,
        bundleConfiguration: .defaultConfiguration(),
        devMenuConfiguration: self.devMenuConfiguration ?? .defaultConfiguration()
      )"""
)

# 1b. Fix the if branch: factory.superView() — add bundleConfiguration, unwrap devMenuConfiguration
swift = swift.replace(
    """      rootView = factory.superView(
        withModuleName: moduleName ?? defaultModuleName,
        initialProperties: initialProps,
        launchOptions: launchOptions ?? [:],
        devMenuConfiguration: self.devMenuConfiguration
      )""",
    """      rootView = factory.superView(
        withModuleName: moduleName ?? defaultModuleName,
        initialProperties: initialProps,
        launchOptions: launchOptions ?? [:],
        bundleConfiguration: .defaultConfiguration(),
        devMenuConfiguration: self.devMenuConfiguration ?? .defaultConfiguration()
      )"""
)

if 'bundleConfiguration: .defaultConfiguration()' not in swift:
    errors.append("ExpoReactNativeFactory.swift: patterns not found")
else:
    with open(swift_path, 'w') as f:
        f.write(swift)
    print("[patch-expo-factory] Patched ExpoReactNativeFactory.swift")

# ── 2. EXReactRootViewFactory.mm ──
mm_path = os.path.join(base, "EXReactRootViewFactory.mm")
with open(mm_path, 'r') as f:
    mm = f.read()

# 2a. Fix [super viewWithModuleName:... devMenuConfiguration:] calls — add bundleConfiguration:
mm = mm.replace(
    "return [super viewWithModuleName:moduleName initialProperties:initialProperties launchOptions:launchOptions devMenuConfiguration:devMenuConfiguration];",
    "return [super viewWithModuleName:moduleName initialProperties:initialProperties launchOptions:launchOptions bundleConfiguration:[RCTBundleConfiguration defaultConfiguration] devMenuConfiguration:devMenuConfiguration];"
)

# 2b. Fix superViewWithModuleName: implementation — add bundleConfiguration: parameter
mm = mm.replace(
    """- (UIView *)superViewWithModuleName:(NSString *)moduleName
                  initialProperties:(nullable NSDictionary *)initialProperties
                      launchOptions:(nullable NSDictionary *)launchOptions
               devMenuConfiguration:(nullable RCTDevMenuConfiguration *)devMenuConfiguration
{
  if (devMenuConfiguration == nil) {
    devMenuConfiguration = [RCTDevMenuConfiguration defaultConfiguration];
  }""",
    """- (UIView *)superViewWithModuleName:(NSString *)moduleName
                  initialProperties:(nullable NSDictionary *)initialProperties
                      launchOptions:(nullable NSDictionary *)launchOptions
              bundleConfiguration:(nullable RCTBundleConfiguration *)bundleConfiguration
               devMenuConfiguration:(nullable RCTDevMenuConfiguration *)devMenuConfiguration
{
  if (bundleConfiguration == nil) {
    bundleConfiguration = [RCTBundleConfiguration defaultConfiguration];
  }
  if (devMenuConfiguration == nil) {
    devMenuConfiguration = [RCTDevMenuConfiguration defaultConfiguration];
  }"""
)

if 'bundleConfiguration' not in mm:
    errors.append("EXReactRootViewFactory.mm: patterns not found")
else:
    with open(mm_path, 'w') as f:
        f.write(mm)
    print("[patch-expo-factory] Patched EXReactRootViewFactory.mm")

# ── 3. EXReactRootViewFactory.h ──
h_path = os.path.join(base, "EXReactRootViewFactory.h")
with open(h_path, 'r') as f:
    h = f.read()

# 3a. Add forward declaration for RCTBundleConfiguration
if '@class RCTBundleConfiguration;' not in h:
    h = h.replace('@class EXReactDelegate;', '@class EXReactDelegate;\n@class RCTBundleConfiguration;')

# 3b. Add bundleConfiguration: to superViewWithModuleName declaration
h = h.replace(
    """- (UIView *)superViewWithModuleName:(NSString *)moduleName
                  initialProperties:(nullable NSDictionary *)initialProperties
                      launchOptions:(nullable NSDictionary *)launchOptions
               devMenuConfiguration:(nullable RCTDevMenuConfiguration *)devMenuConfiguration;""",
    """- (UIView *)superViewWithModuleName:(NSString *)moduleName
                  initialProperties:(nullable NSDictionary *)initialProperties
                      launchOptions:(nullable NSDictionary *)launchOptions
              bundleConfiguration:(nullable RCTBundleConfiguration *)bundleConfiguration
               devMenuConfiguration:(nullable RCTDevMenuConfiguration *)devMenuConfiguration;"""
)

if 'bundleConfiguration' not in h:
    errors.append("EXReactRootViewFactory.h: patterns not found")
else:
    with open(h_path, 'w') as f:
        f.write(h)
    print("[patch-expo-factory] Patched EXReactRootViewFactory.h")

if errors:
    for e in errors:
        print(f"[patch-expo-factory] ERROR: {e}")
    sys.exit(1)

print("[patch-expo-factory] Done")
PYEOF
