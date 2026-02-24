# Device Validation Blockers

**Date**: 2026-02-23
**Device**: Mike V. iPhone (iOS 26.0.1) — UDID `00008120-001C31990198201E`
**Platform**: macOS + Xcode 26.0

## Status: BLOCKED — Manual Setup Required

### What's Working
- ✅ `go-ios` installed (v1.0.188) — `ios list` sees device
- ✅ Tunnel running (`ios tunnel start --userspace` — port 60105 bound)
- ✅ Port forwarding running (`ios forward 8100 8100` — port 8100 bound)
- ✅ WebDriverAgent cloned at `/tmp/WebDriverAgent`
- ✅ WDA builds and signs with team 436WA3W63V

### What's Blocking
1. **macOS Keychain password prompt** — `xcodebuild test` prompts for password to access signing identity. Cannot be automated from Cascade.
2. **iOS UI Automation may not be enabled** — WDA timed out with: `Timed out while enabling automation mode.`

### Steps to Fix (Manual)

```bash
# 1. On your iPhone:
#    Settings → Developer → Enable UI Automation → ON
#    Unlock the device and keep it awake

# 2. On your Mac, in a dedicated terminal:
xcodebuild -project /tmp/WebDriverAgent/WebDriverAgent.xcodeproj \
  -scheme WebDriverAgentRunner \
  -destination 'platform=iOS,id=00008120-001C31990198201E' \
  DEVELOPMENT_TEAM=436WA3W63V \
  CODE_SIGN_IDENTITY="Apple Development" \
  test

# 3. Enter your macOS password when prompted (keychain access)
# 4. WDA should report "ServerURLHere->http://..." when running

# 5. Verify MCP works — in Cascade, ask: "take a screenshot of my iOS device"
```

### Android
- `adb` installed (v36.0.0)
- **No Android device connected** (`adb devices` shows empty list)
