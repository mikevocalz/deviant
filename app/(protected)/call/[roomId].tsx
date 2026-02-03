/**
 * Video Call Screen
 *
 * Modern video call UI with:
 * - Grid of participant videos
 * - Mute/camera toggle
 * - End call button
 * - Participants bottom sheet
 * - Speaker indicator
 */

import { useEffect, useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { RTCView } from "@fishjam-cloud/react-native-client";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  UserPlus,
  X,
  RotateCcw,
  Volume2,
} from "lucide-react-native";
import { Image } from "expo-image";
import { Motion, AnimatePresence } from "@legendapp/motion";
import { useVideoCall, type Participant } from "@/lib/hooks/use-video-call";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function VideoCallScreen() {
  const { roomId, isOutgoing, participantIds } = useLocalSearchParams<{
    roomId?: string;
    isOutgoing?: string;
    participantIds?: string;
  }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const [showParticipants, setShowParticipants] = useState(false);

  const {
    isConnected,
    isInCall,
    localStream,
    participants,
    speakerId,
    isMuted,
    isVideoOff,
    error,
    connect,
    createCall,
    joinCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    addParticipant,
    setSpeaker,
  } = useVideoCall();

  // Connect and start/join call on mount
  useEffect(() => {
    const initCall = async () => {
      await connect();

      if (isOutgoing === "true" && participantIds) {
        // Creating a new call
        const ids = participantIds.split(",");
        await createCall(ids, ids.length > 1);
      } else if (roomId) {
        // Joining existing call
        await joinCall(roomId);
      }
    };

    initCall();
  }, [roomId, isOutgoing, participantIds]);

  // Handle errors
  useEffect(() => {
    if (error) {
      showToast("error", "Call Error", error);
    }
  }, [error, showToast]);

  const handleEndCall = useCallback(() => {
    leaveCall();
    router.back();
  }, [leaveCall, router]);

  const handleAddParticipant = useCallback(() => {
    // TODO: Navigate to user picker when screen is created
    showToast("info", "Coming Soon", "Add participant feature coming soon");
  }, [showToast]);

  // Calculate video grid layout
  const getGridLayout = (count: number) => {
    if (count <= 1) return { cols: 1, rows: 1 };
    if (count <= 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    return { cols: 3, rows: 3 };
  };

  const totalParticipants = participants.length + 1; // +1 for local
  const { cols, rows } = getGridLayout(totalParticipants);
  const videoWidth = (SCREEN_WIDTH - 24) / cols;
  const videoHeight = (SCREEN_HEIGHT - 200) / rows;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Video Grid */}
      <View style={styles.videoGrid}>
        {/* Local Video */}
        <View
          style={[
            styles.videoContainer,
            { width: videoWidth - 8, height: videoHeight - 8 },
            speakerId === user?.id && styles.speakerHighlight,
          ]}
        >
          {localStream && !isVideoOff ? (
            <RTCView
              mediaStream={localStream}
              style={styles.video}
              objectFit="cover"
              mirror={true}
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Image
                source={{
                  uri:
                    user?.avatar ||
                    `https://ui-avatars.com/api/?name=${user?.username}&background=3EA4E5&color=fff`,
                }}
                style={styles.avatarLarge}
              />
            </View>
          )}
          <View style={styles.videoLabel}>
            <Text style={styles.videoLabelText}>You</Text>
            {isMuted && <MicOff size={14} color="#fff" />}
          </View>
          {speakerId === user?.id && (
            <View style={styles.speakerBadge}>
              <Volume2 size={12} color="#fff" />
            </View>
          )}
        </View>

        {/* Remote Videos */}
        {participants.map((participant) => (
          <View
            key={participant.oderId}
            style={[
              styles.videoContainer,
              { width: videoWidth - 8, height: videoHeight - 8 },
              speakerId === participant.oderId && styles.speakerHighlight,
            ]}
          >
            {participant.stream && !participant.isVideoOff ? (
              <RTCView
                mediaStream={participant.stream}
                style={styles.video}
                objectFit="cover"
              />
            ) : (
              <View style={styles.videoPlaceholder}>
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarText}>
                    {participant.username?.charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
              </View>
            )}
            <View style={styles.videoLabel}>
              <Text style={styles.videoLabelText}>{participant.username}</Text>
              {participant.isMuted && <MicOff size={14} color="#fff" />}
            </View>
            {speakerId === participant.oderId && (
              <View style={styles.speakerBadge}>
                <Volume2 size={12} color="#fff" />
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={toggleMute}
        >
          {isMuted ? (
            <MicOff size={24} color="#fff" />
          ) : (
            <Mic size={24} color="#fff" />
          )}
        </Pressable>

        <Pressable
          style={[
            styles.controlButton,
            isVideoOff && styles.controlButtonActive,
          ]}
          onPress={toggleVideo}
        >
          {isVideoOff ? (
            <VideoOff size={24} color="#fff" />
          ) : (
            <Video size={24} color="#fff" />
          )}
        </Pressable>

        <Pressable style={styles.controlButton} onPress={switchCamera}>
          <RotateCcw size={24} color="#fff" />
        </Pressable>

        <Pressable
          style={styles.controlButton}
          onPress={() => setShowParticipants(true)}
        >
          <Users size={24} color="#fff" />
          {participants.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{participants.length + 1}</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={styles.endCallButton} onPress={handleEndCall}>
          <PhoneOff size={28} color="#fff" />
        </Pressable>
      </View>

      {/* Participants Bottom Sheet */}
      <AnimatePresence>
        {showParticipants && (
          <>
            <Pressable
              style={styles.overlay}
              onPress={() => setShowParticipants(false)}
            />
            <Motion.View
              initial={{ translateY: 400 }}
              animate={{ translateY: 0 }}
              exit={{ translateY: 400 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              style={styles.bottomSheet}
            >
              {/* Header */}
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Participants</Text>
                <Pressable
                  onPress={() => setShowParticipants(false)}
                  hitSlop={12}
                >
                  <X size={24} color="#fff" />
                </Pressable>
              </View>

              {/* Participant List */}
              <ScrollView style={styles.participantList}>
                {/* Self */}
                <View style={styles.participantItem}>
                  <Image
                    source={{
                      uri:
                        user?.avatar ||
                        `https://ui-avatars.com/api/?name=${user?.username}&background=3EA4E5&color=fff`,
                    }}
                    style={styles.participantAvatar}
                  />
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>You</Text>
                    {speakerId === user?.id && (
                      <View style={styles.speakerTag}>
                        <Volume2 size={10} color="#3EA4E5" />
                        <Text style={styles.speakerTagText}>Speaker</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.participantStatus}>
                    {isMuted && <MicOff size={16} color="#666" />}
                    {isVideoOff && <VideoOff size={16} color="#666" />}
                  </View>
                </View>

                {/* Other Participants */}
                {participants.map((p) => (
                  <Pressable
                    key={p.oderId}
                    style={styles.participantItem}
                    onPress={() => setSpeaker(p.oderId)}
                  >
                    <View style={styles.participantAvatarPlaceholder}>
                      <Text style={styles.participantAvatarText}>
                        {p.username?.charAt(0).toUpperCase() || "?"}
                      </Text>
                    </View>
                    <View style={styles.participantInfo}>
                      <Text style={styles.participantName}>{p.username}</Text>
                      {speakerId === p.oderId && (
                        <View style={styles.speakerTag}>
                          <Volume2 size={10} color="#3EA4E5" />
                          <Text style={styles.speakerTagText}>Speaker</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.participantStatus}>
                      {p.isMuted && <MicOff size={16} color="#666" />}
                      {p.isVideoOff && <VideoOff size={16} color="#666" />}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Add Participant Button */}
              <Pressable
                style={styles.addParticipantButton}
                onPress={handleAddParticipant}
              >
                <UserPlus size={20} color="#3EA4E5" />
                <Text style={styles.addParticipantText}>Add participant</Text>
              </Pressable>
            </Motion.View>
          </>
        )}
      </AnimatePresence>

      {/* Connection Status */}
      {!isConnected && (
        <View style={styles.connectionStatus}>
          <Text style={styles.connectionStatusText}>Connecting...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  videoContainer: {
    margin: 4,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#3EA4E5",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
  },
  videoLabel: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  videoLabelText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  speakerHighlight: {
    borderWidth: 2,
    borderColor: "#3EA4E5",
  },
  speakerBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#3EA4E5",
    padding: 4,
    borderRadius: 4,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonActive: {
    backgroundColor: "#666",
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#3EA4E5",
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.6,
    paddingBottom: 34,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  sheetTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  participantList: {
    maxHeight: 300,
  },
  participantItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  participantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  participantAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3EA4E5",
    justifyContent: "center",
    alignItems: "center",
  },
  participantAvatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  speakerTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  speakerTagText: {
    color: "#3EA4E5",
    fontSize: 12,
  },
  participantStatus: {
    flexDirection: "row",
    gap: 8,
  },
  addParticipantButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  addParticipantText: {
    color: "#3EA4E5",
    fontSize: 16,
    fontWeight: "500",
  },
  connectionStatus: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  connectionStatusText: {
    color: "#fff",
    fontSize: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
});
