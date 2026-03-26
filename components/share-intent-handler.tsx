import { useEffect } from "react";
import { useShareIntentSafe } from "@/lib/safe-native-modules";
import { useSpotifyShareStore } from "@/lib/spotify/spotify-share-store";
import { useDeepLinkStore } from "@/lib/stores/deep-link-store";
import { useAppStore } from "@/lib/stores/app-store";

type ShareFile = { path: string; mimeType?: string };

export function ShareIntentHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentSafe();
  const processSharedText = useSpotifyShareStore((s) => s.processSharedText);
  const setOpenedFromShareIntent = useDeepLinkStore((s) => s.setOpenedFromShareIntent);
  const setPendingShareIntentRoute = useAppStore(
    (s) => s.setPendingShareIntentRoute,
  );

  useEffect(() => {
    if (!hasShareIntent || !shareIntent || typeof shareIntent !== "object") return;
    try {
      const s = shareIntent as {
        text?: string;
        webUrl?: string;
        files?: ShareFile[];
      };

      const files = s.files as ShareFile[] | undefined;
      if (files && files.length > 0) {
        const first = files[0];
        if (first?.path) {
          const isVideo =
            first.mimeType?.startsWith("video/") ||
            !!first.path.match(/\.(mp4|mov|webm)$/i);
          setPendingShareIntentRoute({
            pathname: "/(protected)/story/editor",
            params: {
              uri: encodeURIComponent(first.path),
              type: isVideo ? "video" : "image",
            },
          });
          setOpenedFromShareIntent(false); // Clear so next launch uses normal timing
          resetShareIntent();
          return;
        }
      }

      const text = s.text ?? s.webUrl ?? "";
      if (typeof text === "string" && text.trim()) {
        processSharedText(text);
      }
    } catch (e) {
      console.warn("[ShareIntentHandler] Error processing share:", e);
    }
    try {
      setOpenedFromShareIntent(false);
      resetShareIntent();
    } catch {
      // noop
    }
  }, [
    hasShareIntent,
    processSharedText,
    resetShareIntent,
    setOpenedFromShareIntent,
    setPendingShareIntentRoute,
    shareIntent,
  ]);

  return null;
}
