#!/bin/bash
# Patch react-native-vision-camera for Swift 6.1 / Xcode 16.3+ compatibility
# Fixes: 'type any Error has no member error' — dot-syntax throws fail when Swift
# cannot infer RuntimeError from context (untyped throws, closures, Promise.async blocks)

set -e

VISION_CAMERA_DIR="node_modules/react-native-vision-camera/ios"

if [ ! -d "$VISION_CAMERA_DIR" ]; then
    echo "react-native-vision-camera not found. Skipping patch."
    exit 0
fi

echo "Patching react-native-vision-camera for Swift 6.1 compatibility..."

# Use Python for reliable cross-platform string replacement.
# Step 1: Replace ALL forms of throw .error( and throw RuntimeError.error( with the
#         explicit canonical form throw RuntimeError.error( so Swift 6.1 can resolve
#         the type without typed-throws inference.
# Step 2: Fix the broken RuntimeError("msg") form that lacks .error(withMessage:)
#         — this can appear if a previous patch applied incorrectly.
# Step 3: Fix nil type annotation in ConstraintResolver.swift compactMap closure.

python3 - "$VISION_CAMERA_DIR" <<'PYEOF'
import os, sys, re

ios_dir = sys.argv[1]

for root, dirs, files in os.walk(ios_dir):
    for fname in files:
        if not fname.endswith('.swift'):
            continue
        path = os.path.join(root, fname)
        with open(path, 'r', encoding='utf-8') as f:
            original = f.read()

        text = original

        # Fix 1: throw .error( → throw RuntimeError.error(
        text = text.replace('throw .error(', 'throw RuntimeError.error(')

        # Fix 2: throw RuntimeError("msg") → throw RuntimeError.error(withMessage: "msg")
        # This handles the malformed form produced by corrupt patches.
        text = re.sub(
            r'throw RuntimeError\(("(?:[^"\\]|\\.)*")\)',
            r'throw RuntimeError.error(withMessage: \1)',
            text
        )

        if text != original:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(text)
            print(f'Patched {fname}')

# Fix 3: nil return type annotation in ConstraintResolver.swift compactMap closure
cr = os.path.join(ios_dir, 'Hybrid Objects/Constraints/ConstraintResolver.swift')
if os.path.exists(cr):
    with open(cr, 'r', encoding='utf-8') as f:
        text = f.read()
    fixed = text.replace(
        'case is any NativePreviewViewOutput:\n        return nil',
        'case is any NativePreviewViewOutput:\n        return nil as (any NativeCameraOutput)?'
    )
    if fixed != text:
        with open(cr, 'w', encoding='utf-8') as f:
            f.write(fixed)
        print('Patched ConstraintResolver.swift (nil type annotation)')

PYEOF

echo "Vision Camera Swift 6.1 patch applied successfully!"
