/**
 * VideoThumbnailImage
 *
 * Generates a real thumbnail from a remote video URL using expo-video-thumbnails.
 * Caches the result with React Query so thumbnails are only generated once per video.
 * Falls back to a Play icon if generation fails.
 */

import { View, Text } from "react-native";
import { Image } from "expo-image";
import { Play } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import * as VideoThumbnails from "expo-video-thumbnails";

const thumbnailKeys = {
  forVideo: (videoUrl: string) => ["videoThumbnail", videoUrl] as const,
};

async function generateThumbnailFromUrl(
  videoUrl: string,
): Promise<string | null> {
  try {
    const result = await VideoThumbnails.getThumbnailAsync(videoUrl, {
      time: 500,
      quality: 0.7,
    });
    return result.uri;
  } catch (error) {
    console.warn("[VideoThumbnailImage] Generation failed:", error);
    return null;
  }
}

interface VideoThumbnailImageProps {
  videoUrl: string;
  style?: any;
}

export function VideoThumbnailImage({
  videoUrl,
  style,
}: VideoThumbnailImageProps) {
  const { data: thumbnailUri } = useQuery({
    queryKey: thumbnailKeys.forVideo(videoUrl),
    queryFn: () => generateThumbnailFromUrl(videoUrl),
    enabled: !!videoUrl,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  if (thumbnailUri) {
    return (
      <Image
        source={{ uri: thumbnailUri }}
        style={[{ width: "100%", height: "100%" }, style]}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }

  return (
    <View
      style={[
        {
          width: "100%",
          height: "100%",
          backgroundColor: "#1a1a1a",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Play size={24} color="#666" fill="#666" />
    </View>
  );
}
