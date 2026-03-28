import { Platform } from "react-native";
import { useUIStore } from "@/lib/stores/ui-store";
import { SafeAppSecurityKeyboardDetector } from "@/lib/safe-native-modules";

const warnedScreens = new Set<string>();

export function warnIfKeyboardUnsafe(screenName: string) {
  if (Platform.OS !== "android") return;
  if (warnedScreens.has(screenName)) return;

  try {
    const info = SafeAppSecurityKeyboardDetector.getCurrentInputMethodInfo();
    if (info.isInDefaultSafeList) return;

    warnedScreens.add(screenName);
    useUIStore
      .getState()
      .showToast(
        "warning",
        "Keyboard Security",
        "Switch to a trusted keyboard before entering sensitive information.",
      );
  } catch (error) {
    console.warn("[KeyboardSecurity] Unable to inspect keyboard safety:", error);
  }
}
