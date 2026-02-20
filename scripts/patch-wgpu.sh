#!/usr/bin/env bash
# patch-wgpu.sh
# Fixes header collisions between react-native-wgpu and @shopify/react-native-skia.
#
# Problem: Both packages share identically-named headers (NativeObject.h, Promise.h,
# EnumMapper.h, RuntimeAwareCache.h, RuntimeLifecycleMonitor.h, JSIConverter.h).
# CocoaPods flattens all private headers into Pods/Headers/Private/<pod>/, and the
# Xcode project-level header map can resolve bare #include "X.h" to the WRONG pod's
# copy, causing 'utils/RNSkLog.h' file not found errors.
#
# Fix: Qualify all includes of colliding headers so they bypass the header map:
#   - Cross-directory includes (rnwgpu/ → jsi/): use "jsi/X.h"
#   - Same-directory includes (jsi/ → jsi/): use "./X.h"
# Qualified includes don't match bare-filename hmap keys, so they resolve via
# -I search paths ($(PODS_TARGET_SRCROOT)/cpp) to wgpu's own headers.

set -euo pipefail

WGPU_DIR="node_modules/react-native-wgpu"

if [ ! -d "$WGPU_DIR/cpp" ]; then
  echo "[patch-wgpu] WARNING: $WGPU_DIR/cpp not found, skipping"
  exit 0
fi

# Skip if already patched (check for our marker)
if [ -f "$WGPU_DIR/.wgpu-headers-patched" ]; then
  echo "[patch-wgpu] Already patched, skipping"
  exit 0
fi

echo "[patch-wgpu] Patching header includes to avoid Skia collisions..."

# ── Step 1: Rename JSIConverter.h → WGPUJSIConverter.h ──
if [ -f "$WGPU_DIR/cpp/jsi/JSIConverter.h" ]; then
  mv "$WGPU_DIR/cpp/jsi/JSIConverter.h" "$WGPU_DIR/cpp/jsi/WGPUJSIConverter.h"
  echo "[patch-wgpu] Renamed JSIConverter.h → WGPUJSIConverter.h"
fi

# ── Step 2: Fix all includes in wgpu source files ──
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
        # Bare include → qualified
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

# ── Step 3: Write marker file ──
touch "$WGPU_DIR/.wgpu-headers-patched"
echo "[patch-wgpu] Done"
