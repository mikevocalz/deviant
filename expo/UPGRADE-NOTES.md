# Upgrade Notes — React Native 0.84 / Expo 55 (Feb 2026)

Summary of changes made during the iOS upgrade and crash fixes.

---

## 1. Dependency Fixes (expo-asset, expo-audio, expo-local-auth, expo-screen-orientation)

- **Installed `expo-asset`** — Required peer of expo-audio. Prevents crash outside Expo Go.
- **Updated to SDK 55 versions:**
  - `expo-audio`: 1.1.1 → ~55.0.7
  - `expo-local-authentication`: 17.0.8 → ~55.0.7
  - `expo-screen-orientation`: 9.0.8 → ~55.0.7
- Ran `npx expo prebuild --platform ios --clean` and `pod install`

---

## 2. ShareExtension Signing

- **File:** `ios/DVNT.xcodeproj/project.pbxproj`
- Added `DEVELOPMENT_TEAM = 436WA3W63V` to ShareExtension Debug and Release configs

---

## 3. expo-dev-menu (RN 0.84 — RCTPackagerConnection.shared removed)

- **File:** `node_modules/expo-dev-menu/ios/DevMenuPackagerConnectionHandler.swift`
- Replaced `RCTPackagerConnection.shared().addNotificationHandler` with `RCTDevSettings.addNotificationHandler`
- Added `setupPackagerHandlersWhenReady()` for deferred bridge setup
- Updated handler signatures to `[String: Any]?` for `RCTNotificationHandler`
- **Persist via:** `scripts/patch-expo-dev-menu.sh` (runs in postinstall)

---

## 4. expo-dev-launcher (RN 0.84 — sharedPackagerConnection removed)

- **File:** `node_modules/expo-dev-launcher/ios/EXDevLauncherController.m`
- Replaced direct `sharedPackagerConnection` call with `performSelector`-based runtime check
- **Persist via:** `scripts/patch-expo-dev-launcher.sh` (runs in postinstall)

---

## 5. Xcode User Script Sandboxing

- Set `ENABLE_USER_SCRIPT_SANDBOXING = NO` in `ios/DVNT.xcodeproj/project.pbxproj`
- Created `plugins/disable-user-script-sandboxing.js` (Expo config plugin) and added to `app.config.js`

---

## 6. Postinstall

- **File:** `package.json`
- Added to postinstall:
  - `bash scripts/patch-expo-dev-launcher.sh`
  - `bash scripts/patch-expo-dev-menu.sh`

---

## 7. Crash on Start — ScreenOrientation

- **File:** `app/_layout.tsx`
- Moved `ScreenOrientation.lockAsync` / `unlockAsync` from module top-level into a `useEffect`
- Top-level calls ran before native bridge was ready and could crash on startup

---

## Files Created

| File | Purpose |
|------|---------|
| `scripts/patch-expo-dev-launcher.sh` | Apply expo-dev-launcher RN 0.84 fix on install |
| `scripts/patch-expo-dev-menu.sh` | Apply expo-dev-menu RN 0.84 fix on install |
| `plugins/disable-user-script-sandboxing.js` | Disable Xcode script sandboxing for builds |

---

## Deleted

- `patches/expo-dev-menu@55.0.7.patch` — Replaced by shell script approach (pnpm compatibility)
