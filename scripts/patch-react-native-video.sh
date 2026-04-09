#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PATCH_FILE="$SCRIPT_DIR/patches/react-native-video-7.0.0-beta.8.patch"
TARGET_DIR="$REPO_ROOT/node_modules/react-native-video"
TYPE_FILE="$TARGET_DIR/lib/typescript/commonjs/src/core/types/VideoInformation.d.ts"
ONLOAD_FILE="$TARGET_DIR/nitrogen/generated/android/ReactNativeVideoOnLoad.cpp"

if [ ! -d "$TARGET_DIR" ]; then
  echo "[patch-react-native-video] WARNING: $TARGET_DIR not found, skipping"
  exit 0
fi

if [ ! -f "$PATCH_FILE" ]; then
  echo "[patch-react-native-video] WARNING: $PATCH_FILE not found, skipping"
  exit 0
fi

if grep -q "duration: UInt64;" "$TYPE_FILE" 2>/dev/null && grep -q "registerAllNatives" "$ONLOAD_FILE" 2>/dev/null; then
  echo "[patch-react-native-video] Already patched, skipping"
  exit 0
fi

if ! (cd "$TARGET_DIR" && patch -p1 --dry-run --forward < "$PATCH_FILE" >/dev/null); then
  echo "[patch-react-native-video] ERROR: patch does not apply cleanly to $TARGET_DIR" >&2
  exit 1
fi

(cd "$TARGET_DIR" && patch -p1 --forward < "$PATCH_FILE" >/dev/null)
echo "[patch-react-native-video] Patched react-native-video Nitro bindings"
