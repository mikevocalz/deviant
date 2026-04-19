#!/bin/bash
# Patch react-native-vision-camera for Swift 6.1 / Xcode 16.3+ compatibility
# Fixes: 'type any Error has no member error' - dot-syntax throws fail when compiler
# cannot infer RuntimeError from context (untyped throws, closures, Promise.async blocks)
# Fix: replace all `throw .error(` with explicit `throw RuntimeError.error(` everywhere

set -e

echo "Patching react-native-vision-camera for Swift 6.1 compatibility..."

VISION_CAMERA_DIR="node_modules/react-native-vision-camera/ios"

if [ ! -d "$VISION_CAMERA_DIR" ]; then
    echo "react-native-vision-camera not found. Skipping patch."
    exit 0
fi

# Cross-platform sed helper
sedi() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

# Step 1: Normalize - replace any remaining `throw RuntimeError.error(` with `throw .error(`
# so Step 2 can uniformly replace all `throw .error(` with the explicit form.
find "$VISION_CAMERA_DIR" -name "*.swift" -type f | while read -r swift_file; do
    if grep -q "throw RuntimeError\.error(" "$swift_file" 2>/dev/null; then
        sedi 's/throw RuntimeError\.error(/throw .error(/g' "$swift_file"
    fi
done

# Step 2: Replace ALL `throw .error(` with `throw RuntimeError.error(` in every Swift file.
# This makes the error type explicit so Swift 6.1 doesn't fail on type inference
# in untyped `throws`, closures, and Promise.async blocks.
find "$VISION_CAMERA_DIR" -name "*.swift" -type f | while read -r swift_file; do
    if grep -q "throw \.error(" "$swift_file" 2>/dev/null; then
        sedi 's/throw \.error(/throw RuntimeError.error(/g' "$swift_file"
        echo "Patched $(basename "$swift_file")"
    fi
done

# Step 3: Fix `'nil' is not compatible with closure result type 'any NativeCameraOutput'`
# in ConstraintResolver.swift - the compactMap closure needs an explicit nil type annotation.
CONSTRAINT_RESOLVER="$VISION_CAMERA_DIR/Hybrid Objects/Constraints/ConstraintResolver.swift"
if [ -f "$CONSTRAINT_RESOLVER" ]; then
    # Only replace the `return nil` inside the compactMap that returns NativeCameraOutput
    sedi 's/case is any NativePreviewViewOutput:/case is any NativePreviewViewOutput: \/\/ swiftlint:disable:next nil_return/' "$CONSTRAINT_RESOLVER"
    sedi '/swiftlint:disable:next nil_return/{
n
s/return nil/return nil as (any NativeCameraOutput)?/
}' "$CONSTRAINT_RESOLVER"
    echo "Patched ConstraintResolver.swift (nil type annotation)"
fi

echo "Vision Camera Swift 6.1 patch applied successfully!"
