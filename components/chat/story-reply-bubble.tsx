/**
 * StoryReplyBubble — Instagram-style story reply context in DMs
 *
 * Shows the story thumbnail alongside the reply text.
 * If the story has expired, shows "Story no longer available"
 * with a dimmed/blurred placeholder — identical to Instagram behavior.
 */

import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { ImageOff } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import type { StoryReplyContext } from "@/lib/stores/chat-store";

interface StoryReplyBubbleProps {
  storyReply: StoryReplyContext;
  replyText: string;
  isOwnMessage: boolean;
}

export function StoryReplyBubble({
  storyReply,
  replyText,
  isOwnMessage,
}: StoryReplyBubbleProps) {
  const router = useRouter();

  const handleStoryPress = useCallback(() => {
    if (storyReply.isExpired) return;
    if (storyReply.storyId) {
      router.push(`/(protected)/story/${storyReply.storyId}` as any);
    }
  }, [storyReply, router]);

  const handleProfilePress = useCallback(() => {
    if (storyReply.storyUsername) {
      router.push(`/(protected)/profile/${storyReply.storyUsername}` as any);
    }
  }, [storyReply.storyUsername, router]);

  return (
    <View
      className={`rounded-2xl overflow-hidden ${
        isOwnMessage ? "bg-primary/10" : "bg-secondary"
      }`}
      style={{ maxWidth: 280 }}
    >
      {/* Story context header — tap navigates to author profile, not story */}
      <Pressable
        onPress={handleProfilePress}
        className="flex-row items-center gap-2 px-3 pt-2.5 pb-1.5"
      >
        {/* Mini avatar */}
        {storyReply.storyAvatar ? (
          <Image
            source={{ uri: storyReply.storyAvatar }}
            style={{ width: 16, height: 16, borderRadius: 8 }}
          />
        ) : (
          <View
            className="items-center justify-center rounded-full bg-muted"
            style={{ width: 16, height: 16 }}
          >
            <Text style={{ fontSize: 8, color: "#fff" }}>
              {storyReply.storyUsername?.charAt(0).toUpperCase() || "?"}
            </Text>
          </View>
        )}
        <Text className="text-muted-foreground text-[11px]">
          {isOwnMessage
            ? `You replied to ${storyReply.storyUsername}'s story`
            : `Replied to your story`}
        </Text>
      </Pressable>

      {/* Story thumbnail + expired state */}
      <Pressable
        onPress={handleStoryPress}
        disabled={storyReply.isExpired}
        className="mx-2.5 mb-1.5 rounded-xl overflow-hidden"
        style={{ height: 160 }}
      >
        {storyReply.isExpired ? (
          /* Expired story — dimmed placeholder */
          <View
            className="flex-1 items-center justify-center rounded-xl"
            style={{ backgroundColor: "rgba(30,30,30,0.8)" }}
          >
            <ImageOff size={28} color="rgba(255,255,255,0.25)" />
            <Text
              className="text-white/30 text-xs font-medium mt-2 text-center"
              style={{ maxWidth: 140 }}
            >
              Story no longer available
            </Text>
          </View>
        ) : storyReply.storyMediaUrl ? (
          /* Active story — show thumbnail */
          <Image
            source={{ uri: storyReply.storyMediaUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          /* No media URL — gradient placeholder */
          <View
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: "#1a1a1a" }}
          >
            <Text className="text-white/40 text-xs">Story</Text>
          </View>
        )}
      </Pressable>

      {/* Reply text */}
      <View className="px-3 pb-2.5 pt-1">
        <Text
          className={`text-[15px] ${
            isOwnMessage ? "text-foreground" : "text-foreground"
          }`}
        >
          {replyText}
        </Text>
      </View>
    </View>
  );
}
