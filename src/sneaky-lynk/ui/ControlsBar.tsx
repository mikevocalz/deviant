/**
 * Controls Bar Component
 * Bottom bar with Leave, Hand raise, Chat, Mic, Video controls
 */

import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Hand, MessageCircle, Mic, MicOff, Video, VideoOff } from "lucide-react-native";

interface ControlsBarProps {
  isMuted: boolean;
  isVideoEnabled: boolean;
  handRaised: boolean;
  hasVideo: boolean;
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleHand: () => void;
  onOpenChat: () => void;
}

export function ControlsBar({
  isMuted,
  isVideoEnabled,
  handRaised,
  hasVideo,
  onLeave,
  onToggleMute,
  onToggleVideo,
  onToggleHand,
  onOpenChat,
}: ControlsBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center justify-between px-5 pt-4 bg-card border-t border-border"
      style={{ paddingBottom: insets.bottom + 10 }}
    >
      {/* Leave Button */}
      <Pressable
        onPress={onLeave}
        className="bg-destructive px-6 py-3.5 rounded-3xl"
      >
        <Text className="text-white text-[15px] font-semibold">Leave</Text>
      </Pressable>

      {/* Control Buttons */}
      <View className="flex-row gap-2.5">
        {/* Hand Raise */}
        <Pressable
          onPress={onToggleHand}
          className={`w-12 h-12 rounded-full items-center justify-center ${
            handRaised ? "bg-primary" : "bg-secondary"
          }`}
        >
          <Hand size={22} color={handRaised ? "#fff" : "#fff"} />
        </Pressable>

        {/* Chat */}
        <Pressable
          onPress={onOpenChat}
          className="w-12 h-12 rounded-full bg-secondary items-center justify-center"
        >
          <MessageCircle size={22} color="#fff" />
        </Pressable>

        {/* Mic Toggle */}
        <Pressable
          onPress={onToggleMute}
          className={`w-12 h-12 rounded-full items-center justify-center ${
            !isMuted ? "bg-primary" : "bg-secondary"
          }`}
        >
          {isMuted ? (
            <MicOff size={22} color="#fff" />
          ) : (
            <Mic size={22} color="#fff" />
          )}
        </Pressable>

        {/* Video Toggle (only if room supports video) */}
        {hasVideo && (
          <Pressable
            onPress={onToggleVideo}
            className={`w-12 h-12 rounded-full items-center justify-center ${
              isVideoEnabled ? "bg-primary" : "bg-secondary"
            }`}
          >
            {isVideoEnabled ? (
              <Video size={22} color="#fff" />
            ) : (
              <VideoOff size={22} color="#fff" />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}
