import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from "react-native";
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { X, Send } from "lucide-react-native";
import { useRouter } from "expo-router";
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
import { SHEET_SNAPS_TALL } from "@/lib/constants/sheets";
import { GlassSheetBackground } from "@/components/sheets/glass-sheet-background";

function generateMutationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface CommentsSheetProps {
  visible: boolean;
  onClose: () => void;
  postId: string | null;
}

export function CommentsSheet({
  visible,
  onClose,
  postId,
}: CommentsSheetProps) {
  const { colors } = useColorScheme();
  const router = useRouter();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => [...SHEET_SNAPS_TALL], []);
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const {
    newComment: comment,
    replyingTo,
    setNewComment: setComment,
    setReplyingTo,
  } = useCommentsStore();

  const [isSubmitLocked, setIsSubmitLocked] = useState(false);
  const lastSubmitTimeRef = useRef<number>(0);
  const submitCooldownMs = 2000;
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<any>(null);

  const { data: comments = [], isLoading } = useComments(postId || "", 50);
  const createComment = useCreateComment();

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.snapToIndex(0);
    } else {
      bottomSheetRef.current?.close();
      setComment("");
      setReplyingTo(null);
    }
  }, [visible, setComment, setReplyingTo]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) onClose();
    },
    [onClose],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  const handleSend = useCallback(() => {
    const now = Date.now();
    if (isSubmitLocked) return;
    if (createComment.isPending) return;
    if (now - lastSubmitTimeRef.current < submitCooldownMs) return;
    if (!comment.trim()) {
      showToast("warning", "Empty", "Please enter a comment");
      return;
    }
    if (!postId) return;
    if (!user || !user.username) {
      showToast("error", "Error", "You must be logged in to comment");
      return;
    }

    setIsSubmitLocked(true);
    lastSubmitTimeRef.current = now;
    const clientMutationId = generateMutationId();
    const commentText = comment.trim();
    const parentId = replyingTo || undefined;
    const originalComment = comment;
    const originalReplyingTo = replyingTo;
    setComment("");
    setReplyingTo(null);
    Keyboard.dismiss();

    createComment.mutate(
      {
        post: postId,
        text: commentText,
        parent: parentId,
        authorUsername: user.username,
        authorId: user.id,
        clientMutationId,
      },
      {
        onSuccess: () => {
          Keyboard.dismiss();
          showToast("success", "Posted!", "Your comment was added");
          setIsSubmitLocked(false);
        },
        onError: (error: any) => {
          console.error("[Comments] Error:", error);
          setComment(originalComment);
          setReplyingTo(originalReplyingTo);
          const errorMessage =
            error?.message ||
            error?.error?.message ||
            error?.error ||
            "Failed to create comment";
          showToast("error", "Failed", errorMessage);
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
      () => setReplyingTo(null),
    );
    return () => keyboardDidHideListener.remove();
  }, [setReplyingTo]);

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

  const mentionQuery = useMemo(() => {
    const before = comment.slice(0, cursorPos);
    const match = before.match(/@(\w*)$/);
    return match ? match[1] : null;
  }, [comment, cursorPos]);

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

  const handleProfilePress = useCallback(
    (username: string, avatar?: string) => {
      if (!username) return;
      onClose();
      router.push({
        pathname: `/(protected)/profile/${username}`,
        params: avatar ? { avatar } : {},
      } as any);
    },
    [router, onClose],
  );

  if (!visible || !postId) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableOverDrag={false}
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundComponent={GlassSheetBackground}
      handleIndicatorStyle={{
        backgroundColor: colors.mutedForeground,
        width: 40,
      }}
      style={styles.sheetContainer}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Comments
        </Text>
        <Pressable
          onPress={() => bottomSheetRef.current?.close()}
          hitSlop={12}
          style={styles.closeButton}
        >
          <X size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Comments list */}
      <BottomSheetScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {isLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 12,
                marginTop: 8,
              }}
            >
              Loading comments...
            </Text>
          </View>
        ) : comments.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ color: colors.mutedForeground }}>
              No comments yet
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 12,
                marginTop: 8,
              }}
            >
              Be the first to comment!
            </Text>
          </View>
        ) : (
          comments
            .filter((item) => item && item.id && item.username && item.text)
            .map((item) => {
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
                  postId={postId}
                  comment={commentData}
                  isHighlighted={false}
                  onReply={handleReply}
                  onProfilePress={handleProfilePress}
                  maxVisibleReplies={2}
                  showAllReplies={false}
                />
              );
            })
        )}
      </BottomSheetScrollView>

      {/* Input */}
      <View style={{ backgroundColor: colors.card }}>
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingHorizontal: 16,
            paddingVertical: 12,
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: colors.card,
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
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
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
                <X size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )}

          {mentionSuggestions.length > 0 && (
            <View
              style={{
                backgroundColor: colors.muted,
                borderRadius: 12,
                marginBottom: 8,
                maxHeight: 180,
                overflow: "hidden",
              }}
            >
              <Text
                style={{
                  color: colors.mutedForeground,
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
                    source={{ uri: u.avatar || "" }}
                    style={{ width: 28, height: 28, borderRadius: 6 }}
                  />
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 14,
                      fontWeight: "500",
                    }}
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
              placeholderTextColor={colors.mutedForeground}
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
                backgroundColor: colors.muted,
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 10,
                color: colors.foreground,
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
                    ? colors.primary
                    : colors.muted,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {createComment.isPending || isSubmitLocked ? (
                <ActivityIndicator
                  size="small"
                  color={colors.mutedForeground}
                />
              ) : (
                <Send
                  size={20}
                  color={
                    comment.trim() && user ? "#fff" : colors.mutedForeground
                  }
                />
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    zIndex: 9999,
    elevation: 9999,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
});
