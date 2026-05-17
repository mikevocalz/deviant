#!/usr/bin/env bash
# patch-expo-updates.sh
#
# expo-updates@55.0.20 stock code is correct — no patches needed.
#
# History of patches that were removed:
#
# Fix 2 (bundleURL probe-first) — REMOVED: caused OTA updates to be silently
#   discarded. The probe always found the embedded bundle first, so
#   AppController.launchAssetUrl() (which returns the OTA bundle URL) was never
#   reached. Stock bundleURL is one line: `AppController.sharedInstance.launchAssetUrl()`
#   which returns URL? (optional) — does not crash, correctly returns OTA bundle when
#   a downloaded update exists.
#
# Fix 3 (eager start() revert) — REMOVED: was a no-op undoing a previous bad patch.
#   Stock AppController does not call eager start() on DisabledAppController.
#
# Fix 4 (AppLauncherNoDatabase EXUpdates.bundle search) — REMOVED: AppLauncherNoDatabase
#   is only used by DisabledAppController (OTA disabled). Production builds use
#   EnabledAppController with AppLauncherWithDatabase — this code path is never hit.

echo "[patch-expo-updates] No patches needed for expo-updates@55.0.20 — skipping"
