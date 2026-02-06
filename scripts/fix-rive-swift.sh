#!/bin/bash
# Fix @rive-app/react-native Nitrogen-generated Swift files for Swift 5.9+
# Protocol composition typealiases used as types require 'any' prefix.
# e.g. "self is HybridRiveViewSpec" → "self is any HybridRiveViewSpec"
# e.g. "self as! HybridRiveViewSpec" → "self as! any HybridRiveViewSpec"

RIVE_SWIFT_DIRS=$(find node_modules/.pnpm -path "*/@rive-app/react-native/nitrogen/generated/ios/swift" -type d 2>/dev/null)

if [ -z "$RIVE_SWIFT_DIRS" ]; then
  echo "[fix-rive-swift] @rive-app/react-native not found, skipping."
  exit 0
fi

echo "$RIVE_SWIFT_DIRS" | while IFS= read -r dir; do
  echo "[fix-rive-swift] Patching Swift existential types in $dir"

  # Fix "self is HybridXxxSpec " (followed by space) and "self as! HybridXxxSpec)"
  # (followed by closing paren) — the two exact patterns from Nitrogen codegen.
  # Skip lines already containing "any ".
  # Use perl for reliable cross-platform regex support.
  find "$dir" -name "*.swift" -exec perl -pi -e '
    next if /\bany\s+Hybrid/;
    s/self is (Hybrid\w+Spec)(\s)/self is any $1$2/g;
    s/self as! (Hybrid\w+Spec)(\))/self as! any $1$2/g;
  ' {} +
done

echo "[fix-rive-swift] Done."
