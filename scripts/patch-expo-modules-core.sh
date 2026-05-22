#!/usr/bin/env bash
# patch-expo-modules-core.sh
#
# Fixes expo-modules-core Promise.kt Kotlin compilation error on Gradle 9 / RN 0.84+.
#
# The com.facebook.react.bridge.Promise interface in RN 0.84+ declares reject()
# overloads with nullable code: String? parameters. expo-modules-core 55.x ships
# with an anonymous Promise implementation in toBridgePromise() that only covers
# the non-nullable String variants, causing:
#
#   e: Promise.kt:43:10 Class '<anonymous>' is not abstract and does not implement
#   abstract members: fun reject(code: String?, message: String?): Unit  [+ 5 more]
#
# Fix: add the six missing nullable-code reject() overloads to the anonymous object,
# delegating to the existing non-null handlers (RN passes null for code when it
# doesn't have one, so we substitute unknownCode).

set -euo pipefail

TARGET="node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/Promise.kt"
MARKER="patch-expo-modules-core-nullable-reject"

if [ ! -f "$TARGET" ]; then
  echo "[patch-expo-modules-core] WARNING: $TARGET not found, skipping"
  exit 0
fi

if grep -q "$MARKER" "$TARGET" 2>/dev/null; then
  echo "[patch-expo-modules-core] Already patched, skipping"
  exit 0
fi

python3 - "$TARGET" "$MARKER" <<'PYEOF'
import sys
from pathlib import Path

path = Path(sys.argv[1])
marker = sys.argv[2]

content = path.read_text(encoding="utf-8")

# The anchor: the last existing reject overload before the closing brace of the
# anonymous object. We insert our new overloads right before the @Deprecated one.
anchor = '    @Deprecated("Use reject(code, message, throwable) instead")'

insertion = f'''    // [{marker}] nullable-code overloads required by RN 0.84+ Promise interface
    override fun reject(code: String?, message: String?) {{
      expoPromise.reject(code ?: "UnknownCode", message, null)
    }}

    override fun reject(code: String?, throwable: Throwable?) {{
      expoPromise.reject(code ?: "UnknownCode", null, throwable)
    }}

    override fun reject(code: String?, message: String?, throwable: Throwable?) {{
      expoPromise.reject(code ?: "UnknownCode", message, throwable)
    }}

    override fun reject(code: String?, userInfo: WritableMap) {{
      expoPromise.reject(code ?: "UnknownCode", null, null)
    }}

    override fun reject(code: String?, throwable: Throwable?, userInfo: WritableMap) {{
      expoPromise.reject(code ?: "UnknownCode", null, throwable)
    }}

    override fun reject(code: String?, message: String?, userInfo: WritableMap) {{
      expoPromise.reject(code ?: "UnknownCode", message, null)
    }}

'''

if anchor not in content:
    print(f"[patch-expo-modules-core] ERROR: anchor not found in {path}", file=sys.stderr)
    sys.exit(1)

patched = content.replace(anchor, insertion + anchor, 1)

if patched == content:
    print("[patch-expo-modules-core] WARNING: no change made", file=sys.stderr)
    sys.exit(1)

path.write_text(patched, encoding="utf-8")
print(f"[patch-expo-modules-core] Patched {path}")
PYEOF

echo "[patch-expo-modules-core] Done"
