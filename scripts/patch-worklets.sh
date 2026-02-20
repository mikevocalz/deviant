#!/usr/bin/env bash
# patch-worklets.sh
# Fixes react-native-worklets CMakeLists.txt for RN >= 0.80 (Gradle 9 / NDK 27).
# HERMES_V1_ENABLED is set via target_compile_reactnative_options in RN >= 80,
# so adding it manually causes a duplicate-definition build error.
# We guard it with a version check so it only applies for RN < 80.
#
# NOTE: We use a shell script instead of a pnpm patch because pnpm encodes the
# patch hash in the directory name (patch_hash=...) which contains '=' characters
# that the prefab CLI misparses as command-line options, breaking Android builds.

set -euo pipefail

CMAKE_FILE="node_modules/react-native-worklets/android/CMakeLists.txt"

if [ ! -f "$CMAKE_FILE" ]; then
  echo "[patch-worklets] WARNING: $CMAKE_FILE not found, skipping"
  exit 0
fi

# Skip if already patched
if grep -q "REACT_NATIVE_MINOR_VERSION LESS 80" "$CMAKE_FILE" 2>/dev/null; then
  echo "[patch-worklets] Already patched, skipping"
  exit 0
fi

python3 - "$CMAKE_FILE" <<'PYEOF'
import sys

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

old = '    -DWORKLETS_FEATURE_FLAGS=\\"${WORKLETS_FEATURE_FLAGS}\\"\\\n    -DHERMES_V1_ENABLED=${HERMES_V1_ENABLED}")'
new = (
    '    -DWORKLETS_FEATURE_FLAGS=\\"${WORKLETS_FEATURE_FLAGS}\\"")\n'
    '\n'
    '# Only add HERMES_V1_ENABLED manually for RN < 80;\n'
    '# RN >= 80 sets it via target_compile_reactnative_options\n'
    'if(REACT_NATIVE_MINOR_VERSION LESS 80)\n'
    '  string(APPEND CMAKE_CXX_FLAGS " -DHERMES_V1_ENABLED=${HERMES_V1_ENABLED}")\n'
    'endif()'
)

if old in content:
    content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)
    print("[patch-worklets] Patched successfully")
    sys.exit(0)

print("[patch-worklets] WARNING: Pattern not found. Dumping relevant lines for debug:")
for i, line in enumerate(content.splitlines()):
    if 'HERMES' in line or 'FEATURE_FLAGS' in line:
        print(f"  line {i+1}: {repr(line)}")
sys.exit(1)
PYEOF
