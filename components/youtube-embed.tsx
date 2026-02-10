/**
 * YouTubeEmbed — Renders a YouTube video given a full URL or video ID.
 * Uses react-native-webview to embed the YouTube iframe player.
 */

import { View, Text, StyleSheet } from "react-native";
import { memo, useMemo } from "react";
import { WebView } from "react-native-webview";

interface YouTubeEmbedProps {
  url: string;
  height?: number;
}

function extractVideoId(url: string): string | null {
  if (!url) return null;

  // Already a bare video ID (11 chars, no slashes/dots)
  if (/^[\w-]{11}$/.test(url)) return url;

  try {
    const parsed = new URL(url);

    // youtu.be/VIDEO_ID
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }

    // youtube.com/watch?v=VIDEO_ID
    if (
      parsed.hostname.includes("youtube.com") &&
      parsed.searchParams.has("v")
    ) {
      return parsed.searchParams.get("v");
    }

    // youtube.com/embed/VIDEO_ID
    const embedMatch = parsed.pathname.match(/\/embed\/([\w-]+)/);
    if (embedMatch) return embedMatch[1];

    // youtube.com/shorts/VIDEO_ID
    const shortsMatch = parsed.pathname.match(/\/shorts\/([\w-]+)/);
    if (shortsMatch) return shortsMatch[1];
  } catch {
    // Not a valid URL
  }

  return null;
}

function YouTubeEmbedComponent({ url, height = 220 }: YouTubeEmbedProps) {
  const videoId = useMemo(() => extractVideoId(url), [url]);

  if (!videoId) return null;

  const embedHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <style>
        * { margin: 0; padding: 0; }
        body { background: #000; }
        iframe { width: 100%; height: 100vh; border: 0; }
      </style>
    </head>
    <body>
      <iframe
        src="https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        source={{ html: embedHtml }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
});

export const YouTubeEmbed = memo(YouTubeEmbedComponent);
export { extractVideoId };
