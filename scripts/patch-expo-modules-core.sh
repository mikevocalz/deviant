#!/usr/bin/env bash
# patch-expo-modules-core.sh
# Fixes expo-modules-core Promise.kt for RN 0.84 nullable code parameter.
#
# RN 0.84 changed com.facebook.react.bridge.Promise.reject() signatures
# to accept nullable `code: String?`. The expo-modules-core bridge adapter
# must match these signatures.
#
# This replaces the pnpm patch to avoid the prefab CLI "no such option"
# crash caused by `patch_hash=` in the pnpm directory name.

set -euo pipefail

PROMISE_FILE="node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/Promise.kt"

if [ ! -f "$PROMISE_FILE" ]; then
  echo "[patch-expo-modules-core] WARNING: $PROMISE_FILE not found, skipping"
  exit 0
fi

# Idempotency check
if grep -q 'override fun reject(code: String?, message: String?)' "$PROMISE_FILE" 2>/dev/null; then
  echo "[patch-expo-modules-core] Already patched, skipping"
  exit 0
fi

python3 - "$PROMISE_FILE" <<'PYEOF'
import sys

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

replacements = [
    # 1. reject(code: String, message: String?)
    (
        "override fun reject(code: String, message: String?) {\n      expoPromise.reject(code, message, null)",
        "override fun reject(code: String?, message: String?) {\n      expoPromise.reject(code ?: unknownCode, message, null)"
    ),
    # 2. reject(code: String, throwable: Throwable?)
    (
        "override fun reject(code: String, throwable: Throwable?) {\n      expoPromise.reject(code, null, throwable)",
        "override fun reject(code: String?, throwable: Throwable?) {\n      expoPromise.reject(code ?: unknownCode, null, throwable)"
    ),
    # 3. reject(code: String, message: String?, throwable: Throwable?)
    (
        "override fun reject(code: String, message: String?, throwable: Throwable?) {\n      expoPromise.reject(code, message, throwable)",
        "override fun reject(code: String?, message: String?, throwable: Throwable?) {\n      expoPromise.reject(code ?: unknownCode, message, throwable)"
    ),
    # 4. reject(code: String, userInfo: WritableMap)
    (
        "override fun reject(code: String, userInfo: WritableMap) {\n      expoPromise.reject(code, null, null)",
        "override fun reject(code: String?, userInfo: WritableMap) {\n      expoPromise.reject(code ?: unknownCode, null, null)"
    ),
    # 5. reject(code: String, throwable: Throwable?, userInfo: WritableMap)
    (
        "override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {\n      expoPromise.reject(code, null, throwable)",
        "override fun reject(code: String?, throwable: Throwable?, userInfo: WritableMap) {\n      expoPromise.reject(code ?: unknownCode, null, throwable)"
    ),
    # 6. reject(code: String, message: String?, userInfo: WritableMap)
    (
        "override fun reject(code: String, message: String?, userInfo: WritableMap) {\n      expoPromise.reject(code, message, null)",
        "override fun reject(code: String?, message: String?, userInfo: WritableMap) {\n      expoPromise.reject(code ?: unknownCode, message, null)"
    ),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        count += 1

if count > 0:
    with open(path, 'w') as f:
        f.write(content)
    print(f"[patch-expo-modules-core] Patched {count} reject() overrides in Promise.kt")
else:
    print("[patch-expo-modules-core] WARNING: No patterns matched")
    sys.exit(1)
PYEOF
