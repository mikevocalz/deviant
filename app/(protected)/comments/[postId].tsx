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
import { X, Send } from "lucide-react-native";
import { useEffect, useCallback, useLayoutEffect, useMemo } from "react";
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
import {
  ThreadedComment,
  type CommentData,
} from "@/components/comments/threaded-comment";

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
  // STABILIZED: Only use boolean check from store
  // Counts come from server via comment data, NOT from store
  const { isCommentLiked } = usePostStore();
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

              // Transform to CommentData format for ThreadedComment component
              const commentData: CommentData = {
                id: item.id,
                username: item.username,
                avatar: item.avatar,
                text: item.text,
                timeAgo: item.timeAgo,
                likes: item.likes,
                replies: item.replies
                  ?.filter((r) => r && r.id && r.username && r.text)
                  .map((r) => ({
                    id: r.id,
                    username: r.username,
                    avatar: r.avatar,
                    text: r.text,
                    timeAgo: r.timeAgo,
                    likes: r.likes,
                  })),
              };

              return (
                <ThreadedComment
                  key={item.id}
                  comment={commentData}
                  isHighlighted={isHighlightedComment}
                  isLiked={isCommentLiked}
                  onLike={(cid, isCurrentlyLiked) => {
                    likeCommentMutation.mutate({
                      commentId: cid,
                      isLiked: isCurrentlyLiked,
                    });
                  }}
                  onReply={handleReply}
                  onViewAllReplies={handleViewReplies}
                  onProfilePress={handleProfilePress}
                  maxVisibleReplies={isHighlightedComment ? 100 : 2}
                  showAllReplies={isHighlightedComment}
                />
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
