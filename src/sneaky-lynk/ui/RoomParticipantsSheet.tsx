import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import {
  Crown,
  EyeOff,
  Mic,
  MicOff,
  Shield,
  UserMinus,
  Users,
  Video,
  VideoOff,
  X,
  Hand,
} from "lucide-react-native";
import { Avatar } from "@/components/ui/avatar";
import { GlassSheetBackground } from "@/components/sheets/glass-sheet-background";
import type { VideoParticipant } from "./VideoGrid";

interface RoomParticipantsSheetProps {
  visible: boolean;
  participants: VideoParticipant[];
  localUserId: string;
  isHost: boolean;
  onDismiss: () => void;
  onMute: (userId: string) => void;
  onUnmute: (userId: string) => void;
  onRemove: (userId: string) => void;
}

const ROLE_ORDER: Record<string, number> = {
  host: 0,
  "co-host": 1,
  moderator: 2,
  participant: 3,
};

function getRoleMeta(role: string) {
  switch (role) {
    case "host":
      return {
        label: "Host",
        icon: <Crown size={12} color="#FBBF24" />,
        tint: "rgba(251, 191, 36, 0.16)",
        text: "#FCD34D",
      };
    case "co-host":
      return {
        label: "Co-Host",
        icon: <Shield size={12} color="#8B5CF6" />,
        tint: "rgba(139, 92, 246, 0.16)",
        text: "#C4B5FD",
      };
    case "moderator":
      return {
        label: "Moderator",
        icon: <Shield size={12} color="#3B82F6" />,
        tint: "rgba(59, 130, 246, 0.16)",
        text: "#93C5FD",
      };
    default:
      return {
        label: "Listener",
        icon: <Users size={12} color="#38BDF8" />,
        tint: "rgba(56, 189, 248, 0.14)",
        text: "#7DD3FC",
      };
  }
}

export function RoomParticipantsSheet({
  visible,
  participants,
  localUserId,
  isHost,
  onDismiss,
  onMute,
  onUnmute,
  onRemove,
}: RoomParticipantsSheetProps) {
  const modalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["78%"], []);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
      return;
    }

    modalRef.current?.dismiss();
  }, [visible]);

  const sortedParticipants = useMemo(
    () =>
      [...participants].sort((a, b) => {
        const aOrder = ROLE_ORDER[a.role] ?? 99;
        const bOrder = ROLE_ORDER[b.role] ?? 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
        if (!!a.isHandRaised !== !!b.isHandRaised) {
          return a.isHandRaised ? -1 : 1;
        }
        if (a.id === localUserId) return -1;
        if (b.id === localUserId) return 1;
        return (a.user.displayName || a.user.username || "").localeCompare(
          b.user.displayName || b.user.username || "",
        );
      }),
    [participants, localUserId],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.56}
        pressBehavior="close"
      />
    ),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: VideoParticipant }) => {
      const roleMeta = getRoleMeta(item.role);
      const isSelf = item.id === localUserId;
      const canModerate = isHost && !isSelf && item.role !== "host";
      const label =
        item.user.anonLabel ||
        item.user.displayName ||
        item.user.username ||
        "Guest";

      return (
        <View
          style={{
            marginBottom: 12,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            backgroundColor: "rgba(11, 13, 18, 0.58)",
            padding: 14,
          }}
        >
          <View className="flex-row items-center">
            {item.user.isAnonymous ? (
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.08)",
                }}
              >
                <EyeOff size={20} color="#94A3B8" />
              </View>
            ) : (
              <Avatar
                uri={item.user.avatar}
                username={item.user.username}
                size={48}
                variant="roundedSquare"
              />
            )}

            <View className="flex-1 ml-3">
              <View className="flex-row items-center">
                <Text
                  className="text-white text-[15px] font-semibold flex-1"
                  numberOfLines={1}
                >
                  {label}
                  {isSelf ? " (You)" : ""}
                </Text>
              </View>

              <View className="flex-row items-center flex-wrap mt-2">
                <View
                  className="flex-row items-center"
                  style={{
                    backgroundColor: roleMeta.tint,
                    borderRadius: 999,
                    paddingHorizontal: 9,
                    paddingVertical: 5,
                    marginRight: 8,
                  }}
                >
                  {roleMeta.icon}
                  <Text
                    style={{
                      color: roleMeta.text,
                      fontSize: 11,
                      fontWeight: "700",
                      marginLeft: 5,
                    }}
                  >
                    {roleMeta.label}
                  </Text>
                </View>

                <View
                  className="flex-row items-center"
                  style={{
                    backgroundColor: item.isMicOn
                      ? "rgba(16, 185, 129, 0.12)"
                      : "rgba(239, 68, 68, 0.12)",
                    borderRadius: 999,
                    paddingHorizontal: 9,
                    paddingVertical: 5,
                    marginRight: 8,
                  }}
                >
                  {item.isMicOn ? (
                    <Mic size={11} color="#34D399" />
                  ) : (
                    <MicOff size={11} color="#F87171" />
                  )}
                  <Text
                    style={{
                      color: item.isMicOn ? "#A7F3D0" : "#FCA5A5",
                      fontSize: 11,
                      fontWeight: "700",
                      marginLeft: 5,
                    }}
                  >
                    {item.isMicOn ? "Live mic" : "Muted"}
                  </Text>
                </View>

                <View
                  className="flex-row items-center"
                  style={{
                    backgroundColor: "rgba(148, 163, 184, 0.12)",
                    borderRadius: 999,
                    paddingHorizontal: 9,
                    paddingVertical: 5,
                  }}
                >
                  {item.isCameraOn ? (
                    <Video size={11} color="#7DD3FC" />
                  ) : (
                    <VideoOff size={11} color="#94A3B8" />
                  )}
                  <Text
                    style={{
                      color: "#CBD5E1",
                      fontSize: 11,
                      fontWeight: "700",
                      marginLeft: 5,
                    }}
                  >
                    {item.isCameraOn ? "Video on" : "Audio only"}
                  </Text>
                </View>

                {item.isHandRaised ? (
                  <View
                    className="flex-row items-center"
                    style={{
                      backgroundColor: "rgba(120, 53, 15, 0.24)",
                      borderRadius: 999,
                      paddingHorizontal: 9,
                      paddingVertical: 5,
                      marginLeft: 8,
                    }}
                  >
                    <Hand size={11} color="#FCD34D" />
                    <Text
                      style={{
                        color: "#FDE68A",
                        fontSize: 11,
                        fontWeight: "700",
                        marginLeft: 5,
                      }}
                    >
                      Hand raised
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {canModerate && (
            <View className="flex-row mt-4">
              <Pressable
                onPress={() =>
                  item.isMicOn ? onMute(item.id) : onUnmute(item.id)
                }
                style={{
                  flex: 1,
                  marginRight: 10,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: item.isMicOn
                    ? "rgba(248, 113, 113, 0.25)"
                    : "rgba(52, 211, 153, 0.24)",
                  backgroundColor: item.isMicOn
                    ? "rgba(127, 29, 29, 0.34)"
                    : "rgba(6, 78, 59, 0.34)",
                  paddingVertical: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View className="flex-row items-center">
                  {item.isMicOn ? (
                    <MicOff size={15} color="#FCA5A5" />
                  ) : (
                    <Mic size={15} color="#6EE7B7" />
                  )}
                  <Text
                    style={{
                      color: item.isMicOn ? "#FECACA" : "#A7F3D0",
                      fontSize: 13,
                      fontWeight: "700",
                      marginLeft: 7,
                    }}
                  >
                    {item.isMicOn ? "Mute user" : "Unmute user"}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => onRemove(item.id)}
                style={{
                  flexDirection: "row",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(248, 113, 113, 0.28)",
                  backgroundColor: "rgba(127, 29, 29, 0.34)",
                  paddingHorizontal: 14,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UserMinus size={16} color="#FCA5A5" />
                <Text
                  style={{
                    color: "#FECACA",
                    fontSize: 13,
                    fontWeight: "700",
                    marginLeft: 7,
                  }}
                >
                  Remove
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      );
    },
    [isHost, localUserId, onMute, onRemove, onUnmute],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      detached={true}
      bottomInset={20}
      enablePanDownToClose
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      backgroundComponent={GlassSheetBackground}
      handleIndicatorStyle={{
        backgroundColor: "rgba(255,255,255,0.28)",
        width: 38,
        height: 4,
      }}
      style={{ marginHorizontal: 12, zIndex: 9999, elevation: 9999 }}
    >
      <View className="px-5 pt-1 pb-3">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-white text-[20px] font-bold">
              Live roster
            </Text>
            <Text className="text-neutral-400 text-[13px] mt-1">
              {isHost
                ? "Tap into the room and control who can stay live."
                : "Everyone currently inside the room."}
            </Text>
          </View>
          <Pressable
            onPress={onDismiss}
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          >
            <X size={18} color="#CBD5E1" />
          </Pressable>
        </View>

        <View
          className="flex-row items-center"
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            backgroundColor: "rgba(255,255,255,0.05)",
            paddingHorizontal: 14,
            paddingVertical: 12,
            marginBottom: 14,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(56, 189, 248, 0.14)",
            }}
          >
            <Users size={18} color="#7DD3FC" />
          </View>
          <View className="ml-3">
            <Text className="text-white text-[15px] font-semibold">
              {participants.length} active now
            </Text>
            <Text className="text-neutral-400 text-[12px] mt-0.5">
              Host, co-hosts, and listeners are all visible here.
            </Text>
          </View>
        </View>
      </View>

      <BottomSheetFlatList
        data={sortedParticipants}
        keyExtractor={(item: VideoParticipant) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />
    </BottomSheetModal>
  );
}
