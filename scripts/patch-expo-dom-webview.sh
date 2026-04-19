#!/usr/bin/env bash
# Patches @expo/dom-webview 55.0.3 iOS build failure:
#
#   DomWebView.swift:71 — `cannot find 'RCTConvert' in scope`
#
# The file uses RCTConvert.nsurlRequest() but never imports React-Core.
# DomWebViewSource only carries a `uri: String?` field, so we can replace
# the call with a plain Swift URLRequest construction, which compiles
# without any React headers.
#
# Fixed in upstream 55.0.5; this script lets us ship with 55.0.3 until
# pnpm resolves the peer-dep pin from expo@55.0.15.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_FILE="$(cd "$SCRIPT_DIR/.." && pwd)/node_modules/@expo/dom-webview/ios/DomWebView.swift"

if [ ! -f "$TARGET_FILE" ]; then
  echo "[patch-expo-dom-webview] WARNING: $TARGET_FILE not found, skipping"
  exit 0
fi

# Already patched?
if grep -q 'URLRequest(url:' "$TARGET_FILE" 2>/dev/null && ! grep -q 'RCTConvert' "$TARGET_FILE" 2>/dev/null; then
  echo "[patch-expo-dom-webview] DomWebView.swift already patched"
  exit 0
fi

python3 - "$TARGET_FILE" <<'PYEOF'
import sys
from pathlib import Path

path = Path(sys.argv[1])
content = path.read_text()

OLD = (
    "    if let source,\n"
    "      let request = RCTConvert.nsurlRequest(source.toDictionary(appContext: appContext)),\n"
    "      webView.url?.absoluteURL != request.url {\n"
    "      webView.load(request)\n"
    "    }"
)

NEW = (
    "    if let source,\n"
    "      let uriString = source.uri,\n"
    "      let url = URL(string: uriString),\n"
    "      webView.url?.absoluteURL != url {\n"
    "      webView.load(URLRequest(url: url))\n"
    "    }"
)

if OLD not in content:
    print("[patch-expo-dom-webview] WARNING: expected RCTConvert pattern not found — skipping", file=sys.stderr)
    sys.exit(0)

patched = content.replace(OLD, NEW)
path.write_text(patched)
print("[patch-expo-dom-webview] Patched DomWebView.swift (replaced RCTConvert.nsurlRequest with URLRequest)")
PYEOF
