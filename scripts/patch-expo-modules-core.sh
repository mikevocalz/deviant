#!/usr/bin/env bash
# patch-expo-modules-core.sh
#
# Fixes expo-modules-core Promise.kt Kotlin compilation error on RN 0.84+.
#
# RN 0.84+ changed com.facebook.react.bridge.Promise to use nullable
# code: String? on all reject() overloads that accept a code. expo-modules-core
# 55.x still declares its overrides with non-nullable code: String, which
# causes:
#
#   e: Promise.kt:48:5 'reject' overrides nothing. Potential signatures...
#     fun reject(code: String?, message: String?): Unit
#     [...]
#
# Fix: rewrite the six broken non-nullable reject() overrides to take
# code: String? and route null through unknownCode. Idempotent — safe to
# re-run.
#
# Affects the anonymous Promise object created inside toBridgePromise() in:
#   node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/Promise.kt

set -euo pipefail

TARGET="node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/Promise.kt"
MARKER="patch-expo-modules-core-nullable-reject-v2"

if [ ! -f "$TARGET" ]; then
  echo "[patch-expo-modules-core] WARNING: $TARGET not found, skipping"
  exit 0
fi

if grep -q "$MARKER" "$TARGET" 2>/dev/null; then
  echo "[patch-expo-modules-core] Already patched (v2), skipping"
  exit 0
fi

python3 - "$TARGET" "$MARKER" <<'PYEOF'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
marker = sys.argv[2]

content = path.read_text(encoding="utf-8")
original = content

# Strip any prior v1 patch insert so we end up with a single canonical set
# of nullable overrides, no duplicates.
v1_block_re = re.compile(
    r"    // \[patch-expo-modules-core-nullable-reject\] [^\n]*\n"
    r"(?:    override fun reject\(code: String\?[^\n]*\) \{\n"
    r"      expoPromise\.reject\([^\n]*\)\n"
    r"    \}\n\n?)+",
    re.MULTILINE,
)
content = v1_block_re.sub("", content)

# Six broken non-nullable overrides to rewrite. Each tuple is
# (broken_block, nullable_replacement).
rewrites = [
    (
        '    override fun reject(code: String, message: String?) {\n'
        '      expoPromise.reject(code, message, null)\n'
        '    }\n',
        '    override fun reject(code: String?, message: String?) {\n'
        '      expoPromise.reject(code ?: unknownCode, message, null)\n'
        '    }\n',
    ),
    (
        '    override fun reject(code: String, throwable: Throwable?) {\n'
        '      expoPromise.reject(code, null, throwable)\n'
        '    }\n',
        '    override fun reject(code: String?, throwable: Throwable?) {\n'
        '      expoPromise.reject(code ?: unknownCode, null, throwable)\n'
        '    }\n',
    ),
    (
        '    override fun reject(code: String, message: String?, throwable: Throwable?) {\n'
        '      expoPromise.reject(code, message, throwable)\n'
        '    }\n',
        '    override fun reject(code: String?, message: String?, throwable: Throwable?) {\n'
        '      expoPromise.reject(code ?: unknownCode, message, throwable)\n'
        '    }\n',
    ),
    (
        '    override fun reject(code: String, userInfo: WritableMap) {\n'
        '      expoPromise.reject(code, null, null)\n'
        '    }\n',
        '    override fun reject(code: String?, userInfo: WritableMap) {\n'
        '      expoPromise.reject(code ?: unknownCode, null, null)\n'
        '    }\n',
    ),
    (
        '    override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {\n'
        '      expoPromise.reject(code, null, throwable)\n'
        '    }\n',
        '    override fun reject(code: String?, throwable: Throwable?, userInfo: WritableMap) {\n'
        '      expoPromise.reject(code ?: unknownCode, null, throwable)\n'
        '    }\n',
    ),
    (
        '    override fun reject(code: String, message: String?, userInfo: WritableMap) {\n'
        '      expoPromise.reject(code, message, null)\n'
        '    }\n',
        '    override fun reject(code: String?, message: String?, userInfo: WritableMap) {\n'
        '      expoPromise.reject(code ?: unknownCode, message, null)\n'
        '    }\n',
    ),
]

missing = []
for broken, fixed in rewrites:
    if broken in content:
        content = content.replace(broken, fixed, 1)
    elif fixed in content:
        # Already nullable — nothing to do for this one (e.g. after a partial run).
        pass
    else:
        missing.append(broken.splitlines()[0].strip())

if missing:
    print(
        "[patch-expo-modules-core] ERROR: could not locate expected reject overrides:",
        file=sys.stderr,
    )
    for m in missing:
        print(f"  {m}", file=sys.stderr)
    sys.exit(1)

# Stamp a marker comment so re-runs are a no-op.
stamp = f"// [{marker}] all reject(code) overrides take String? to match RN 0.84+\n"
if stamp not in content:
    content = content.replace(
        "fun Promise.toBridgePromise():",
        stamp + "fun Promise.toBridgePromise():",
        1,
    )

if content == original:
    print("[patch-expo-modules-core] WARNING: no change made", file=sys.stderr)
    sys.exit(1)

path.write_text(content, encoding="utf-8")
print(f"[patch-expo-modules-core] Patched {path}")
PYEOF

echo "[patch-expo-modules-core] Done"
