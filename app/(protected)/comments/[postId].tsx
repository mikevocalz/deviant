import {
  View,
  Text,
  Pressable,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SheetHeader } from "@/components/ui/sheet-header";
import { X, Send } from "lucide-react-native";
import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCommentsStore } from "@/lib/stores/comments-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useComments, useCreateComment } from "@/lib/hooks/use-comments";
import { useColorScheme } from "@/lib/hooks";
import { useUIStore } from "@/lib/stores/ui-store";
import { Image } from "expo-image";
import {
  ThreadedComment,
  type CommentData,
} from "@/components/comments/threaded-comment";
import { usersApi } from "@/lib/api/users";
import { useQuery } from "@tanstack/react-query";

// Generate unique client mutation ID for idempotency
function generateMutationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function CommentsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { commentId } = useLocalSearchParams<{ commentId?: string }>();
  const router = useRouter();
  const { colors } = useColorScheme();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const {
    newComment: comment,
    replyingTo,
    setNewComment: setComment,
    setReplyingTo,
  } = useCommentsStore();
  const insets = useSafeAreaInsets();

  // PHASE 1 FIX: Robust submit lock to prevent duplicates
  const [isSubmitLocked, setIsSubmitLocked] = useState(false);
  const lastSubmitTimeRef = useRef<number>(0);
  const submitCooldownMs = 2000; // 2 second cooldown between submits

  // @mention autocomplete state
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<any>(null);

  // Fetch real comments from API
  const { data: comments = [], isLoading } = useComments(postId || "");
  const createComment = useCreateComment();

  const handleSend = useCallback(() => {
    // PHASE 1 FIX: Comprehensive duplicate prevention
    const now = Date.now();
    console.log("[Comments] handleSend called", {
      isSubmitLocked,
      isPending: createComment.isPending,
      timeSinceLastSubmit: now - lastSubmitTimeRef.current,
    });

    // CHECK 1: Local submit lock (prevents rapid taps)
    if (isSubmitLocked) {
      console.log("[Comments] BLOCKED: Submit locked");
      return;
    }

    // CHECK 2: Mutation already in flight
    if (createComment.isPending) {
      console.log("[Comments] BLOCKED: Mutation pending");
      return;
    }

    // CHECK 3: Cooldown period (prevents double-tap even if lock was released)
    if (now - lastSubmitTimeRef.current < submitCooldownMs) {
      console.log("[Comments] BLOCKED: Cooldown period");
      return;
    }

    if (!comment.trim()) {
      showToast("warning", "Empty", "Please enter a comment");
      return;
    }
    if (!postId) {
      showToast("error", "Error", "No post ID found");
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

    // LOCK IMMEDIATELY before any async work
    setIsSubmitLocked(true);
    lastSubmitTimeRef.current = now;

    // Generate unique mutation ID for server-side idempotency
    const clientMutationId = generateMutationId();
    console.log(
      "[Comments] Submitting with clientMutationId:",
      clientMutationId,
    );

    const commentText = comment.trim();
    const parentId = replyingTo || undefined;

    // Clear input IMMEDIATELY to prevent re-submission of same text
    const originalComment = comment;
    const originalReplyingTo = replyingTo;
    setComment("");
    setReplyingTo(null);

    createComment.mutate(
      {
        post: postId,
        text: commentText,
        parent: parentId,
        authorUsername: user.username,
        authorId: user.id,
        clientMutationId, // For server-side idempotency
      },
      {
        onSuccess: () => {
          Keyboard.dismiss();
          showToast("success", "Posted!", "Your comment was added");
          // Unlock after success
          setIsSubmitLocked(false);
        },
        onError: (error: any) => {
          console.error("[Comments] Error:", error);
          // Restore input on error so user can retry
          setComment(originalComment);
          setReplyingTo(originalReplyingTo);
          const errorMessage =
            error?.message ||
            error?.error?.message ||
            error?.error ||
            "Failed to create comment";
          showToast("error", "Failed", errorMessage);
          // Unlock after error
          setIsSubmitLocked(false);
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
    isSubmitLocked,
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

  // Extract unique commenters for @mention autocomplete (instant local results)
  const commenters = useMemo(() => {
    const seen = new Set<string>();
    const result: { username: string; avatar?: string }[] = [];
    const addUser = (u: string, a?: string) => {
      if (u && !seen.has(u) && u !== user?.username) {
        seen.add(u);
        result.push({ username: u, avatar: a });
      }
    };
    for (const c of comments) {
      addUser(c.username, c.avatar);
      if (c.replies) {
        for (const r of c.replies) addUser(r.username, r.avatar);
      }
    }
    return result;
  }, [comments, user?.username]);

  // Detect @mention query from cursor position
  const mentionQuery = useMemo(() => {
    const before = comment.slice(0, cursorPos);
    const match = before.match(/@(\w*)$/);
    return match ? match[1] : null;
  }, [comment, cursorPos]);

  // API-backed user search for @mentions (searches all users, not just commenters)
  const { data: apiMentionResults = [] } = useQuery({
    queryKey: ["users", "mention-search", mentionQuery],
    queryFn: async () => {
      if (!mentionQuery || mentionQuery.length < 1) return [];
      const result = await usersApi.searchUsers(mentionQuery.toLowerCase(), 8);
      return (result.docs || []).map((u: any) => ({
        username: u.username,
        avatar: u.avatar,
      }));
    },
    enabled: !!mentionQuery && mentionQuery.length >= 1,
    staleTime: 10_000,
  });

  // Merge local commenters + API results, deduplicated
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    // No query yet (just typed @) — show local commenters
    if (!mentionQuery) return commenters.slice(0, 5);
    // Merge: local matches first, then API results
    const seen = new Set<string>();
    const merged: { username: string; avatar?: string }[] = [];
    const localMatches = commenters.filter((c) =>
      c.username.toLowerCase().includes(mentionQuery.toLowerCase()),
    );
    for (const u of localMatches) {
      if (!seen.has(u.username)) {
        seen.add(u.username);
        merged.push(u);
      }
    }
    for (const u of apiMentionResults) {
      if (!seen.has(u.username) && u.username !== user?.username) {
        seen.add(u.username);
        merged.push(u);
      }
    }
    return merged.slice(0, 8);
  }, [mentionQuery, commenters, apiMentionResults, user?.username]);

  const handleInsertMention = useCallback(
    (username: string) => {
      const before = comment.slice(0, cursorPos);
      const after = comment.slice(cursorPos);
      const atIdx = before.lastIndexOf("@");
      const newBefore = before.slice(0, atIdx);
      const newText = `${newBefore}@${username} ${after}`;
      const newCursor = newBefore.length + username.length + 2;
      setComment(newText);
      setCursorPos(newCursor);
      inputRef.current?.focus();
    },
    [comment, cursorPos, setComment],
  );

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
      <SheetHeader title="Comments" onClose={() => router.back()} />
      <BottomSheetScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
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
                  postId={postId || ""}
                  comment={commentData}
                  isHighlighted={isHighlightedComment}
                  onReply={handleReply}
                  onViewAllReplies={handleViewReplies}
                  onProfilePress={handleProfilePress}
                  maxVisibleReplies={isHighlightedComment ? 100 : 2}
                  showAllReplies={isHighlightedComment}
                />
              );
            })
        )}
      </BottomSheetScrollView>

      {/* Input at bottom - outside scroll view */}
      <View style={{ backgroundColor: "#000" }}>
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
                hitSlop={12}
              >
                <X size={16} color="#666" />
              </Pressable>
            </View>
          )}
          {/* @mention autocomplete dropdown */}
          {mentionSuggestions.length > 0 && (
            <View
              style={{
                backgroundColor: "#1a1a1a",
                borderRadius: 12,
                marginBottom: 8,
                maxHeight: 180,
                overflow: "hidden",
              }}
            >
              <Text
                style={{
                  color: "#666",
                  fontSize: 11,
                  paddingHorizontal: 12,
                  paddingTop: 8,
                  paddingBottom: 4,
                }}
              >
                Mention a user
              </Text>
              {mentionSuggestions.map((u) => (
                <Pressable
                  key={u.username}
                  onPress={() => handleInsertMention(u.username)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Image
                    source={{
                      uri:
                        u.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=1a1a1a&color=fff`,
                    }}
                    style={{ width: 28, height: 28, borderRadius: 6 }}
                  />
                  <Text
                    style={{ color: "#fff", fontSize: 14, fontWeight: "500" }}
                  >
                    {u.username}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <BottomSheetTextInput
              ref={inputRef}
              value={comment}
              onChangeText={setComment}
              onSelectionChange={(e) =>
                setCursorPos(e.nativeEvent.selection.end)
              }
              placeholder="Add a comment... (@ to mention)"
              placeholderTextColor="#666"
              multiline
              returnKeyType="send"
              onSubmitEditing={
                isSubmitLocked || createComment.isPending
                  ? undefined
                  : handleSend
              }
              blurOnSubmit={false}
              enablesReturnKeyAutomatically={true}
              editable={!isSubmitLocked && !createComment.isPending}
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
              disabled={
                !comment.trim() ||
                createComment.isPending ||
                !user ||
                isSubmitLocked
              }
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
              {createComment.isPending || isSubmitLocked ? (
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
      </View>
    </View>
  );
}
