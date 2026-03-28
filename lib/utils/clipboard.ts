export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    // Prefer Expo Clipboard when present in the binary.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expoClipboard = require("expo-clipboard");
    if (expoClipboard?.setStringAsync) {
      await expoClipboard.setStringAsync(text);
      return true;
    }
  } catch {}

  try {
    // Fallback for older/native builds that still expose Clipboard on react-native.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Clipboard: RNClipboard } = require("react-native");
    if (RNClipboard?.setString) {
      RNClipboard.setString(text);
      return true;
    }
  } catch {}

  return false;
}
