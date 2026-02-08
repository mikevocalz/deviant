#!/bin/bash
# Patch @baronha/react-native-photo-editor core fixes:
# - Fix currentActivity for RN 0.81 compatibility
# - Add initialTool support
# - Remove pinned SDWebImage versions
# - Fix JS module exports
set +e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

patch_package() {
  local pkg_dir="$1"
  local label="$2"

  # --- Android: Fix currentActivity for RN 0.81 ---
  local module_kt="$pkg_dir/android/src/main/java/com/reactnativephotoeditor/PhotoEditorModule.kt"
  if [ -f "$module_kt" ]; then
    # Replace currentActivity with reactApplicationContext.getCurrentActivity()
    sed -i.bak 's/val activity = currentActivity/val activity = reactApplicationContext.getCurrentActivity()/' "$module_kt" 2>/dev/null || true
    rm -f "${module_kt}.bak"
    echo "[patch-photo-editor-core] $label Android: PhotoEditorModule.kt (currentActivity fix)"
  fi

  # --- iOS: Fix SDWebImage version pins ---
  local podspec="$pkg_dir/react-native-photo-editor.podspec"
  if [ -f "$podspec" ]; then
    sed -i.bak "s/s.dependency \"SDWebImage\", \"~> 5.11.1\"/s.dependency \"SDWebImage\"/" "$podspec" 2>/dev/null || true
    sed -i.bak "s/s.dependency 'SDWebImageWebPCoder', '~> 0.8.4'/s.dependency 'SDWebImageWebPCoder'/" "$podspec" 2>/dev/null || true
    rm -f "${podspec}.bak"
    echo "[patch-photo-editor-core] $label iOS: podspec (unpinned SDWebImage)"
  fi

  # --- iOS: Add initialTool to ZLImageEditorConfiguration ---
  local config_swift="$pkg_dir/ios/ZLImageEditor/Sources/General/ZLImageEditorConfiguration.swift"
  if [ -f "$config_swift" ]; then
    if ! grep -q "initialTool" "$config_swift" 2>/dev/null; then
      perl -i -pe 's/(public var textStickerDefaultTextColor.*)/$1\n\n    \/\/\/ Initial tool to auto-select when editor opens (text, stickers, draw, filter)\n    \@objc public var initialTool: String? = nil/' "$config_swift" 2>/dev/null || true
      echo "[patch-photo-editor-core] $label iOS: ZLImageEditorConfiguration.swift (initialTool)"
    fi
  fi

  # --- iOS: Add initialTool to PhotoEditor.swift ---
  local editor_swift="$pkg_dir/ios/PhotoEditor.swift"
  if [ -f "$editor_swift" ]; then
    # Fix broken concatenation from previous sed append (two statements on one line)
    if grep -q "initialTool = initialTool.*self\.reject" "$editor_swift" 2>/dev/null; then
      perl -i -pe 's/(initialTool = initialTool)\s+(self\.reject)/$1\n        $2/' "$editor_swift" 2>/dev/null || true
      echo "[patch-photo-editor-core] $label iOS: PhotoEditor.swift (repaired broken line)"
    fi
    if ! grep -q "initialTool" "$editor_swift" 2>/dev/null; then
      perl -i -pe 's/(self\.resolve = resolve;)/$1\n\n        let initialTool = options["initialTool"] as? String\n        ZLImageEditorConfiguration.default().initialTool = initialTool/' "$editor_swift" 2>/dev/null || true
      echo "[patch-photo-editor-core] $label iOS: PhotoEditor.swift (initialTool)"
    fi
  fi

  # --- JS: Fix module exports ---
  local cjs_index="$pkg_dir/lib/commonjs/index.js"
  if [ -f "$cjs_index" ]; then
    if grep -q "sourceMappingURL=index.js.mapt" "$cjs_index" 2>/dev/null; then
      cat > "$cjs_index" << 'CJSEOF'
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.default = void 0;

var _reactNative = require('react-native');

const { PhotoEditor } = _reactNative.NativeModules;

const defaultOptions = {
  stickers: [],
};

const exportObject = {
  open: (optionsEditor) => {
    const options = { ...defaultOptions, ...optionsEditor };
    return new Promise(async (resolve, reject) => {
      try {
        const response = await PhotoEditor.open(options);
        resolve(response);
      } catch (e) {
        reject(e);
      }
    });
  },
};
var _default = exportObject;
exports.default = _default;
CJSEOF
      echo "[patch-photo-editor-core] $label JS: commonjs/index.js (fixed exports)"
    fi
  fi

  local esm_index="$pkg_dir/lib/module/index.js"
  if [ -f "$esm_index" ]; then
    if grep -q "sourceMappingURL=index.js.map stickers" "$esm_index" 2>/dev/null; then
      cat > "$esm_index" << 'ESMEOF'
import { NativeModules } from 'react-native';
const { PhotoEditor } = NativeModules;

const defaultOptions = {
  stickers: [],
};

const exportObject = {
  open: (optionsEditor) => {
    const options = { ...defaultOptions, ...optionsEditor };
    return new Promise(async (resolve, reject) => {
      try {
        const response = await PhotoEditor.open(options);
        resolve(response);
      } catch (e) {
        reject(e);
      }
    });
  },
};
export default exportObject;
ESMEOF
      echo "[patch-photo-editor-core] $label JS: module/index.js (fixed exports)"
    fi
  fi
}

# Patch direct node_modules installation
for pkg_dir in $(find node_modules -path "*/@baronha/react-native-photo-editor" -type d -not -path "*/node_modules/.pnpm/*" 2>/dev/null); do
  patch_package "$pkg_dir" ""
done

# Patch pnpm virtual store
for pkg_dir in $(find node_modules/.pnpm -path "*/@baronha/react-native-photo-editor@*/node_modules/@baronha/react-native-photo-editor" -type d 2>/dev/null); do
  patch_package "$pkg_dir" "(pnpm)"
done

echo "[patch-photo-editor-core] Done"
