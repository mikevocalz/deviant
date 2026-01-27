import {
  View,
  Text,
  TextInput,
  Pressable,
  Keyboard,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardAvoidingView,
} from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { Image } from "expo-image";
import { X, Send, Heart } from "lucide-react-native";
import { useEffect, useCallback, useLayoutEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCommentsStore } from "@/lib/stores/comments-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  useComments,
  useCreateComment,
  useLikeComment,
} from "@/lib/hooks/use-comments";
import { useColorScheme } from "@/lib/hooks";
import { useUIStore } from "@/lib/stores/ui-store";
import { usePostStore } from "@/lib/stores/post-store";

export default function CommentsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { commentId } = useLocalSearchParams<{ commentId?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useColorScheme();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const {
    newComment: comment,
    replyingTo,
    setNewComment: setComment,
    setReplyingTo,
  } = useCommentsStore();
  const {
    isCommentLiked,
    toggleCommentLike,
    getCommentLikeCount,
    commentLikeCounts,
  } = usePostStore();
  const likeCommentMutation = useLikeComment();
  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: "Comments",
      headerTitleAlign: "center" as const,
      headerStyle: { backgroundColor: colors.background },
      headerTitleStyle: {
        color: colors.foreground,
        fontWeight: "600" as const,
        fontSize: 18,
      },
      headerBackVisible: true,
      headerBackTitle: "",
      headerTintColor: colors.foreground,
      headerRight: () => null,
    });
  }, [navigation, colors]);

  // Fetch real comments from API
  const { data: comments = [], isLoading } = useComments(postId || "");
  const createComment = useCreateComment();

  const handleSend = useCallback(() => {
    // Show immediate feedback that button was pressed
    console.log("[Comments] handleSend called");

    if (!comment.trim()) {
      showToast("warning", "Empty", "Please enter a comment");
      return;
    }
    if (!postId) {
      showToast("error", "Error", "No post ID found");
      return;
    }
    if (createComment.isPending) {
      showToast("info", "Wait", "Already sending...");
      return;
    }

    // Validate user is logged in
    if (!user) {
      showToast("error", "Error", "You must be logged in to comment");
      return;
    }

    if (!user.username) {
      showToast(
        "error",
        "Error",
        "User profile incomplete. Please log out and log back in.",
      );
      return;
    }

    // Show sending feedback
    showToast("info", "Sending", `Posting as @${user.username}...`);

    const commentText = comment.trim();
    const parentId = replyingTo || undefined;

    createComment.mutate(
      {
        post: postId,
        text: commentText,
        parent: parentId,
        authorUsername: user.username,
        authorId: user.id,
      },
      {
        onSuccess: () => {
          setComment("");
          setReplyingTo(null);
          Keyboard.dismiss();
          showToast("success", "Posted!", "Your comment was added");
        },
        onError: (error: any) => {
          console.error("[Comments] Error:", error);
          const errorMessage =
            error?.message ||
            error?.error?.message ||
            error?.error ||
            "Failed to create comment";
          showToast("error", "Failed", errorMessage);
        },
      },
    );
  }, [
    comment,
    postId,
    replyingTo,
    createComment,
    setComment,
    setReplyingTo,
    user,
    showToast,
  ]);

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
      if (!commentIdParam || !postId) return;
      router.push(
        `/(protected)/comments/replies/${commentIdParam}?postId=${postId}`,
      );
    },
    [router, postId],
  );

  const handleProfilePress = useCallback(
    (username: string) => {
      if (!username) return;
      router.push(`/(protected)/profile/${username}`);
    },
    [router],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
                    <Pressable
                      onPress={() => handleProfilePress(item.username)}
                    >
                      <Image
                        source={{
                          uri:
                            item.avatar ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username)}`,
                        }}
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
                          onPress={() => {
                            if (!item.id) return;
                            const wasLiked = isCommentLiked(item.id);
                            toggleCommentLike(item.id, item.likes || 0);
                            likeCommentMutation.mutate(
                              { commentId: item.id, isLiked: wasLiked },
                              {
                                onError: () => {
                                  // Rollback on error
                                  toggleCommentLike(item.id, item.likes || 0);
                                },
                              },
                            );
                          }}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Heart
                            size={16}
                            color={
                              isCommentLiked(item.id || "") ? "#FF5BFC" : "#666"
                            }
                            fill={
                              isCommentLiked(item.id || "") ? "#FF5BFC" : "none"
                            }
                          />
                          <Text style={{ color: "#666", fontSize: 12 }}>
                            {getCommentLikeCount(
                              item.id || "",
                              item.likes || 0,
                            )}
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

                      {/* THREADED REPLIES - Visually distinct with indentation + connector */}
                      {item.replies &&
                        Array.isArray(item.replies) &&
                        item.replies.length > 0 && (
                          <View style={{ marginTop: 12, position: "relative" }}>
                            {/* Vertical connector line */}
                            <View
                              style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                bottom: 8,
                                width: 2,
                                backgroundColor: "#2a2a2a",
                                borderRadius: 1,
                              }}
                            />

                            {isHighlightedComment ? (
                              <>
                                <Text
                                  style={{
                                    color: "#3EA4E5",
                                    fontSize: 12,
                                    fontWeight: "600",
                                    marginBottom: 8,
                                    marginLeft: 16,
                                  }}
                                >
                                  {item.replies.length}{" "}
                                  {item.replies.length === 1
                                    ? "reply"
                                    : "replies"}
                                </Text>
                                {item.replies
                                  .filter(
                                    (reply) =>
                                      reply &&
                                      reply.id &&
                                      reply.username &&
                                      reply.text,
                                  )
                                  .map((reply) => {
                                    if (
                                      !reply ||
                                      !reply.id ||
                                      !reply.username ||
                                      !reply.text
                                    )
                                      return null;
                                    return (
                                      <View
                                        key={reply.id}
                                        style={{
                                          flexDirection: "row",
                                          gap: 10,
                                          marginBottom: 12,
                                          marginLeft: 16,
                                          paddingLeft: 12,
                                          borderLeftWidth: 0,
                                        }}
                                      >
                                        {/* Horizontal connector */}
                                        <View
                                          style={{
                                            position: "absolute",
                                            left: 0,
                                            top: 14,
                                            width: 12,
                                            height: 2,
                                            backgroundColor: "#2a2a2a",
                                            marginLeft: -16,
                                          }}
                                        />
                                        <Pressable
                                          onPress={() =>
                                            handleProfilePress(reply.username)
                                          }
                                        >
                                          <Image
                                            source={{
                                              uri:
                                                reply.avatar ||
                                                `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.username)}`,
                                            }}
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
                                                handleProfilePress(
                                                  reply.username,
                                                )
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
                                              style={{
                                                color: "#555",
                                                fontSize: 11,
                                              }}
                                            >
                                              {reply.timeAgo || ""}
                                            </Text>
                                          </View>
                                          <Text
                                            style={{
                                              fontSize: 13,
                                              marginTop: 2,
                                              lineHeight: 18,
                                              color: "#e0e0e0",
                                            }}
                                          >
                                            {reply.text}
                                          </Text>
                                          {/* Reply like button - NO reply button (2-level only) */}
                                          <View
                                            style={{
                                              flexDirection: "row",
                                              alignItems: "center",
                                              gap: 16,
                                              marginTop: 6,
                                            }}
                                          >
                                            <Pressable
                                              onPress={() => {
                                                if (!reply.id) return;
                                                const wasLiked = isCommentLiked(
                                                  reply.id,
                                                );
                                                toggleCommentLike(
                                                  reply.id,
                                                  reply.likes || 0,
                                                );
                                                likeCommentMutation.mutate(
                                                  {
                                                    commentId: reply.id,
                                                    isLiked: wasLiked,
                                                  },
                                                  {
                                                    onError: () => {
                                                      toggleCommentLike(
                                                        reply.id,
                                                        reply.likes || 0,
                                                      );
                                                    },
                                                  },
                                                );
                                              }}
                                              style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: 4,
                                              }}
                                            >
                                              <Heart
                                                size={14}
                                                color={
                                                  isCommentLiked(reply.id || "")
                                                    ? "#FF5BFC"
                                                    : "#555"
                                                }
                                                fill={
                                                  isCommentLiked(reply.id || "")
                                                    ? "#FF5BFC"
                                                    : "none"
                                                }
                                              />
                                              <Text
                                                style={{
                                                  color: "#555",
                                                  fontSize: 11,
                                                }}
                                              >
                                                {getCommentLikeCount(
                                                  reply.id || "",
                                                  reply.likes || 0,
                                                )}
                                              </Text>
                                            </Pressable>
                                          </View>
                                        </View>
                                      </View>
                                    );
                                  })
                                  .filter(Boolean)}
                              </>
                            ) : (
                              <>
                                {item.replies
                                  .filter(
                                    (reply) =>
                                      reply &&
                                      reply.id &&
                                      reply.username &&
                                      reply.text,
                                  )
                                  .slice(0, 2)
                                  .map((reply, index) => {
                                    if (
                                      !reply ||
                                      !reply.id ||
                                      !reply.username ||
                                      !reply.text
                                    )
                                      return null;
                                    return (
                                      <View
                                        key={reply.id}
                                        style={{
                                          flexDirection: "row",
                                          gap: 10,
                                          marginBottom: 12,
                                          marginLeft: 16,
                                          paddingLeft: 12,
                                        }}
                                      >
                                        {/* Horizontal connector */}
                                        <View
                                          style={{
                                            position: "absolute",
                                            left: 0,
                                            top: 14,
                                            width: 12,
                                            height: 2,
                                            backgroundColor: "#2a2a2a",
                                            marginLeft: -16,
                                          }}
                                        />
                                        <Pressable
                                          onPress={() =>
                                            handleProfilePress(reply.username)
                                          }
                                        >
                                          <Image
                                            source={{
                                              uri:
                                                reply.avatar ||
                                                `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.username)}`,
                                            }}
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
                                                handleProfilePress(
                                                  reply.username,
                                                )
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
                                              style={{
                                                color: "#555",
                                                fontSize: 11,
                                              }}
                                            >
                                              {reply.timeAgo || ""}
                                            </Text>
                                          </View>
                                          <Text
                                            style={{
                                              fontSize: 13,
                                              marginTop: 2,
                                              lineHeight: 18,
                                              color: "#e0e0e0",
                                            }}
                                          >
                                            {reply.text}
                                          </Text>
                                          {/* Reply like button - NO reply button (2-level only) */}
                                          <View
                                            style={{
                                              flexDirection: "row",
                                              alignItems: "center",
                                              gap: 16,
                                              marginTop: 6,
                                            }}
                                          >
                                            <Pressable
                                              onPress={() => {
                                                if (!reply.id) return;
                                                const wasLiked = isCommentLiked(
                                                  reply.id,
                                                );
                                                toggleCommentLike(
                                                  reply.id,
                                                  reply.likes || 0,
                                                );
                                                likeCommentMutation.mutate(
                                                  {
                                                    commentId: reply.id,
                                                    isLiked: wasLiked,
                                                  },
                                                  {
                                                    onError: () => {
                                                      toggleCommentLike(
                                                        reply.id,
                                                        reply.likes || 0,
                                                      );
                                                    },
                                                  },
                                                );
                                              }}
                                              style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: 4,
                                              }}
                                            >
                                              <Heart
                                                size={14}
                                                color={
                                                  isCommentLiked(reply.id || "")
                                                    ? "#FF5BFC"
                                                    : "#555"
                                                }
                                                fill={
                                                  isCommentLiked(reply.id || "")
                                                    ? "#FF5BFC"
                                                    : "none"
                                                }
                                              />
                                              <Text
                                                style={{
                                                  color: "#555",
                                                  fontSize: 11,
                                                }}
                                              >
                                                {getCommentLikeCount(
                                                  reply.id || "",
                                                  reply.likes || 0,
                                                )}
                                              </Text>
                                            </Pressable>
                                          </View>
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
                                      marginLeft: 16,
                                      paddingLeft: 12,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: "#3EA4E5",
                                        fontSize: 12,
                                        fontWeight: "500",
                                      }}
                                    >
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
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 10 : 0}
        style={{ backgroundColor: "#000" }}
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
              disabled={!comment.trim() || createComment.isPending || !user}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor:
                  comment.trim() && !createComment.isPending && user
                    ? "#3EA4E5"
                    : "#1a1a1a",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {createComment.isPending ? (
                <ActivityIndicator size="small" color="#666" />
              ) : (
                <Send
                  size={20}
                  color={comment.trim() && user ? "#fff" : "#666"}
                />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
