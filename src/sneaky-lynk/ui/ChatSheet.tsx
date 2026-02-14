/**
 * Chat Sheet Component
 * Detachable Gorhom Bottom Sheet for threaded room comments.
 * Features:
 * - 2-level threaded comments (root → replies)
 * - @mention typeahead with participant list
 * - Optimistic UI for instant comment appearance
 * - Real-time subscription via Supabase
 * - Shared Avatar component
 */

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { View, Text, Pressable, Platform, FlatList } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { LegendList } from "@/components/list";
import { PasteInput } from "@/components/ui/paste-input";
import { Avatar } from "@/components/ui/avatar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, { BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { Send, X, Reply } from "lucide-react-native";
import type { SneakyUser } from "../types";
import type { RoomComment, Mention } from "../api/comments";
import {
  fetchRoomComments,
  postRoomComment,
  subscribeToRoomComments,
  buildCommentThreads,
} from "../api/comments";

// ── Types ────────────────────────────────────────────────────────────

interface ChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentUser: SneakyUser;
  /** Current participants for @mention typeahead */
  participants?: SneakyUser[];
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ── @Mention typeahead ───────────────────────────────────────────────

const MentionSuggestion = memo(function MentionSuggestion({
  user,
  onSelect,
}: {
  user: SneakyUser;
  onSelect: (user: SneakyUser) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(user)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
      }}
    >
      <Avatar
        uri={user.avatar}
        username={user.username}
        size={28}
        variant="roundedSquare"
      />
      <Text style={{ color: "#fff", fontSize: 14, fontWeight: "500" }}>
        @{user.username}
      </Text>
      <Text
        style={{ color: "#6B7280", fontSize: 12, flex: 1 }}
        numberOfLines={1}
      >
        {user.displayName}
      </Text>
    </Pressable>
  );
});

function MentionTypeahead({
  query,
  participants,
  onSelect,
}: {
  query: string;
  participants: SneakyUser[];
  onSelect: (user: SneakyUser) => void;
}) {
  const filtered = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return participants
      .filter(
        (p) =>
          p.username.toLowerCase().includes(q) ||
          p.displayName.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [query, participants]);

  if (filtered.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: "#2a2a2a",
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.06)",
        maxHeight: 200,
      }}
    >
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MentionSuggestion user={item} onSelect={onSelect} />
        )}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

// ── Comment bubble ───────────────────────────────────────────────────

const CommentBubble = memo(function CommentBubble({
  comment,
  isOwnComment,
  onReply,
  isReply = false,
}: {
  comment: RoomComment;
  isOwnComment: boolean;
  onReply: (comment: RoomComment) => void;
  isReply?: boolean;
}) {
  const opacity = comment.isOptimistic ? 0.6 : 1;

  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        marginBottom: isReply ? 8 : 12,
        marginLeft: isReply ? 40 : 0,
        opacity,
      }}
    >
      <Avatar
        uri={comment.author?.avatar}
        username={comment.author?.username || "User"}
        size={isReply ? 24 : 32}
        variant="roundedSquare"
      />
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginBottom: 2,
          }}
        >
          <Text
            style={{
              color: isOwnComment ? "#34A2DF" : "#fff",
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            {comment.author?.username || "User"}
          </Text>
          <Text style={{ color: "#6B7280", fontSize: 10 }}>
            {timeAgo(comment.createdAt)}
          </Text>
        </View>
        <Text style={{ color: "#E5E7EB", fontSize: 14, lineHeight: 20 }}>
          {renderCommentBody(comment.body, comment.mentions)}
        </Text>
        {/* Reply button — only on root comments (depth 0) */}
        {!isReply && (
          <Pressable
            onPress={() => onReply(comment)}
            hitSlop={8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 4,
            }}
          >
            <Reply size={12} color="#6B7280" />
            <Text style={{ color: "#6B7280", fontSize: 11, fontWeight: "500" }}>
              Reply
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

/** Render comment body with @mentions highlighted */
function renderCommentBody(body: string, mentions: Mention[]) {
  if (!mentions || mentions.length === 0) {
    return body;
  }

  // Sort mentions by start position (descending) to avoid offset issues
  const sorted = [...mentions].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  for (const mention of sorted) {
    if (mention.start > lastEnd) {
      parts.push(body.slice(lastEnd, mention.start));
    }
    parts.push(
      <Text
        key={`mention-${mention.start}`}
        style={{ color: "#34A2DF", fontWeight: "600" }}
      >
        @{mention.username}
      </Text>,
    );
    lastEnd = mention.end;
  }
  if (lastEnd < body.length) {
    parts.push(body.slice(lastEnd));
  }

  return <Text>{parts}</Text>;
}

// ── Thread item (root + replies) ─────────────────────────────────────

const ThreadItem = memo(function ThreadItem({
  thread,
  currentUserId,
  onReply,
}: {
  thread: RoomComment;
  currentUserId: string;
  onReply: (comment: RoomComment) => void;
}) {
  const [showReplies, setShowReplies] = useState(true);
  const replyCount = thread.replies?.length || 0;

  return (
    <View style={{ marginBottom: 4 }}>
      <CommentBubble
        comment={thread}
        isOwnComment={thread.authorId === currentUserId}
        onReply={onReply}
      />
      {replyCount > 0 && (
        <>
          {replyCount > 2 && !showReplies && (
            <Pressable
              onPress={() => setShowReplies(true)}
              style={{ marginLeft: 40, marginBottom: 8 }}
            >
              <Text
                style={{ color: "#34A2DF", fontSize: 12, fontWeight: "500" }}
              >
                View {replyCount} replies
              </Text>
            </Pressable>
          )}
          {showReplies &&
            thread.replies!.map((reply) => (
              <CommentBubble
                key={reply.id}
                comment={reply}
                isOwnComment={reply.authorId === currentUserId}
                onReply={onReply}
                isReply
              />
            ))}
        </>
      )}
    </View>
  );
});

// ── Main ChatSheet ───────────────────────────────────────────────────

export function ChatSheet({
  isOpen,
  onClose,
  roomId,
  currentUser,
  participants = [],
}: ChatSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState("");
  const [comments, setComments] = useState<RoomComment[]>([]);
  const [replyingTo, setReplyingTo] = useState<RoomComment | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const inputRef = useRef<any>(null);

  // Delayed unmount: keep sheet mounted briefly after close so animation plays
  const [shouldRender, setShouldRender] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Fetch comments on mount + subscribe to real-time updates
  useEffect(() => {
    if (!isOpen || !roomId) return;

    let unsubscribe: (() => void) | undefined;

    (async () => {
      const fetched = await fetchRoomComments(roomId);
      setComments(fetched);

      unsubscribe = subscribeToRoomComments(roomId, (newComment) => {
        setComments((prev) => {
          // Skip if we already have this comment (optimistic insert)
          if (prev.some((c) => c.id === newComment.id)) return prev;
          // Also replace any optimistic version
          const filtered = prev.filter(
            (c) =>
              !(
                c.isOptimistic &&
                c.body === newComment.body &&
                c.authorId === newComment.authorId
              ),
          );
          return [...filtered, newComment];
        });
      });
    })();

    return () => {
      unsubscribe?.();
    };
  }, [isOpen, roomId]);

  // Build threaded view
  const threads = useMemo(() => buildCommentThreads(comments), [comments]);

  // 50% and 75% snap points for detachable behavior
  const snapPoints = useMemo(() => ["50%", "75%"], []);

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
        setReplyingTo(null);
      }
    },
    [onClose],
  );

  // Detect @mention in input
  const handleTextChange = useCallback((text: string) => {
    setInputText(text);

    // Check for active @mention
    const cursorPos = text.length; // Simplified: assume cursor at end
    const lastAt = text.lastIndexOf("@");
    if (lastAt >= 0) {
      const afterAt = text.slice(lastAt + 1);
      // Only show typeahead if no space after @
      if (!afterAt.includes(" ") && afterAt.length > 0) {
        setMentionQuery(afterAt);
        return;
      }
    }
    setMentionQuery("");
  }, []);

  const handleMentionSelect = useCallback(
    (user: SneakyUser) => {
      const lastAt = inputText.lastIndexOf("@");
      if (lastAt >= 0) {
        const before = inputText.slice(0, lastAt);
        const newText = `${before}@${user.username} `;
        setInputText(newText);
      }
      setMentionQuery("");
    },
    [inputText],
  );

  // Extract mentions from text
  const extractMentions = useCallback(
    (text: string): Mention[] => {
      const mentions: Mention[] = [];
      const regex = /@(\w+)/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const username = match[1];
        const participant = participants.find(
          (p) => p.username.toLowerCase() === username.toLowerCase(),
        );
        if (participant) {
          mentions.push({
            userId: participant.id,
            username: participant.username,
            start: match.index,
            end: match.index + match[0].length,
          });
        }
      }
      return mentions;
    },
    [participants],
  );

  const handleSend = useCallback(async () => {
    const body = inputText.trim();
    if (!body) return;

    const mentions = extractMentions(body);
    const parentId = replyingTo?.id || null;
    const rootId = replyingTo ? (replyingTo.rootId ?? replyingTo.id) : null;
    const depth = replyingTo ? Math.min((replyingTo.depth || 0) + 1, 2) : 0;

    // Optimistic insert
    const optimisticComment: RoomComment = {
      id: -Date.now(), // Negative ID for optimistic
      roomId,
      authorId: currentUser.id,
      body,
      parentId,
      rootId,
      depth,
      mentions,
      createdAt: new Date().toISOString(),
      author: {
        username: currentUser.username,
        displayName: currentUser.displayName,
        avatar: currentUser.avatar,
        isVerified: currentUser.isVerified,
      },
      isOptimistic: true,
    };

    setComments((prev) => [...prev, optimisticComment]);
    setInputText("");
    setReplyingTo(null);
    setMentionQuery("");

    // Post to DB
    const result = await postRoomComment({
      roomId,
      authorId: currentUser.id,
      body,
      parentId,
      rootId,
      depth,
      mentions,
    });

    if (result) {
      // Replace optimistic with real comment
      setComments((prev) =>
        prev.map((c) =>
          c.id === optimisticComment.id
            ? { ...result, author: optimisticComment.author }
            : c,
        ),
      );
    } else {
      // Remove optimistic on failure
      setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
    }
  }, [inputText, replyingTo, roomId, currentUser, extractMentions]);

  const handleReply = useCallback((comment: RoomComment) => {
    setReplyingTo(comment);
    setInputText(`@${comment.author?.username || "user"} `);
    inputRef.current?.focus();
  }, []);

  const cancelReply = useCallback(() => {
    setReplyingTo(null);
    setInputText("");
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  if (!shouldRender) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: "#1a1a1a" }}
      handleIndicatorStyle={{ backgroundColor: "#6B7280" }}
      detached={false}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={100}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255,255,255,0.06)",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#34A2DF" }}>
            Comments
          </Text>
          <Text style={{ fontSize: 13, color: "#6B7280" }}>
            {comments.length}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Threaded Comments */}
        <LegendList
          data={threads}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ThreadItem
              thread={item}
              currentUserId={currentUser.id}
              onReply={handleReply}
            />
          )}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          maintainScrollAtEnd
          showsVerticalScrollIndicator={false}
          estimatedItemSize={80}
          recycleItems
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 40,
              }}
            >
              <Text style={{ color: "#6B7280", textAlign: "center" }}>
                No comments yet.{"\n"}Start the conversation!
              </Text>
            </View>
          }
        />

        {/* @Mention typeahead */}
        <MentionTypeahead
          query={mentionQuery}
          participants={participants}
          onSelect={handleMentionSelect}
        />

        {/* Reply indicator */}
        {replyingTo && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 8,
              backgroundColor: "#2a2a2a",
              gap: 8,
            }}
          >
            <Reply size={14} color="#34A2DF" />
            <Text
              style={{ color: "#9CA3AF", fontSize: 12, flex: 1 }}
              numberOfLines={1}
            >
              Replying to{" "}
              <Text style={{ color: "#34A2DF", fontWeight: "600" }}>
                @{replyingTo.author?.username || "user"}
              </Text>
            </Text>
            <Pressable onPress={cancelReply} hitSlop={8}>
              <X size={16} color="#6B7280" />
            </Pressable>
          </View>
        )}

        {/* Input */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.06)",
            paddingBottom: insets.bottom + 12,
          }}
        >
          <PasteInput
            ref={inputRef}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
            placeholderTextColor="#6B7280"
            style={{
              width: "80%",
              backgroundColor: "#2a2a2a",
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 12,
              color: "#fff",
              fontSize: 14,
              maxHeight: 100,
            }}
            multiline
            maxLength={2000}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: inputText.trim() ? "#FC253A" : "#2a2a2a",
              flexShrink: 0,
            }}
          >
            <Send size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}
