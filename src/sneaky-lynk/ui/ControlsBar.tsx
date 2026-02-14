/**
 * Controls Bar Component
 * Floating glass-morphism interaction dock
 * Clubhouse x Twitter Spaces x TikTok Live aesthetic
 */

import { View, Text, Pressable, Animated, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Hand,
  Lock,
  MessageCircle,
  Mic,
  MicOff,
  Video,
  VideoOff,
  LogOut,
  Share2,
  Heart,
} from "lucide-react-native";
import { useRef, useCallback, useState } from "react";
import * as Haptics from "expo-haptics";

interface ControlsBarProps {
  isMuted: boolean;
  isVideoEnabled: boolean;
  handRaised: boolean;
  hasVideo: boolean;
  localRole: "host" | "co-host" | "listener";
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleHand: () => void;
  onOpenChat: () => void;
  onShare?: () => void;
}

// ── Floating emoji reaction ─────────────────────────────────────────
const REACTION_EMOJIS = ["❤️", "", "�", "�"];

function FloatingEmoji({
  emoji,
  onComplete,
}: {
  emoji: string;
  onComplete: () => void;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const translateX = useRef(
    new Animated.Value((Math.random() - 0.5) * 60),
  ).current;

  useRef(
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200 - Math.random() * 100,
        duration: 2000,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 2000,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(onComplete),
  ).current;

  return (
    <Animated.Text
      style={{
        position: "absolute",
        bottom: 70,
        right: 20,
        fontSize: 28,
        opacity,
        transform: [{ translateY }, { translateX }, { scale }],
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

// ── Control button ──────────────────────────────────────────────────
function ControlButton({
  onPress,
  isActive,
  isDanger,
  icon,
  label,
  size = 48,
}: {
  onPress: () => void;
  isActive?: boolean;
  isDanger?: boolean;
  icon: React.ReactNode;
  label?: string;
  size?: number;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  return (
    <View className="items-center gap-1">
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          className={`items-center justify-center rounded-full ${
            isDanger ? "bg-red-500/20" : isActive ? "bg-white/15" : "bg-white/8"
          }`}
          style={{ width: size, height: size }}
        >
          {icon}
        </Pressable>
      </Animated.View>
      {label && (
        <Text className="text-[10px] text-white/50 font-medium">{label}</Text>
      )}
    </View>
  );
}

export function ControlsBar({
  isMuted,
  isVideoEnabled,
  handRaised,
  hasVideo,
  localRole,
  onLeave,
  onToggleMute,
  onToggleVideo,
  onToggleHand,
  onOpenChat,
  onShare,
}: ControlsBarProps) {
  const canSpeak = localRole === "host" || localRole === "co-host";
  const insets = useSafeAreaInsets();
  const [floatingEmojis, setFloatingEmojis] = useState<
    { id: number; emoji: string }[]
  >([]);
  const emojiCounter = useRef(0);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleSendEmoji = useCallback((emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const id = emojiCounter.current++;
    setFloatingEmojis((prev) => [...prev, { id, emoji }]);
    setShowEmojiPicker(false);
  }, []);

  const handleToggleEmojiPicker = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowEmojiPicker((prev) => !prev);
  }, []);

  const removeEmoji = useCallback((id: number) => {
    setFloatingEmojis((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return (
    <View style={{ paddingBottom: insets.bottom + 8 }}>
      {/* Floating reactions */}
      {floatingEmojis.map((e) => (
        <FloatingEmoji
          key={e.id}
          emoji={e.emoji}
          onComplete={() => removeEmoji(e.id)}
        />
      ))}

      {/* Emoji picker tray — rendered ABOVE the dock so borderRadius doesn't clip */}
      {showEmojiPicker && (
        <View
          style={{
            alignSelf: "center",
            flexDirection: "row",
            backgroundColor: "rgba(30, 30, 30, 0.95)",
            borderRadius: 24,
            paddingHorizontal: 10,
            paddingVertical: 8,
            gap: 6,
            marginBottom: 8,
            marginHorizontal: 16,
          }}
        >
          {REACTION_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => handleSendEmoji(emoji)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.08)",
              }}
            >
              <Text style={{ fontSize: 24 }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Dock */}
      <View
        className="mx-4 flex-row items-center justify-between px-4 py-3 rounded-2xl"
        style={{ backgroundColor: "rgba(20, 20, 20, 0.85)" }}
      >
        {/* Mic — only host/co-host can toggle */}
        {canSpeak ? (
          <ControlButton
            onPress={onToggleMute}
            isActive={!isMuted}
            icon={
              isMuted ? (
                <MicOff size={20} color="#EF4444" />
              ) : (
                <Mic size={20} color="#fff" />
              )
            }
          />
        ) : (
          <View className="items-center gap-1">
            <View
              className="items-center justify-center rounded-full bg-white/5"
              style={{ width: 48, height: 48 }}
            >
              <Lock size={18} color="#6B7280" />
            </View>
          </View>
        )}

        {/* Video — only host/co-host */}
        {hasVideo && canSpeak && (
          <ControlButton
            onPress={onToggleVideo}
            isActive={isVideoEnabled}
            icon={
              isVideoEnabled ? (
                <Video size={20} color="#fff" />
              ) : (
                <VideoOff size={20} color="#EF4444" />
              )
            }
          />
        )}

        {/* Hand Raise — listeners use this to request to speak */}
        <ControlButton
          onPress={onToggleHand}
          isActive={handRaised}
          icon={<Hand size={20} color={handRaised ? "#F59E0B" : "#fff"} />}
        />

        {/* React — toggles emoji picker above dock */}
        <ControlButton
          onPress={handleToggleEmojiPicker}
          isActive={showEmojiPicker}
          icon={<Heart size={20} color="#FF6DC1" />}
        />

        {/* Chat */}
        <ControlButton
          onPress={onOpenChat}
          icon={<MessageCircle size={20} color="#fff" />}
        />

        {/* Share */}
        {onShare && (
          <ControlButton
            onPress={onShare}
            icon={<Share2 size={20} color="#fff" />}
          />
        )}

        {/* Leave — danger accent */}
        <ControlButton
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onLeave();
          }}
          isDanger
          icon={<LogOut size={20} color="#EF4444" />}
        />
      </View>
    </View>
  );
}
