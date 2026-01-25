/**
 * Event Comments Screen
 *
 * Full comments page for an event with header title "Comments" and back button
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { useLayoutEffect } from "react";
import { Image } from "expo-image";
import { ArrowLeft, Send, MessageCircle } from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useEventComments, useCreateEventComment } from "@/lib/hooks/use-event-comments";
import { useUIStore } from "@/lib/stores/ui-store";

export default function EventCommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useColorScheme();
  const { user } = useAuthStore();
  const showToast = useUIStore((s) => s.showToast);
  const eventId = id || "";

  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: comments = [], isLoading, refetch } = useEventComments(eventId, 100);
  const createComment = useCreateEventComment();

  // Set up header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: "Comments",
      headerTitleAlign: "center" as const,
      headerStyle: {
        backgroundColor: colors.background,
      },
      headerTitleStyle: {
        color: colors.foreground,
        fontWeight: "600" as const,
        fontSize: 18,
      },
      headerLeft: () => (
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{ marginLeft: 8 }}
        >
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
      ),
    });
  }, [navigation, colors, router]);

  const handleSend = useCallback(async () => {
    if (!commentText.trim()) {
      showToast("warning", "Empty", "Please enter a comment");
      return;
    }
    if (isSubmitting) {
      showToast("info", "Wait", "Already sending...");
      return;
    }
    
    if (!user) {
      showToast("error", "Error", "You must be logged in to comment");
      return;
    }

    // Show sending feedback
    showToast("info", "Sending", `Posting as @${user.username}...`);
    setIsSubmitting(true);
    
    try {
      await createComment.mutateAsync({
        eventId,
        text: commentText.trim(),
        authorUsername: user.username,
      });
      setCommentText("");
      showToast("success", "Posted!", "Your comment was added");
      refetch();
    } catch (error: any) {
      console.error("[EventComments] Error:", error);
      const errorMessage = error?.error || error?.message || "Failed to post comment";
      showToast("error", "Failed", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [commentText, isSubmitting, eventId, createComment, refetch, showToast, user]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : comments.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 40 }}>
            <MessageCircle size={48} color={colors.mutedForeground} />
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: colors.foreground,
                marginTop: 16,
                marginBottom: 8,
              }}
            >
              No Comments Yet
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.mutedForeground,
                textAlign: "center",
              }}
            >
              Be the first to share your thoughts about this event!
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {comments.map((comment: any) => (
              <View
                key={comment.id}
                style={{
                  flexDirection: "row",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <Image
                  source={{
                    uri:
                      comment.author?.avatar ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        comment.author?.username || comment.author?.name || "User",
                      )}`,
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "600",
                        color: colors.foreground,
                      }}
                    >
                      {comment.author?.username || comment.author?.name || "User"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.mutedForeground,
                      }}
                    >
                      {formatDate(comment.createdAt)}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.foreground,
                      lineHeight: 20,
                    }}
                  >
                    {comment.content}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Comment Input */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingHorizontal: 16,
            paddingVertical: 12,
            paddingBottom: Platform.OS === "ios" ? 20 : 12,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 8,
            }}
          >
            <Image
              source={{
                uri:
                  user?.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user?.name || "User",
                  )}`,
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
              }}
            />
            <View
              style={{
                flex: 1,
                backgroundColor: colors.card,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 16,
                paddingVertical: 10,
                maxHeight: 100,
              }}
            >
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Add a comment..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={{
                  color: colors.foreground,
                  fontSize: 14,
                  maxHeight: 80,
                }}
                editable={!isSubmitting}
              />
            </View>
            {commentText.trim().length > 0 && (
              <Pressable
                onPress={handleSend}
                disabled={isSubmitting}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isSubmitting ? 0.5 : 1,
                }}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Send size={18} color="#fff" />
                )}
              </Pressable>
            )}
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
