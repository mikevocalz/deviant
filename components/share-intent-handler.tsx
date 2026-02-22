import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useShareIntentSafe } from "@/lib/safe-native-modules";
import { useSpotifyShareStore } from "@/lib/spotify/spotify-share-store";
import { useDeepLinkStore } from "@/lib/stores/deep-link-store";

type ShareFile = { path: string; mimeType?: string };

export function ShareIntentHandler() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentSafe();
  const processSharedText = useSpotifyShareStore((s) => s.processSharedText);
  const setOpenedFromShareIntent = useDeepLinkStore((s) => s.setOpenedFromShareIntent);

  useEffect(() => {
    if (!hasShareIntent || !shareIntent || typeof shareIntent !== "object") return;
    setOpenedFromShareIntent(false); // Clear so next launch uses normal timing
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
          router.replace({
            pathname: "/(protected)/story/editor",
            params: {
              uri: encodeURIComponent(first.path),
              type: isVideo ? "video" : "image",
            },
          });
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
      resetShareIntent();
    } catch {
      // noop
    }
  }, [hasShareIntent, shareIntent, processSharedText, resetShareIntent, router, setOpenedFromShareIntent]);

  return null;
}
