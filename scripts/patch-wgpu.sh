#!/usr/bin/env bash
# patch-wgpu.sh
# Fixes header collisions between react-native-wgpu and @shopify/react-native-skia.
#
# Problem 1: Both packages share identically-named headers (NativeObject.h, Promise.h,
# EnumMapper.h, RuntimeAwareCache.h, RuntimeLifecycleMonitor.h, JSIConverter.h).
# CocoaPods flattens all private headers into Pods/Headers/Private/<pod>/, and the
# Xcode project-level header map can resolve bare #include "X.h" to the WRONG pod's
# copy, causing 'utils/RNSkLog.h' file not found errors.
#
# Problem 2: Both packages define WebGPUView class causing duplicate symbol linker errors.
#
# Fix: Qualify all includes of colliding headers and rename WebGPUView to WGPUWebGPUView.

set -euo pipefail

WGPU_DIR="${WGPU_DIR:-node_modules/react-native-wgpu}"
PATCH_MARKER=".wgpu-patched-v3"

if [ ! -d "$WGPU_DIR/cpp" ]; then
  echo "[patch-wgpu] WARNING: $WGPU_DIR/cpp not found, skipping"
  exit 0
fi

# Skip if already patched (check for our marker)
if [ -f "$WGPU_DIR/$PATCH_MARKER" ]; then
  echo "[patch-wgpu] Already patched, skipping"
  exit 0
fi

echo "[patch-wgpu] Patching react-native-wgpu to avoid Skia conflicts..."

# ── Step 1: Rename JSIConverter.h → WGPUJSIConverter.h ──
if [ -f "$WGPU_DIR/cpp/jsi/JSIConverter.h" ]; then
  mv "$WGPU_DIR/cpp/jsi/JSIConverter.h" "$WGPU_DIR/cpp/jsi/WGPUJSIConverter.h"
  echo "[patch-wgpu] Renamed JSIConverter.h → WGPUJSIConverter.h"
fi

# ── Step 2: Patch only the symbols needed for the WGPU/Skia view collision ──
echo "[patch-wgpu] Normalizing WebGPUView symbols for react-native-wgpu..."

python3 - "$WGPU_DIR" <<'PYEOF'
import json
import os
import sys

wgpu = sys.argv[1]


def rename_if_needed(src: str, dst: str) -> bool:
    if os.path.exists(src) and not os.path.exists(dst):
        os.rename(src, dst)
        return True
    return False


def replace_text(path: str, replacements) -> bool:
    if not os.path.exists(path):
        return False
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    original = content
    for old, new in replacements:
        content = content.replace(old, new)
    if content != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    return False


changed = 0
renamed = 0

# Undo the old over-eager file renames for JS entrypoints if they already exist.
renamed += rename_if_needed(
    os.path.join(wgpu, "src", "WGPUWebGPUViewNativeComponent.ts"),
    os.path.join(wgpu, "src", "WebGPUViewNativeComponent.ts"),
)
renamed += rename_if_needed(
    os.path.join(wgpu, "src", "WGPUWebGPUViewNativeComponent.web.ts"),
    os.path.join(wgpu, "src", "WebGPUViewNativeComponent.web.ts"),
)

# Rename only the iOS native view files to avoid class/header collisions with Skia.
renamed += rename_if_needed(
    os.path.join(wgpu, "apple", "WebGPUView.mm"),
    os.path.join(wgpu, "apple", "WGPUWebGPUView.mm"),
)
renamed += rename_if_needed(
    os.path.join(wgpu, "apple", "WebGPUView.h"),
    os.path.join(wgpu, "apple", "WGPUWebGPUView.h"),
)

# Keep JS module filenames stable, but normalize any doubled prefixes left by old patches.
path_normalizations = [
    ("WGPUWGPUWGPUWebGPUViewNativeComponent", "WebGPUViewNativeComponent"),
    ("WGPUWGPUWebGPUViewNativeComponent", "WebGPUViewNativeComponent"),
]
for root, _, files in os.walk(wgpu):
    for name in files:
        if not name.endswith((".ts", ".tsx", ".js", ".d.ts")):
            continue
        if replace_text(os.path.join(root, name), path_normalizations):
            changed += 1

# Ensure codegen uses the unique native component name on React Native.
codegen_files = [
    os.path.join(wgpu, "src", "WebGPUViewNativeComponent.ts"),
    os.path.join(wgpu, "lib", "commonjs", "WebGPUViewNativeComponent.js"),
    os.path.join(wgpu, "lib", "module", "WebGPUViewNativeComponent.js"),
]
for file in codegen_files:
    if replace_text(
        file,
        [
            ('codegenNativeComponent<NativeProps>("WebGPUView")', 'codegenNativeComponent<NativeProps>("WGPUWebGPUView")'),
            ('codegenNativeComponent("WebGPUView")', 'codegenNativeComponent("WGPUWebGPUView")'),
            ("codegenNativeComponent<NativeProps>('WebGPUView')", "codegenNativeComponent<NativeProps>('WGPUWebGPUView')"),
            ("codegenNativeComponent('WebGPUView')", "codegenNativeComponent('WGPUWebGPUView')"),
        ],
    ):
        changed += 1

# Update the package's iOS component provider mapping so generated Fabric types use WGPU names.
package_json = os.path.join(wgpu, "package.json")
if os.path.exists(package_json):
    with open(package_json, "r", encoding="utf-8") as f:
        package = json.load(f)
    provider = (
        package.setdefault("codegenConfig", {})
        .setdefault("ios", {})
        .setdefault("componentProvider", {})
    )
    expected = {"WGPUWebGPUView": "WGPUWebGPUView"}
    if provider != expected:
        package["codegenConfig"]["ios"]["componentProvider"] = expected
        with open(package_json, "w", encoding="utf-8") as f:
            json.dump(package, f, indent=2)
            f.write("\n")
        changed += 1

# Patch the native iOS view implementation to match the WGPU Fabric symbols.
ios_replacements = [
    ('#import "WebGPUView.h"', '#import "WGPUWebGPUView.h"'),
    ("@interface WebGPUView", "@interface WGPUWebGPUView"),
    ("@implementation WebGPUView", "@implementation WGPUWebGPUView"),
    ("concreteComponentDescriptorProvider<WebGPUViewComponentDescriptor>()", "concreteComponentDescriptorProvider<WGPUWebGPUViewComponentDescriptor>()"),
    ("std::static_pointer_cast<const WebGPUViewProps>", "std::static_pointer_cast<const WGPUWebGPUViewProps>"),
    ("Class<RCTComponentViewProtocol> WGPUWGPUWebGPUViewCls(void)", "Class<RCTComponentViewProtocol> WGPUWebGPUViewCls(void)"),
    ("Class<RCTComponentViewProtocol> WebGPUViewCls(void)", "Class<RCTComponentViewProtocol> WGPUWebGPUViewCls(void)"),
    ("return WebGPUView.class;", "return WGPUWebGPUView.class;"),
]
for file in [
    os.path.join(wgpu, "apple", "WGPUWebGPUView.mm"),
    os.path.join(wgpu, "apple", "WGPUWebGPUView.h"),
]:
    if replace_text(file, ios_replacements):
        changed += 1

print(f"[patch-wgpu] Renamed {renamed} files")
print(f"[patch-wgpu] Updated {changed} files")
PYEOF

# ── Step 3: Fix all includes in wgpu source files ──
# Use python3 for reliable cross-platform in-place editing
python3 - "$WGPU_DIR" <<'PYEOF'
import os, sys, re

wgpu = sys.argv[1]
cpp_dir = os.path.join(wgpu, "cpp")

# Colliding headers that exist in both wgpu (cpp/jsi/) and Skia
COLLIDING = {
    "NativeObject.h",
    "Promise.h",
    "EnumMapper.h",
    "RuntimeAwareCache.h",
    "RuntimeLifecycleMonitor.h",
    "JSIConverter.h",      # renamed but fix any stale refs
    "WGPUJSIConverter.h",  # the renamed version
}

def is_in_jsi_dir(filepath):
    """Check if file is inside cpp/jsi/ (same directory as colliding headers)."""
    rel = os.path.relpath(filepath, cpp_dir)
    parts = rel.split(os.sep)
    return len(parts) >= 2 and parts[0] == "jsi"

count = 0

for root, dirs, files in os.walk(cpp_dir):
    for fname in files:
        if not (fname.endswith(".h") or fname.endswith(".cpp")):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath, "r") as f:
            content = f.read()
        original = content
        in_jsi = is_in_jsi_dir(fpath)

        # ── Fix JSIConverter.h references ──
        if '#include "JSIConverter.h"' in content:
            if in_jsi:
                content = content.replace('#include "JSIConverter.h"', '#include "./WGPUJSIConverter.h"')
            else:
                content = content.replace('#include "JSIConverter.h"', '#include "jsi/WGPUJSIConverter.h"')

        # Already-qualified jsi/JSIConverter.h → jsi/WGPUJSIConverter.h
        content = content.replace('#include "jsi/JSIConverter.h"', '#include "jsi/WGPUJSIConverter.h"')

        # ── Fix WGPUJSIConverter.h references (ensure proper qualification) ──
        if '#include "WGPUJSIConverter.h"' in content:
            if in_jsi:
                content = content.replace('#include "WGPUJSIConverter.h"', '#include "./WGPUJSIConverter.h"')
            else:
                content = content.replace('#include "WGPUJSIConverter.h"', '#include "jsi/WGPUJSIConverter.h"')

        # ── Fix NativeObject.h ──
        if '#include "NativeObject.h"' in content:
            if in_jsi:
                content = content.replace('#include "NativeObject.h"', '#include "./NativeObject.h"')
            else:
                content = content.replace('#include "NativeObject.h"', '#include "jsi/NativeObject.h"')

        # ── Fix Promise.h ──
        if '#include "Promise.h"' in content:
            if in_jsi:
                content = content.replace('#include "Promise.h"', '#include "./Promise.h"')
            else:
                content = content.replace('#include "Promise.h"', '#include "jsi/Promise.h"')

        # ── Fix EnumMapper.h ──
        if '#include "EnumMapper.h"' in content:
            if in_jsi:
                content = content.replace('#include "EnumMapper.h"', '#include "./EnumMapper.h"')
            else:
                content = content.replace('#include "EnumMapper.h"', '#include "jsi/EnumMapper.h"')

        # ── Fix RuntimeAwareCache.h ──
        if '#include "RuntimeAwareCache.h"' in content:
            if in_jsi:
                content = content.replace('#include "RuntimeAwareCache.h"', '#include "./RuntimeAwareCache.h"')
            else:
                content = content.replace('#include "RuntimeAwareCache.h"', '#include "jsi/RuntimeAwareCache.h"')

        # ── Fix RuntimeLifecycleMonitor.h ──
        if '#include "RuntimeLifecycleMonitor.h"' in content:
            if in_jsi:
                content = content.replace('#include "RuntimeLifecycleMonitor.h"', '#include "./RuntimeLifecycleMonitor.h"')
            else:
                content = content.replace('#include "RuntimeLifecycleMonitor.h"', '#include "jsi/RuntimeLifecycleMonitor.h"')

        # ── Prevent double-qualification (e.g. "jsi/jsi/X.h" or "././X.h") ──
        content = content.replace('"jsi/jsi/', '"jsi/')
        content = content.replace('"././', '"./')

        if content != original:
            with open(fpath, "w") as f:
                f.write(content)
            count += 1

print(f"[patch-wgpu] Patched {count} files")
PYEOF

# ── Step 4: Write marker file ──
rm -f "$WGPU_DIR/.wgpu-headers-patched" "$WGPU_DIR/.wgpu-patched-v2"
touch "$WGPU_DIR/$PATCH_MARKER"
echo "[patch-wgpu] Done"
