#!/usr/bin/env bash
# patch-rcttobomodule-diagnostics.sh
#
# Patches RCTTurboModule.mm so that NSExceptions thrown from any
# TurboModule void method get logged with full module/method/name/
# reason/callStackSymbols BEFORE React Native's existing C++ rethrow
# loses everything.
#
# Why: the 1.0.247 .ips crash log had this pattern on Thread 18:
#   abort → objc_terminate → __cxa_rethrow → objc_exception_rethrow
#   → performVoidMethodInvocation (RCTTurboModule.mm:467) → dispatch
#
# Stock RN catches the NSException at line 463, converts it to a C++
# jsi::JSError, and rethrows. The .ips only shows the dispatch
# wrapper — we can't see WHICH module/method threw. This patch adds
# NSLog + a persisted JSON file with that info, and is read on the
# next launch by lib/native-exception-log.ts.
#
# We use a hand-written shell script (not patch-package) because this
# project uses pnpm and patch-package needs a yarn/npm lockfile.

set -e

PATCH_FILE="patches/react-native+0.84.1.patch"
TARGET_FILE="node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/ReactCommon/RCTTurboModule.mm"
MARKER="DVNT-TM-CRASH"

if [ ! -f "$TARGET_FILE" ]; then
  echo "[patch-rcttobomodule] target not found, skipping: $TARGET_FILE"
  exit 0
fi

# Idempotency — if our marker is already in the file, this run is a
# no-op. Critical for EAS builds where postinstall may run multiple
# times against the same node_modules.
if grep -q "$MARKER" "$TARGET_FILE"; then
  echo "[patch-rcttobomodule] already patched, skipping"
  exit 0
fi

if [ ! -f "$PATCH_FILE" ]; then
  echo "[patch-rcttobomodule] patch file not found, skipping: $PATCH_FILE"
  exit 0
fi

echo "[patch-rcttobomodule] applying $PATCH_FILE"
patch -p1 --forward --no-backup-if-mismatch < "$PATCH_FILE" || {
  echo "[patch-rcttobomodule] WARNING: patch failed (probably already applied or RN version drifted)"
  exit 0
}

echo "[patch-rcttobomodule] done"
