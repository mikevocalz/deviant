#!/usr/bin/env bash
# patch-expo-dev-menu.sh
# RN 0.84+: RCTPackagerConnection.shared() removed.
# Use RCTDevSettings.addNotificationHandler with deferred bridge setup.

set -euo pipefail

TARGET=$(node -e "
  try {
    const p = require.resolve('expo-dev-menu/ios/DevMenuPackagerConnectionHandler.swift');
    console.log(p);
  } catch {
    console.log('');
  }
" 2>/dev/null)

if [ -z "$TARGET" ] || [ ! -f "$TARGET" ]; then
  echo "[patch-expo-dev-menu] WARNING: expo-dev-menu not found, skipping"
  exit 0
fi

if grep -q "setupPackagerHandlersWhenReady" "$TARGET" 2>/dev/null; then
  echo "[patch-expo-dev-menu] Already patched, skipping"
  exit 0
fi

echo "[patch-expo-dev-menu] Applying RN 0.84 compatibility patch..."
# Use sed/cat to apply - the patch is complex. We'll use a Python script.
python3 - "$TARGET" <<'PYEOF'
import sys

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

# Replace RCTPackagerConnection.shared() block with setupPackagerHandlersWhenReady
old = """    self.swizzleRCTDevMenuShow()

    RCTPackagerConnection
      .shared()
      .addNotificationHandler(
        self.sendDevCommandNotificationHandler,
        queue: DispatchQueue.main,
        forMethod: "sendDevCommand"
      )

    RCTPackagerConnection
      .shared()
      .addNotificationHandler(
        self.devMenuNotificationHanlder,
        queue: DispatchQueue.main,
        forMethod: "devMenu"
      )
#endif
  }"""

new = """    self.swizzleRCTDevMenuShow()
    // RN 0.84+: RCTPackagerConnection.shared() removed; use RCTDevSettings.addNotificationHandler
    self.setupPackagerHandlersWhenReady(attempt: 0)
#endif
  }

  private func setupPackagerHandlersWhenReady(attempt: Int) {
    guard attempt < 40 else { return }
    guard let bridge = manager?.currentBridge,
          let devSettings = bridge.module(forName: "DevSettings") as? RCTDevSettings else {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
        self?.setupPackagerHandlersWhenReady(attempt: attempt + 1)
      }
      return
    }
#if DEBUG
    devSettings.addNotificationHandler(
      sendDevCommandNotificationHandler,
      queue: DispatchQueue.main,
      forMethod: "sendDevCommand"
    )
    devSettings.addNotificationHandler(
      devMenuNotificationHanlder,
      queue: DispatchQueue.main,
      forMethod: "devMenu"
    )
#endif
  }"""

if old in content:
    content = content.replace(old, new)
    # Fix handler signatures for RCTNotificationHandler (Optional param)
    content = content.replace(
        'func sendDevCommandNotificationHandler(_ params: [String: Any]) {',
        'func sendDevCommandNotificationHandler(_ params: [String: Any]?) {'
    )
    content = content.replace(
        'guard let manager = manager,\n      let command = params["name"] as? String,',
        'guard let manager = manager,\n      let params = params,\n      let command = params["name"] as? String,'
    )
    content = content.replace(
        'func devMenuNotificationHanlder(_ parames: [String: Any]) {',
        'func devMenuNotificationHanlder(_ parames: [String: Any]?) {'
    )
    with open(path, 'w') as f:
        f.write(content)
    print("[patch-expo-dev-menu] Patched successfully")
else:
    print("[patch-expo-dev-menu] WARNING: Pattern not found, skipping")
PYEOF
