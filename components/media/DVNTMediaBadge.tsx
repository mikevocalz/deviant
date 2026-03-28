import { View, Text } from "react-native";
import type { MediaKind } from "@/lib/media/types";

interface DVNTMediaBadgeProps {
  kind: MediaKind;
}

const BADGE_CONFIG: Partial<Record<MediaKind, { label: string; bg: string; text: string }>> = {
  gif: { label: "GIF", bg: "rgba(255, 91, 252, 0.90)", text: "#fff" },
  livePhoto: { label: "LIVE", bg: "rgba(0, 0, 0, 0.60)", text: "#fff" },
};

export function DVNTMediaBadge({ kind }: DVNTMediaBadgeProps) {
  const config = BADGE_CONFIG[kind];
  if (!config) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 7,
        left: 7,
        backgroundColor: config.bg,
        borderRadius: 5,
        paddingHorizontal: 5,
        paddingVertical: 2,
        zIndex: 10,
      }}
    >
      <Text
        style={{
          color: config.text,
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.5,
        }}
      >
        {config.label}
      </Text>
    </View>
  );
}
