#!/usr/bin/env bash
# patch-react-native-gradle-plugin.sh
# Adds a Google-hosted Maven Central mirror ahead of mavenCentral() in the
# React Native Gradle plugin's Kotlin Gradle files to reduce EAS build failures
# caused by transient Maven Central 429 responses during settings/plugin resolution.

set -euo pipefail

ROOT="node_modules/@react-native/gradle-plugin"
MIRROR='maven { url = uri("https://maven-central.storage-download.googleapis.com/maven2/") }'

if [ ! -d "$ROOT" ]; then
  echo "[patch-react-native-gradle-plugin] WARNING: $ROOT not found, skipping"
  exit 0
fi

patched=0

patch_multiline_file() {
  local file="$1"
  local target="$2"

  [ -f "$file" ] || return 0
  if grep -q "maven-central.storage-download.googleapis.com" "$file" 2>/dev/null; then
    return 0
  fi

  python3 - "$file" "$MIRROR" "$target" <<'PYEOF'
import sys

path, mirror, target = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

replacement = f"{target}{mirror}\n{target}mavenCentral()"
updated = content.replace(f"{target}mavenCentral()", replacement, 1)

if updated != content:
    with open(path, "w", encoding="utf-8") as f:
        f.write(updated)
PYEOF

  if grep -q "maven-central.storage-download.googleapis.com" "$file" 2>/dev/null; then
    echo "[patch-react-native-gradle-plugin] Patched: $file"
    patched=1
  fi
}

patch_inline_repo_file() {
  local file="$1"

  [ -f "$file" ] || return 0
  if grep -q "maven-central.storage-download.googleapis.com" "$file" 2>/dev/null; then
    return 0
  fi

  python3 - "$file" "$MIRROR" <<'PYEOF'
import sys

path, mirror = sys.argv[1], sys.argv[2]
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

updated = content.replace(
    "repositories { mavenCentral() }",
    f"repositories {{\n  {mirror}\n  mavenCentral()\n}}",
    1,
)

if updated != content:
    with open(path, "w", encoding="utf-8") as f:
        f.write(updated)
PYEOF

  if grep -q "maven-central.storage-download.googleapis.com" "$file" 2>/dev/null; then
    echo "[patch-react-native-gradle-plugin] Patched: $file"
    patched=1
  fi
}

patch_multiline_file "$ROOT/settings.gradle.kts" "    "
patch_multiline_file "$ROOT/react-native-gradle-plugin/build.gradle.kts" "  "
patch_multiline_file "$ROOT/settings-plugin/build.gradle.kts" "  "
patch_inline_repo_file "$ROOT/shared/build.gradle.kts"
patch_inline_repo_file "$ROOT/shared-testutil/build.gradle.kts"

if [ "$patched" -eq 0 ]; then
  echo "[patch-react-native-gradle-plugin] Already patched, skipping"
fi
