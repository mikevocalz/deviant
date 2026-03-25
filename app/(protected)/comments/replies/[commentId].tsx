import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import {
  KeyboardController,
  KeyboardProvider,
  KeyboardAvoidingView,
} from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ErrorBoundary } from "@/components/error-boundary";
import { SheetHeader } from "@/components/ui/sheet-header";
import { useSafeHeader } from "@/lib/hooks/use-safe-header";
import { Image } from "expo-image";
import { Send, X } from "lucide-react-native";
import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReplies, useCreateComment } from "@/lib/hooks/use-comments";
import { useCommentsStore } from "@/lib/stores/comments-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  ThreadedComment,
  type CommentData,
} from "@/components/comments/threaded-comment";
import { usersApi } from "@/lib/api/users";
import { useQuery } from "@tanstack/react-query";

function mapCommentTree(comment: any): CommentData {
  return {
    id: comment.id,
    username: comment.username,
    avatar: comment.avatar,
    text: comment.text,
    timeAgo: comment.timeAgo,
    likes: comment.likes,
    hasLiked: comment.hasLiked,
    depth: comment.depth,
    parentId: comment.parentId,
    rootId: comment.rootId,
    replies: Array.isArray(comment.replies)
      ? comment.replies
          .filter(
            (reply: any) => reply && reply.id && reply.username && reply.text,
          )
          .map(mapCommentTree)
      : [],
  };
}

function collectCommenters(
  comments: any[],
  currentUsername?: string,
  acc: { username: string; avatar?: string }[] = [],
  seen = new Set<string>(),
) {
  for (const comment of comments) {
    if (
      comment?.username &&
      !seen.has(comment.username) &&
      comment.username !== currentUsername
    ) {
      seen.add(comment.username);
      acc.push({ username: comment.username, avatar: comment.avatar });
    }
    if (Array.isArray(comment?.replies)) {
      collectCommenters(comment.replies, currentUsername, acc, seen);
    }
  }
  return acc;
}

function RepliesScreenContent() {
  const { commentId, postId } = useLocalSearchParams<{
    commentId: string;
    postId?: string;
  }>();
  const router = useRouter();
  const {
    newComment: reply,
    replyingTo,
    setNewComment: setReply,
    setReplyingTo,
  } = useCommentsStore();
  const user = useAuthStore((state) => state.user);
  const showToast = useUIStore((state) => state.showToast);
  const insets = useSafeAreaInsets();

  // @mention autocomplete state
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<TextInput>(null);

  // Fetch replies from API - pass both commentId and postId
  const { data: replies = [], isLoading } = useReplies(
    commentId || "",
    postId || "",
  );
  const createCommentMutation = useCreateComment();

  const handleSend = async () => {
    if (!reply.trim() || !commentId) return;

    if (!postId) {
      showToast("error", "Error", "Cannot determine post ID for reply");
      return;
    }

    if (!user?.username) {
      showToast("error", "Error", "You must be logged in to reply");
      return;
    }

    try {
      await createCommentMutation.mutateAsync({
        post: postId,
        text: reply.trim(),
        parent: replyingTo || commentId,
        authorUsername: user.username,
        authorId: user.id,
      });
      setReply("");
      setReplyingTo(null);
      KeyboardController.dismiss();
    } catch (error: any) {
      showToast("error", "Error", error?.message || "Failed to post reply");
    }
  };

  const commenters = useMemo(() => {
    return collectCommenters(replies, user?.username);
  }, [replies, user?.username]);

  const mentionQuery = useMemo(() => {
    const before = reply.slice(0, cursorPos);
    const match = before.match(/@(\w*)$/);
    return match ? match[1] : null;
  }, [reply, cursorPos]);

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
    if (!mentionQuery) return commenters.slice(0, 5);
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
      const before = reply.slice(0, cursorPos);
      const after = reply.slice(cursorPos);
      const atIdx = before.lastIndexOf("@");
      const newBefore = before.slice(0, atIdx);
      const newText = `${newBefore}@${username} ${after}`;
      setReply(newText);
      setCursorPos(newBefore.length + username.length + 2);
      inputRef.current?.focus();
    },
    [reply, cursorPos, setReply],
  );

  const handleReply = useCallback(
    (username: string, commentIdParam: string) => {
      if (!username || !commentIdParam) return;
      setReplyingTo(commentIdParam);
      setReply(`@${username} `);
      inputRef.current?.focus();
    },
    [setReplyingTo, setReply],
  );

  const handleProfilePress = useCallback(
    (username: string, avatar?: string) => {
      if (!username) return;
      router.push({
        pathname: `/(protected)/profile/${username}`,
        params: avatar ? { avatar } : {},
      } as any);
    },
    [router],
  );

  useEffect(() => {
    return () => {
      setReplyingTo(null);
    };
  }, [setReplyingTo]);

  // FIX: Use safe header update to prevent loops
  useSafeHeader({
    header: () => <SheetHeader title="Replies" onClose={() => router.back()} />,
  });

  return (
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1, backgroundColor: "#000" }}
      >
        {/* Replies List */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          nestedScrollEnabled
        >
          {isLoading ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Text style={{ color: "#999" }}>Loading replies...</Text>
            </View>
          ) : !replies || replies.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Text style={{ color: "#999" }}>No replies yet</Text>
            </View>
          ) : (
            replies
              .filter((item) => item && item.id && item.username && item.text)
              .map((item) => (
                <ThreadedComment
                  key={item.id}
                  postId={postId || ""}
                  comment={mapCommentTree(item)}
                  onReply={handleReply}
                  onProfilePress={handleProfilePress}
                  maxVisibleReplies={100}
                  showAllReplies
                />
              ))
          )}
        </ScrollView>

        {/* Input */}
        <View>
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: "#333",
              paddingHorizontal: 16,
              paddingVertical: 12,
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
                  Replying in thread
                </Text>
                <Pressable
                  onPress={() => {
                    setReplyingTo(null);
                    setReply("");
                    KeyboardController.dismiss();
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
                        uri: u.avatar || "",
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

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <TextInput
                ref={inputRef}
                value={reply}
                onChangeText={setReply}
                onSelectionChange={(e) =>
                  setCursorPos(e.nativeEvent.selection.end)
                }
                placeholder="Add a reply... (@ to mention)"
                placeholderTextColor="#999"
                multiline
                returnKeyType="send"
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
                enablesReturnKeyAutomatically={true}
                style={{
                  flex: 1,
                  minHeight: 40,
                  maxHeight: 100,
                  backgroundColor: "#1f1f1f",
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  color: "#fff",
                }}
              />
              <Pressable
                onPress={handleSend}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "#6366f1",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Send size={20} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </KeyboardProvider>
  );
}

// Wrap with ErrorBoundary for crash protection
export default function RepliesScreen() {
  const router = useRouter();

  return (
    <ErrorBoundary screenName="Replies" onGoBack={() => router.back()}>
      <RepliesScreenContent />
    </ErrorBoundary>
  );
}
