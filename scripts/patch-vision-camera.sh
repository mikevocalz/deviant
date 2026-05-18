#!/usr/bin/env bash
# Patches two bugs in react-native-vision-camera that cause iOS build failures:
#
#  1. CMVideoDimensions+penalty.swift — ambiguous use of 'abs' when CoreMedia headers
#     are in scope (C abs vs Swift.abs). Fixed by qualifying as Swift.abs().
#
#  2. ResolvableConstraint+ResolutionBiasConstraint.swift — RuntimeError is a @frozen enum
#     with no direct initializer; must use RuntimeError.error(withMessage:) not RuntimeError("…").

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/node_modules/react-native-vision-camera"

if [ ! -d "$TARGET_DIR" ]; then
  echo "[patch-vision-camera] WARNING: $TARGET_DIR not found, skipping"
  exit 0
fi

PENALTY_FILE="$TARGET_DIR/ios/Extensions/CoreMedia/CMVideoDimensions+penalty.swift"
RUNTIME_FILE="$TARGET_DIR/ios/Hybrid Objects/Constraints/ResolvableConstraint/ResolvableConstraint+ResolutionBiasConstraint.swift"

# ── Patch 1: ambiguous abs() ──────────────────────────────────────────────────
if [ -f "$PENALTY_FILE" ]; then
  if grep -q "Swift\.abs(" "$PENALTY_FILE" 2>/dev/null; then
    echo "[patch-vision-camera] CMVideoDimensions+penalty.swift already patched"
  else
    python3 - "$PENALTY_FILE" <<'PYEOF'
import sys
from pathlib import Path

path = Path(sys.argv[1])
content = path.read_text()

# Replace bare abs() calls with Swift.abs() to resolve CoreMedia header ambiguity.
patched = content.replace(
    "let aspectRatioDiff = abs(actualAspectRatio - targetAspectRatio) / targetAspectRatio",
    "let aspectRatioDiff = Swift.abs(actualAspectRatio - targetAspectRatio) / targetAspectRatio",
).replace(
    "let logPixelDistance = abs(log(actualPixels / targetPixels))",
    "let logPixelDistance = Swift.abs(log(actualPixels / targetPixels))",
)

if patched == content:
    print("[patch-vision-camera] WARNING: abs() pattern not found in penalty file — skipping", file=sys.stderr)
    sys.exit(0)

path.write_text(patched)
print("[patch-vision-camera] Patched CMVideoDimensions+penalty.swift (abs ambiguity)")
PYEOF
  fi
else
  echo "[patch-vision-camera] WARNING: $PENALTY_FILE not found"
fi

# ── Patch 2: RuntimeError initializer ─────────────────────────────────────────
# Walk every .swift file under ios/ and replace `RuntimeError("…")` with
# `RuntimeError.error(withMessage: "…")`. RuntimeError is a @frozen enum, so the
# bare init is invalid. Earlier versions only had this in ResolvableConstraint,
# but 5.0.9 introduced more sites (HybridFrameRecorder.swift) — a directory-wide
# sweep keeps the patch resilient to upstream code churn.
IOS_DIR="$TARGET_DIR/ios"
if [ -d "$IOS_DIR" ]; then
  python3 - "$IOS_DIR" <<'PYEOF'
import sys
from pathlib import Path

ios_dir = Path(sys.argv[1])
patched_files = []
for swift_file in ios_dir.rglob("*.swift"):
    content = swift_file.read_text()
    if 'RuntimeError("' not in content:
        continue
    patched = content.replace('RuntimeError("', 'RuntimeError.error(withMessage: "')
    swift_file.write_text(patched)
    patched_files.append(swift_file.relative_to(ios_dir))

if not patched_files:
    print("[patch-vision-camera] RuntimeError(...) — no remaining occurrences, already patched")
else:
    for f in patched_files:
        print(f"[patch-vision-camera] Patched RuntimeError init in {f}")
PYEOF
else
  echo "[patch-vision-camera] WARNING: $IOS_DIR not found"
fi
