#!/usr/bin/env bash
# patch-expo-audio.sh
# Fixes expo-audio@1.1.1 build error on expo-modules-core@55+
# EXFatal and EXErrorWithMessage were removed in SDK 55.
# Replace with a simple NSLog + return pattern.

set -euo pipefail

TARGET="node_modules/expo-audio/ios/AudioRecordingRequester.swift"

if [ ! -f "$TARGET" ]; then
  echo "[patch-expo-audio] WARNING: $TARGET not found, skipping"
  exit 0
fi

# Skip if already patched
if grep -q "NSLog.*NSMicrophoneUsageDescription" "$TARGET" 2>/dev/null; then
  echo "[patch-expo-audio] Already patched, skipping"
  exit 0
fi

python3 - "$TARGET" <<'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

# Replace the EXFatal(EXErrorWithMessage(...)) block with NSLog
# Match the multi-line pattern regardless of exact whitespace
pattern = r'EXFatal\(EXErrorWithMessage\(""".*?"""\)\)'
replacement = 'NSLog("[expo-audio] This app is missing NSMicrophoneUsageDescription, so audio services will fail.")'

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

if new_content != content:
    with open(path, 'w') as f:
        f.write(new_content)
    print("[patch-expo-audio] Patched successfully")
    sys.exit(0)

print("[patch-expo-audio] WARNING: Pattern not found, dumping relevant lines:")
for i, line in enumerate(content.splitlines()):
    if 'EXFatal' in line or 'EXError' in line or 'NSMicrophone' in line:
        print(f"  line {i+1}: {repr(line)}")
sys.exit(1)
PYEOF
