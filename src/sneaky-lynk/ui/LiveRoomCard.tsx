/**
 * Live Room Card Component
 * Gradient card displaying a live Sneaky Lynk room
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Video, Users } from "lucide-react-native";
import type { MockSpace } from "../types";

interface LiveRoomCardProps {
  space: MockSpace;
  onPress: () => void;
}

export function LiveRoomCard({ space, onPress }: LiveRoomCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.card}>
      <LinearGradient
        colors={["#3EA4E5", "#2563EB"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Header with badges */}
        <View style={styles.header}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          {space.hasVideo && (
            <View style={styles.videoBadge}>
              <Video size={12} color="#fff" />
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {space.title}
          </Text>
          <Text style={styles.topic}>{space.topic}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.speakersRow}>
            <Image
              source={{ uri: space.host.avatar }}
              style={styles.hostAvatar}
            />
            {space.speakers.slice(0, 2).map((speaker) => (
              <Image
                key={speaker.id}
                source={{ uri: speaker.avatar }}
                style={styles.speakerAvatar}
              />
            ))}
          </View>
          <View style={styles.listenersInfo}>
            <Users size={14} color="#fff" />
            <Text style={styles.listenersText}>
              {space.listeners.toLocaleString()}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: "hidden",
  },
  gradient: {
    padding: 18,
    minHeight: 180,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  liveText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  videoBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    padding: 6,
    borderRadius: 10,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    marginVertical: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 6,
  },
  topic: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  speakersRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  hostAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#fff",
  },
  speakerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#fff",
    marginLeft: -10,
  },
  listenersInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  listenersText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
