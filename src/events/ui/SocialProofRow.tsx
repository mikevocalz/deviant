import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import type { EventAttendee } from "../types";

interface SocialProofRowProps {
  attendees: EventAttendee[];
  totalCount: number;
  followingCount?: number;
}

export const SocialProofRow = memo(function SocialProofRow({
  attendees,
  totalCount,
  followingCount,
}: SocialProofRowProps) {
  const displayAvatars = attendees.slice(0, 5);

  return (
    <View style={styles.container}>
      {/* Face pile */}
      <View style={styles.facePile}>
        {displayAvatars.map((attendee, index) => (
          <View
            key={attendee.id}
            style={[
              styles.avatarWrapper,
              { marginLeft: index === 0 ? 0 : -10, zIndex: 10 - index },
            ]}
          >
            {attendee.avatar ? (
              <Image
                source={{ uri: attendee.avatar }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.initialsAvatar,
                  { backgroundColor: attendee.color || "#333" },
                ]}
              >
                <Text style={styles.initials}>
                  {attendee.initials || attendee.username?.charAt(0)?.toUpperCase() || "?"}
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Count text */}
      <View style={styles.textContainer}>
        <Text style={styles.countText}>
          <Text style={styles.countBold}>{totalCount}</Text> going
        </Text>
        {followingCount != null && followingCount > 0 && (
          <Text style={styles.followingText}>
            {followingCount} {followingCount === 1 ? "person" : "people"} you follow
          </Text>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  facePile: {
    flexDirection: "row",
    marginRight: 12,
  },
  avatarWrapper: {
    borderWidth: 2,
    borderColor: "#000",
    borderRadius: 18,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  initialsAvatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  textContainer: {
    flex: 1,
  },
  countText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },
  countBold: {
    color: "#fff",
    fontWeight: "700",
  },
  followingText: {
    color: "rgb(255, 109, 193)",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
});
