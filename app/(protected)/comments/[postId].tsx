
import {
  View,
  Text,
  TextInput,
  Pressable,
  Keyboard,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { X, Send, Heart } from "lucide-react-native";
import { useEffect, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCommentsStore } from "@/lib/stores/comments-store";
import { useComments, useCreateComment } from "@/lib/hooks/use-comments";

export default function CommentsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { commentId } = useLocalSearchParams<{ commentId?: string }>();
  const router = useRouter();
  const {
    newComment: comment,
    replyingTo,
    setNewComment: setComment,
    setReplyingTo,
  } = useCommentsStore();
  const insets = useSafeAreaInsets();

  // Fetch real comments from API
  const { data: comments = [], isLoading } = useComments(postId || "");
  const createComment = useCreateComment();

  const handleSend = useCallback(() => {
    if (!comment.trim() || !postId || createComment.isPending) return;
    const commentText = comment.trim();
    const parentId = replyingTo || undefined;
    createComment.mutate(
      {
        post: postId,
        text: commentText,
        parent: parentId,
      },
      {
        onSuccess: () => {
          setComment("");
          setReplyingTo(null);
          Keyboard.dismiss();
        },
        onError: (error: any) => {
          console.error("[Comments] Failed to create comment:", error);
          console.error("[Comments] Error details:", JSON.stringify(error, null, 2));
          // Show error to user
          const errorMessage = error?.message || error?.error?.message || "Failed to create comment. Please try again.";
          Alert.alert("Error", errorMessage);
        },
      },
    );
  }, [comment, postId, replyingTo, createComment, setComment, setReplyingTo]);

  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setReplyingTo(null);
      },
    );

    return () => {
      keyboardDidHideListener.remove();
    };
  }, [setReplyingTo]);

  const handleReply = useCallback(
    (username: string, commentIdParam: string) => {
      if (!username || !commentIdParam) return;
      setReplyingTo(commentIdParam);
      setComment(`@${username} `);
    },
    [setReplyingTo, setComment],
  );

  const handleViewReplies = useCallback(
    (commentIdParam: string) => {
      if (!commentIdParam) return;
      router.push(`/(protected)/comments/replies/${commentIdParam}`);
    },
    [router],
  );

  const handleProfilePress = useCallback(
    (username: string) => {
      if (!username) return;
      router.push(`/(protected)/profile/${username}`);
    },
    [router],
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomWidth: 1,
          borderBottomColor: "#1a1a1a",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <View style={{ width: 24 }} />
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>
          Comments
        </Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <X size={24} color="#fff" />
        </Pressable>
      </View>

      <KeyboardAwareScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={100}
        enabled={true}
      >
        {isLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator size="small" color="#3EA4E5" />
            <Text style={{ color: "#666", fontSize: 12, marginTop: 8 }}>
              Loading comments...
            </Text>
          </View>
        ) : comments.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ color: "#999" }}>No comments yet</Text>
            <Text style={{ color: "#666", fontSize: 12, marginTop: 8 }}>
              Be the first to comment!
            </Text>
          </View>
        ) : (
          comments
            .filter((item) => item && item.id && item.username && item.text)
            .map((item) => {
              const isHighlightedComment = item.id === commentId;
              return (
                <View key={item.id} style={{ marginBottom: 20 }}>
                {isHighlightedComment && (
                  <View
                    style={{
                      position: "absolute",
                      left: -4,
                      top: 0,
                      bottom: 0,
                      width: 3,
                      backgroundColor: "#3EA4E5",
                      borderRadius: 2,
                    }}
                  />
                )}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Pressable onPress={() => handleProfilePress(item.username)}>
                    <Image
                      source={{ uri: item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username)}` }}
                      style={{ width: 36, height: 36, borderRadius: 18 }}
                    />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Pressable
                        onPress={() => handleProfilePress(item.username)}
                      >
                        <Text
                          style={{
                            fontWeight: "600",
                            fontSize: 14,
                            color: "#fff",
                          }}
                        >
                          {item.username}
                        </Text>
                      </Pressable>
                      <Text style={{ color: "#666", fontSize: 12 }}>
                        {item.timeAgo || ""}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 14,
                        marginTop: 4,
                        lineHeight: 20,
                        color: "#fff",
                      }}
                    >
                      {item.text}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 16,
                        marginTop: 8,
                      }}
                    >
                      <Pressable
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Heart size={16} color="#666" />
                        <Text style={{ color: "#666", fontSize: 12 }}>
                          {item.likes || 0}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleReply(item.username, item.id)}
                      >
                        <Text
                          style={{
                            color: "#666",
                            fontSize: 12,
                            fontWeight: "500",
                          }}
                        >
                          Reply
                        </Text>
                      </Pressable>
                    </View>

                    {item.replies && Array.isArray(item.replies) && item.replies.length > 0 && (
                      <View style={{ marginTop: 12 }}>
                        {isHighlightedComment ? (
                          <>
                            <Text
                              style={{
                                color: "#3EA4E5",
                                fontSize: 12,
                                fontWeight: "600",
                                marginBottom: 8,
                              }}
                            >
                              All {item.replies.length} replies
                            </Text>
                            {item.replies
                              .filter((reply) => reply && reply.id && reply.username && reply.text)
                              .map((reply) => {
                                if (!reply || !reply.id || !reply.username || !reply.text) return null;
                                return (
                              <View
                                key={reply.id}
                                style={{
                                  flexDirection: "row",
                                  gap: 8,
                                  marginBottom: 8,
                                  marginLeft: 12,
                                }}
                              >
                                <Pressable
                                  onPress={() =>
                                    handleProfilePress(reply.username)
                                  }
                                >
                                  <Image
                                    source={{ uri: reply.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.username)}` }}
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: 14,
                                    }}
                                  />
                                </Pressable>
                                <View style={{ flex: 1 }}>
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <Pressable
                                      onPress={() =>
                                        handleProfilePress(reply.username)
                                      }
                                    >
                                      <Text
                                        style={{
                                          fontWeight: "600",
                                          fontSize: 13,
                                          color: "#fff",
                                        }}
                                      >
                                        {reply.username}
                                      </Text>
                                    </Pressable>
                                    <Text
                                      style={{ color: "#666", fontSize: 11 }}
                                    >
                                      {reply.timeAgo || ""}
                                    </Text>
                                  </View>
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      marginTop: 2,
                                      lineHeight: 18,
                                      color: "#fff",
                                    }}
                                  >
                                    {reply.text}
                                  </Text>
                                </View>
                              </View>
                                );
                              })
                              .filter(Boolean)}
                          </>
                        ) : (
                          <>
                            {item.replies
                              .filter((reply) => reply && reply.id && reply.username && reply.text)
                              .slice(0, 2)
                              .map((reply) => {
                                if (!reply || !reply.id || !reply.username || !reply.text) return null;
                                return (
                              <View
                                key={reply.id}
                                style={{
                                  flexDirection: "row",
                                  gap: 8,
                                  marginBottom: 8,
                                  marginLeft: 12,
                                }}
                              >
                                <Pressable
                                  onPress={() =>
                                    handleProfilePress(reply.username)
                                  }
                                >
                                  <Image
                                    source={{ uri: reply.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.username)}` }}
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: 14,
                                    }}
                                  />
                                </Pressable>
                                <View style={{ flex: 1 }}>
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <Pressable
                                      onPress={() =>
                                        handleProfilePress(reply.username)
                                      }
                                    >
                                      <Text
                                        style={{
                                          fontWeight: "600",
                                          fontSize: 13,
                                          color: "#fff",
                                        }}
                                      >
                                        {reply.username}
                                      </Text>
                                    </Pressable>
                                    <Text
                                      style={{ color: "#666", fontSize: 11 }}
                                    >
                                      {reply.timeAgo || ""}
                                    </Text>
                                  </View>
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      marginTop: 2,
                                      lineHeight: 18,
                                      color: "#fff",
                                    }}
                                  >
                                    {reply.text}
                                  </Text>
                                </View>
                              </View>
                                );
                              })
                              .filter(Boolean)}

                            {item.replies.length > 2 && (
                              <Pressable
                                onPress={() => handleViewReplies(item.id)}
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                  marginTop: 4,
                                  marginLeft: 12,
                                }}
                              >
                                <View
                                  style={{
                                    width: 20,
                                    height: 1,
                                    backgroundColor: "#333",
                                  }}
                                />
                                <Text style={{ color: "#666", fontSize: 12 }}>
                                  View all {item.replies.length} replies
                                </Text>
                              </Pressable>
                            )}
                          </>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </KeyboardAwareScrollView>

      {/* Input at bottom - outside scroll view */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: "#1a1a1a",
            paddingHorizontal: 16,
            paddingVertical: 12,
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: "#000",
          }}
        >
        {replyingTo && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Text style={{ color: "#666", fontSize: 12 }}>
              Replying to comment
            </Text>
            <Pressable
              onPress={() => {
                setReplyingTo(null);
                setComment("");
                Keyboard.dismiss();
              }}
              hitSlop={8}
            >
              <X size={16} color="#666" />
            </Pressable>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Add a comment..."
            placeholderTextColor="#666"
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            enablesReturnKeyAutomatically={true}
            style={{
              flex: 1,
              minHeight: 40,
              maxHeight: 100,
              backgroundColor: "#1a1a1a",
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              color: "#fff",
            }}
          />
          <Pressable
            onPress={handleSend}
            disabled={!comment.trim() || createComment.isPending}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: comment.trim() && !createComment.isPending ? "#3EA4E5" : "#1a1a1a",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {createComment.isPending ? (
              <ActivityIndicator size="small" color="#666" />
            ) : (
              <Send size={20} color={comment.trim() ? "#fff" : "#666"} />
            )}
          </Pressable>
        </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
