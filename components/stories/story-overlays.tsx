/**
 * Story Overlay Components
 * Custom header, footer, close button, and text overlays
 * for react-native-insta-story integration.
 *
 * All overlays are absolute-positioned, pointer-events aware,
 * NativeWind styled, white-on-dark-media aesthetic.
 */

import {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  Keyboard,
  Platform,
  Animated,
} from "react-native";
import { X, Send, Heart, Star } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { messagesApiClient } from "@/lib/api/messages";
import { usersApi } from "@/lib/api/users";
import type { StoryItemCustomData } from "./story-adapter";
import type {
  IUserStoryItem,
  RenderCustomButton,
  RenderCustomText,
} from "react-native-insta-story";

// ── Reaction Tally Display ──────────────────────────────────────────

const REACTION_EMOJIS = ["❤️", "🔥", "😂", "😍", "👏", "😮"];

function ReactionTally({ counts }: { counts: Record<string, number> }) {
  const scale = useRef(new Animated.Value(0.6)).current;

  // Bounce in on mount
  useRef(
    Animated.spring(scale, {
      toValue: 1,
      speed: 30,
      bounciness: 14,
      useNativeDriver: true,
    }).start(),
  ).current;

  const entries = Object.entries(counts).filter(([, c]) => c > 0);
  if (entries.length === 0) return null;

  return (
    <Animated.View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        gap: 10,
        marginBottom: 8,
        transform: [{ scale }],
      }}
    >
      {entries.map(([emoji, count]) => (
        <View
          key={emoji}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
            borderRadius: 20,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
        >
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
          {count > 1 && (
            <Text
              style={{
                color: "#fff",
                fontSize: 14,
                fontWeight: "700",
                marginLeft: 4,
              }}
            >
              x{count}
            </Text>
          )}
        </View>
      ))}
    </Animated.View>
  );
}

// ── Close Button (renderCloseComponent) ─────────────────────────────

export const StoryCloseButton: RenderCustomButton = ({ onPress }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
      activeOpacity={0.6}
      style={{
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 18,
        backgroundColor: "rgba(0,0,0,0.3)",
      }}
    >
      <X size={20} color="#fff" strokeWidth={2.5} />
    </TouchableOpacity>
  );
};

// ── Header Text (renderTextComponent) ───────────────────────────────

export const StoryHeaderText: RenderCustomText = ({ profileName, item }) => {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const customData = (
    item as IUserStoryItem & { customData?: StoryItemCustomData }
  ).customData;

  const handleProfilePress = useCallback(() => {
    if (!customData?.username) return;
    if (
      customData.username.toLowerCase() === currentUser?.username?.toLowerCase()
    ) {
      router.push("/(protected)/(tabs)/profile");
    } else {
      router.push(`/(protected)/profile/${customData.username}` as any);
    }
  }, [customData?.username, currentUser?.username, router]);

  const isCFStory =
    customData?.visibility === "close_friends" || customData?.isCloseFriends;

  return (
    <View className="flex-row items-center ml-2.5">
      <Pressable
        onPress={handleProfilePress}
        className="flex-row items-center"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text className="text-white text-sm font-bold" numberOfLines={1}>
          {profileName}
        </Text>
        {customData && (
          <Text className="text-white/60 text-xs ml-2">
            {formatTimeAgo(customData.duration)}
          </Text>
        )}
      </Pressable>
      {isCFStory && (
        <View
          className="flex-row items-center ml-2 rounded-full px-2 py-0.5"
          style={{ backgroundColor: "rgba(252, 37, 58, 0.25)" }}
        >
          <Star size={10} color="#FC253A" fill="#FC253A" />
          <Text
            className="text-xs font-semibold ml-1"
            style={{ color: "#FC253A" }}
          >
            Close Friends
          </Text>
        </View>
      )}
    </View>
  );
};

// ── Swipe Up / Footer (renderSwipeUpComponent) ─────────────────────

export const StoryFooter: RenderCustomButton = ({ onPress, item }) => {
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(
    {},
  );
  const [showTally, setShowTally] = useState(false);
  const tallyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const customData = (
    item as IUserStoryItem & { customData?: StoryItemCustomData }
  ).customData;

  const isOwnStory =
    customData?.username?.toLowerCase() ===
    currentUser?.username?.toLowerCase();

  const handleReact = useCallback(
    async (emoji: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Tally the reaction
      setReactionCounts((prev) => ({
        ...prev,
        [emoji]: (prev[emoji] || 0) + 1,
      }));
      setShowTally(true);

      // Reset fade timer on each new tap
      if (tallyTimerRef.current) clearTimeout(tallyTimerRef.current);
      tallyTimerRef.current = setTimeout(() => {
        setShowTally(false);
        setReactionCounts({});
      }, 2500);

      // Send reaction as DM (Instagram-style)
      if (!customData || isOwnStory) return;
      try {
        let userId = customData.appUserId;
        if (!userId && customData.username) {
          const result = await usersApi.getProfileByUsername(
            customData.username,
          );
          userId = result?.id;
        }
        if (!userId) return;

        const conversationId =
          await messagesApiClient.getOrCreateConversation(userId);
        if (!conversationId) return;

        await messagesApiClient.sendMessage({
          conversationId,
          content: emoji,
          metadata: {
            type: "story_reaction",
            storyId: customData.appStoryId || "",
            storyMediaUrl: item.story_image || "",
            storyUsername: customData.username || "",
            storyAvatar: customData.avatar || "",
            reactionEmoji: emoji,
            storyExpiresAt: new Date(
              Date.now() + 24 * 60 * 60 * 1000,
            ).toISOString(),
          },
        });
        console.log("[StoryOverlay] Reaction sent:", emoji);
      } catch (error: any) {
        console.error(
          "[StoryOverlay] Reaction error:",
          error?.message || error,
        );
      }
    },
    [customData, isOwnStory, item],
  );

  const handleSendReply = useCallback(async () => {
    if (!replyText.trim() || isSending || !customData) return;
    if (isOwnStory) {
      showToast("info", "Info", "You can't reply to your own story");
      return;
    }

    setIsSending(true);
    Keyboard.dismiss();

    try {
      let userId = customData.appUserId;

      if (!userId && customData.username) {
        const result = await usersApi.getProfileByUsername(customData.username);
        userId = result?.id;
      }

      if (!userId) {
        showToast("error", "Error", "Could not find user");
        setIsSending(false);
        return;
      }

      const conversationId =
        await messagesApiClient.getOrCreateConversation(userId);
      if (!conversationId) {
        showToast("error", "Error", "Could not start conversation");
        setIsSending(false);
        return;
      }

      await messagesApiClient.sendMessage({
        conversationId,
        content: replyText.trim(),
        metadata: {
          type: "story_reply",
          storyId: customData.appStoryId || "",
          storyMediaUrl: item.story_image || "",
          storyUsername: customData.username || "",
          storyAvatar: customData.avatar || "",
          storyExpiresAt: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      });

      showToast("success", "Sent", "Reply sent to their messages");
      setReplyText("");
    } catch (error: any) {
      showToast("error", "Error", error?.message || "Failed to send reply");
    } finally {
      setIsSending(false);
      setIsInputFocused(false);
    }
  }, [replyText, isSending, customData, isOwnStory, showToast]);

  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: insets.bottom + 8,
      }}
      pointerEvents="box-none"
    >
      {/* Tallied reaction display */}
      {showTally && <ReactionTally counts={reactionCounts} />}

      {/* Emoji reaction row */}
      {!isInputFocused && !isOwnStory && (
        <View className="flex-row justify-center gap-4 mb-3 px-4">
          {REACTION_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => handleReact(emoji)}
              className="w-10 h-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
            >
              <Text style={{ fontSize: 20 }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Reply input — only for other users' stories */}
      {!isOwnStory && customData && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <View className="flex-row items-center gap-2 px-4 py-2">
            <View
              className="flex-1 flex-row items-center rounded-full px-4 py-2"
              style={{
                backgroundColor: "rgba(255,255,255,0.15)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.25)",
              }}
            >
              <TextInput
                style={{
                  flex: 1,
                  color: "#fff",
                  fontSize: 14,
                  paddingVertical: 6,
                }}
                placeholder={`Reply to ${customData.username}...`}
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={replyText}
                onChangeText={setReplyText}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                returnKeyType="send"
                onSubmitEditing={handleSendReply}
                editable={!isSending}
              />
            </View>

            {replyText.trim().length > 0 && (
              <Pressable
                onPress={handleSendReply}
                disabled={isSending}
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{
                  backgroundColor: "#8A40CF",
                  opacity: isSending ? 0.5 : 1,
                }}
              >
                <Send size={18} color="#fff" />
              </Pressable>
            )}

            {replyText.trim().length === 0 && (
              <Pressable
                onPress={() =>
                  handleReact(
                    REACTION_EMOJIS[
                      Math.floor(Math.random() * REACTION_EMOJIS.length)
                    ],
                  )
                }
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
              >
                <Heart size={20} color="#fff" />
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────

function formatTimeAgo(durationMs: number): string {
  // This is a placeholder — in the real app, the timestamp comes from the story item header
  // The library passes the item, so we can extract timing from customData
  return "";
}
