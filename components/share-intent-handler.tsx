import { useEffect } from "react";
import { useShareIntentSafe } from "@/lib/safe-native-modules";
import { useSpotifyShareStore } from "@/lib/spotify/spotify-share-store";

export function ShareIntentHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentSafe();
  const processSharedText = useSpotifyShareStore((s) => s.processSharedText);

  useEffect(() => {
    if (!hasShareIntent || !shareIntent || typeof shareIntent !== "object") return;
    try {
      const s = shareIntent as { text?: string; webUrl?: string };
      const text = s.text ?? s.webUrl ?? "";
      if (typeof text === "string" && text.trim()) {
        processSharedText(text);
      }
    } catch (e) {
      console.warn("[ShareIntentHandler] Error processing share:", e);
    }
    try {
      resetShareIntent();
    } catch {
      // noop
    }
  }, [hasShareIntent, shareIntent, processSharedText, resetShareIntent]);

  return null;
}
