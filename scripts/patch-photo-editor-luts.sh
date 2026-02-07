#!/bin/bash
# Patch @baronha/react-native-photo-editor to add .cube LUT filter support
# Copies new native files and overwrites modified files for LUT integration
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LUT_FILES_DIR="$SCRIPT_DIR/photo-editor-lut-files"

patch_package() {
  local pkg_dir="$1"
  local label="$2"

  # --- iOS ---
  local ios_filter_dir="$pkg_dir/ios/FilterColorCube"
  if [ -d "$ios_filter_dir" ]; then
    cp "$LUT_FILES_DIR/ios/CubeLUTLoader.swift" "$ios_filter_dir/CubeLUTLoader.swift"
    echo "[patch-luts] $label iOS: CubeLUTLoader.swift"
  fi

  local ios_zlfilter_dir="$pkg_dir/ios/ZLImageEditor/Sources/General"
  if [ -d "$ios_zlfilter_dir" ]; then
    cp "$LUT_FILES_DIR/ios/ZLFilter.swift" "$ios_zlfilter_dir/ZLFilter.swift"
    echo "[patch-luts] $label iOS: ZLFilter.swift (cube LUT loading)"
  fi

  # --- Android ---
  local android_filter_dir="$pkg_dir/android/src/main/java/com/reactnativephotoeditor/activity/filters"
  if [ -d "$android_filter_dir" ]; then
    cp "$LUT_FILES_DIR/android/CubeLUTParser.kt" "$android_filter_dir/CubeLUTParser.kt"
    cp "$LUT_FILES_DIR/android/FilterListener.java" "$android_filter_dir/FilterListener.java"
    cp "$LUT_FILES_DIR/android/FilterViewAdapter.kt" "$android_filter_dir/FilterViewAdapter.kt"
    echo "[patch-luts] $label Android: CubeLUTParser.kt, FilterListener.java, FilterViewAdapter.kt"
  fi

  local android_activity_dir="$pkg_dir/android/src/main/java/com/reactnativephotoeditor/activity"
  if [ -d "$android_activity_dir" ]; then
    cp "$LUT_FILES_DIR/android/PhotoEditorActivity.kt" "$android_activity_dir/PhotoEditorActivity.kt"
    echo "[patch-luts] $label Android: PhotoEditorActivity.kt (LUT handler)"
  fi

  local android_assets_dir="$pkg_dir/android/src/main/assets/luts"
  mkdir -p "$android_assets_dir"
}

# Patch direct node_modules installation
for pkg_dir in $(find node_modules -path "*/@baronha/react-native-photo-editor" -type d -not -path "*/node_modules/.pnpm/*" 2>/dev/null); do
  patch_package "$pkg_dir" ""
done

# Patch pnpm virtual store
for pkg_dir in $(find node_modules/.pnpm -path "*/@baronha/react-native-photo-editor@*/node_modules/@baronha/react-native-photo-editor" -type d 2>/dev/null); do
  patch_package "$pkg_dir" "(pnpm)"
done

echo "[patch-luts] Done"
