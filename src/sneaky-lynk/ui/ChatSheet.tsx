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
import { View, Text, Pressable, Platform, ActivityIndicator } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { LegendList } from "@/components/list";
import { PasteInput } from "@/components/ui/paste-input";
import { Avatar } from "@/components/ui/avatar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, { BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { Send, X, Reply, MessageCircleMore } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import type { SneakyUser } from "../types";
import type {
  RoomComment,
  Mention,
  RoomCommentAuthor,
} from "../api/comments";
import {
  fetchRoomComments,
  postRoomComment,
  subscribeToRoomComments,
  buildCommentThreads,
} from "../api/comments";

// Reaction emoji set (same as DM chat)
const REACTION_EMOJIS = ["😂", "😢", "😊", "😈", "🥵", "💝"];
const SHEET_BG = "#141416";
const PANEL_BG = "#1D1D21";
const BUBBLE_BG = "#232327";
const BUBBLE_OWN_BG = "rgba(52,162,223,0.14)";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_PRIMARY = "#F9FAFB";
const TEXT_SECONDARY = "#9CA3AF";
const TEXT_TERTIARY = "#6B7280";
const ACCENT = "#34A2DF";
const SEND_BG = "#FC253A";

interface CommentReaction {
  emoji: string;
  userId: string;
  username: string;
}

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

function getCommentAuthorLabel(comment: RoomComment | null): string {
  if (!comment) return "guest";
  return comment.author?.username || comment.author?.displayName || "guest";
}

// ── @Mention typeahead ───────────────────────────────────────────────

const MentionSuggestion = memo(function MentionSuggestion({
  user,
  onSelect,
}: {
  user: SneakyUser;
  onSelect: (user: SneakyUser) => void;
}) {
  const handleSelect = useCallback(() => onSelect(user), [onSelect, user]);

  return (
    <Pressable
      onPress={handleSelect}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 10,
      }}
    >
      <Avatar
        uri={user.avatar}
        username={user.username}
        size={32}
        variant="roundedSquare"
      />
      <Text style={{ color: TEXT_PRIMARY, fontSize: 14, fontWeight: "600" }}>
        @{user.username}
      </Text>
      <Text
        style={{ color: TEXT_SECONDARY, fontSize: 12, flex: 1 }}
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
        marginHorizontal: 16,
        marginBottom: 10,
        backgroundColor: PANEL_BG,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: BORDER,
        borderTopWidth: 1,
        borderTopColor: BORDER,
        maxHeight: 200,
        overflow: "hidden",
      }}
    >
      <Text
        style={{
          color: TEXT_TERTIARY,
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.3,
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: 4,
          textTransform: "uppercase",
        }}
      >
        Mention someone
      </Text>
      <LegendList
        data={filtered}
        keyExtractor={(item: SneakyUser) => item.id}
        renderItem={({ item }: { item: SneakyUser }) => (
          <MentionSuggestion user={item} onSelect={onSelect} />
        )}
        estimatedItemSize={44}
        recycleItems
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
  onReact,
  reactions,
  currentUserId,
  isReply = false,
}: {
  comment: RoomComment;
  isOwnComment: boolean;
  onReply: (comment: RoomComment) => void;
  onReact: (commentId: number, emoji: string) => void;
  reactions: CommentReaction[];
  currentUserId: string;
  isReply?: boolean;
}) {
  const opacity = comment.isOptimistic ? 0.6 : 1;
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const lastTapRef = useRef<number>(0);
  const authorName =
    comment.author?.username || comment.author?.displayName || "Guest";
  const avatarName = comment.author?.username || authorName;

  // Group reactions by emoji
  const groupedReactions = useMemo(() => {
    return reactions.reduce(
      (acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [reactions]);

  const hasReactions = reactions.length > 0;

  const handlePress = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap — heart react
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onReact(comment.id, "❤️");
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [comment.id, onReact]);

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowReactionPicker((v) => !v);
  }, []);

  return (
    <View
      style={{
        marginBottom: hasReactions ? 6 : isReply ? 10 : 14,
        marginLeft: isReply ? 22 : 0,
        paddingLeft: isReply ? 14 : 0,
        borderLeftWidth: isReply ? 1 : 0,
        borderLeftColor: isReply ? BORDER : "transparent",
      }}
    >
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={400}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
            opacity,
          }}
        >
          <Avatar
            uri={comment.author?.avatar}
            username={avatarName}
            size={isReply ? 24 : 32}
            variant="roundedSquare"
          />
          <View style={{ flex: 1 }}>
            <View
              style={{
                backgroundColor: isOwnComment ? BUBBLE_OWN_BG : BUBBLE_BG,
                borderRadius: isReply ? 18 : 20,
                borderWidth: 1,
                borderColor: isOwnComment ? "rgba(52,162,223,0.28)" : BORDER,
                paddingHorizontal: 14,
                paddingVertical: 11,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{
                    color: isOwnComment ? ACCENT : TEXT_PRIMARY,
                    fontSize: 13,
                    fontWeight: "700",
                    flexShrink: 1,
                  }}
                  numberOfLines={1}
                >
                  {authorName}
                </Text>
                <Text style={{ color: TEXT_TERTIARY, fontSize: 11 }}>
                  {timeAgo(comment.createdAt)}
                </Text>
              </View>
              <Text
                style={{
                  color: TEXT_PRIMARY,
                  fontSize: 14,
                  lineHeight: 20,
                }}
              >
                {renderCommentBody(comment.body, comment.mentions)}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginTop: 6,
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ color: TEXT_TERTIARY, fontSize: 11 }}>
                {formatTime(comment.createdAt)}
              </Text>
              {!isReply && (
                <Pressable
                  onPress={() => onReply(comment)}
                  hitSlop={8}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Reply size={12} color={TEXT_SECONDARY} />
                  <Text
                    style={{
                      color: TEXT_SECONDARY,
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                  >
                    Reply
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Pressable>

      {/* Reaction picker (shown on long-press) */}
      {showReactionPicker && (
        <View
          style={{
            flexDirection: "row",
            gap: 6,
            marginLeft: isReply ? 48 : 42,
            marginBottom: 8,
            backgroundColor: PANEL_BG,
            borderWidth: 1,
            borderColor: BORDER,
            borderRadius: 20,
            paddingHorizontal: 8,
            paddingVertical: 4,
            alignSelf: "flex-start",
          }}
        >
          {REACTION_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => {
                onReact(comment.id, emoji);
                setShowReactionPicker(false);
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 18 }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Reaction pills */}
      {hasReactions && (
        <View
          style={{
            flexDirection: "row",
            gap: 4,
            marginLeft: isReply ? 48 : 42,
            marginBottom: isReply ? 4 : 2,
            flexWrap: "wrap",
          }}
        >
          {Object.entries(groupedReactions).map(([emoji, count]) => (
            <Pressable
              key={emoji}
              onPress={() => onReact(comment.id, emoji)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: PANEL_BG,
                borderRadius: 12,
                paddingHorizontal: 6,
                paddingVertical: 3,
                borderWidth: 1,
                borderColor: reactions.some(
                  (r) => r.emoji === emoji && r.userId === currentUserId,
                )
                  ? ACCENT
                  : BORDER,
              }}
            >
              <Text style={{ fontSize: 13 }}>{emoji}</Text>
              {(count as number) > 1 && (
                <Text
                  style={{ fontSize: 10, color: TEXT_SECONDARY, marginLeft: 2 }}
                >
                  {count}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
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
        style={{ color: ACCENT, fontWeight: "600" }}
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
  onReact,
  commentReactions,
}: {
  thread: RoomComment;
  currentUserId: string;
  onReply: (comment: RoomComment) => void;
  onReact: (commentId: number, emoji: string) => void;
  commentReactions: Record<number, CommentReaction[]>;
}) {
  const [showReplies, setShowReplies] = useState(true);
  const replyCount = thread.replies?.length || 0;

  return (
    <View style={{ marginBottom: 4 }}>
      <CommentBubble
        comment={thread}
        isOwnComment={thread.authorId === currentUserId}
        onReply={onReply}
        onReact={onReact}
        reactions={commentReactions[thread.id] || []}
        currentUserId={currentUserId}
      />
      {replyCount > 0 && (
        <>
          {replyCount > 2 && !showReplies && (
            <Pressable
              onPress={() => setShowReplies(true)}
              style={{ marginLeft: 42, marginBottom: 10 }}
            >
              <Text
                style={{ color: ACCENT, fontSize: 12, fontWeight: "600" }}
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
                onReact={onReact}
                reactions={commentReactions[reply.id] || []}
                currentUserId={currentUserId}
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
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState<RoomComment | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [commentReactions, setCommentReactions] = useState<
    Record<number, CommentReaction[]>
  >({});
  const inputRef = useRef<any>(null);
  const authorDirectoryRef = useRef<Record<string, RoomCommentAuthor>>({});

  const authorDirectory = useMemo(() => {
    const entries: Array<[string, RoomCommentAuthor]> = [];

    if (currentUser.id) {
      entries.push([
        currentUser.id,
        {
          username: currentUser.username,
          displayName: currentUser.displayName,
          avatar: currentUser.avatar,
          isVerified: currentUser.isVerified,
        },
      ]);
    }

    for (const participant of participants) {
      if (!participant.id) continue;
      entries.push([
        participant.id,
        {
          username: participant.username,
          displayName: participant.displayName,
          avatar: participant.avatar,
          isVerified: participant.isVerified,
        },
      ]);
    }

    return Object.fromEntries(entries);
  }, [currentUser, participants]);

  useEffect(() => {
    authorDirectoryRef.current = authorDirectory;
  }, [authorDirectory]);

  // Fetch comments on mount + subscribe to real-time updates
  useEffect(() => {
    if (!roomId) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      setIsLoadingComments(true);
      const fetched = await fetchRoomComments(roomId);
      if (cancelled) return;
      setComments(fetched);
      setIsLoadingComments(false);

      unsubscribe = subscribeToRoomComments(
        roomId,
        (newComment) => {
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
        },
        {
          resolveAuthor: (authorId) => authorDirectoryRef.current[authorId],
        },
      );
    })().catch(() => {
      if (cancelled) return;
      setIsLoadingComments(false);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [roomId]);

  // Build threaded view
  const threads = useMemo(() => buildCommentThreads(comments), [comments]);

  // 50% and 75% snap points for detachable behavior
  const snapPoints = useMemo(() => ["60%", "90%"], []);

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
        setReplyingTo(null);
      }
    },
    [onClose],
  );

  const handleRequestClose = useCallback(() => {
    setReplyingTo(null);
    bottomSheetRef.current?.close();
  }, []);

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
      author: optimisticComment.author,
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

  const handleReact = useCallback(
    (commentId: number, emoji: string) => {
      const reaction: CommentReaction = {
        emoji,
        userId: currentUser.id,
        username: currentUser.username,
      };

      setCommentReactions((prev) => {
        const existing = prev[commentId] || [];
        const alreadyReacted = existing.find(
          (r) => r.emoji === emoji && r.userId === currentUser.id,
        );
        const updated = alreadyReacted
          ? existing.filter(
              (r) => !(r.emoji === emoji && r.userId === currentUser.id),
            )
          : [...existing, reaction];
        return { ...prev, [commentId]: updated };
      });
    },
    [currentUser],
  );

  const handleReply = useCallback((comment: RoomComment) => {
    setReplyingTo(comment);
    setInputText(`@${getCommentAuthorLabel(comment)} `);
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
        opacity={0.65}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={isOpen ? 0 : -1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      animateOnMount
      enablePanDownToClose
      enableOverDrag={false}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{
        backgroundColor: SHEET_BG,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: BORDER,
      }}
      handleIndicatorStyle={{ backgroundColor: TEXT_SECONDARY, width: 44 }}
      bottomInset={0}
      detached={false}
      style={{ zIndex: 9999, elevation: 9999 }}
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
            paddingHorizontal: 18,
            paddingTop: 4,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: BORDER,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text
              style={{ fontSize: 24, fontWeight: "800", color: TEXT_PRIMARY }}
            >
              Comments
            </Text>
            <View
              style={{
                minWidth: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: "rgba(52,162,223,0.14)",
                borderWidth: 1,
                borderColor: "rgba(52,162,223,0.24)",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 10,
              }}
            >
              <Text
                style={{ fontSize: 13, fontWeight: "700", color: ACCENT }}
              >
                {comments.length}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleRequestClose}
            hitSlop={12}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: PANEL_BG,
              borderWidth: 1,
              borderColor: BORDER,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={22} color={TEXT_PRIMARY} />
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
              onReact={handleReact}
              commentReactions={commentReactions}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, flexGrow: 1 }}
          maintainScrollAtEnd
          showsVerticalScrollIndicator={false}
          estimatedItemSize={80}
          recycleItems
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            isLoadingComments ? (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 240,
                  paddingVertical: 48,
                }}
              >
                <ActivityIndicator size="small" color={ACCENT} />
                <Text
                  style={{
                    color: TEXT_SECONDARY,
                    fontSize: 13,
                    marginTop: 12,
                  }}
                >
                  Loading comments...
                </Text>
              </View>
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 300,
                  paddingHorizontal: 40,
                  paddingVertical: 48,
                }}
              >
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: "rgba(52,162,223,0.14)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <MessageCircleMore size={30} color={ACCENT} />
                </View>
                <Text
                  style={{
                    color: TEXT_PRIMARY,
                    fontSize: 20,
                    fontWeight: "700",
                    textAlign: "center",
                    marginBottom: 8,
                  }}
                >
                  No comments yet
                </Text>
                <Text
                  style={{
                    color: TEXT_SECONDARY,
                    fontSize: 14,
                    lineHeight: 20,
                    textAlign: "center",
                  }}
                >
                  Start the conversation while this Lynk is live.
                </Text>
              </View>
            )
          }
        />

        {/* Reply indicator */}
        {replyingTo && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginHorizontal: 16,
              marginBottom: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: PANEL_BG,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: BORDER,
              gap: 8,
            }}
          >
            <Reply size={14} color={ACCENT} />
            <Text
              style={{ color: TEXT_SECONDARY, fontSize: 12, flex: 1 }}
              numberOfLines={1}
            >
              Replying to{" "}
              <Text style={{ color: ACCENT, fontWeight: "700" }}>
                @{getCommentAuthorLabel(replyingTo)}
              </Text>
            </Text>
            <Pressable onPress={cancelReply} hitSlop={8}>
              <X size={16} color={TEXT_TERTIARY} />
            </Pressable>
          </View>
        )}

        {/* @Mention typeahead */}
        <MentionTypeahead
          query={mentionQuery}
          participants={participants}
          onSelect={handleMentionSelect}
        />

        {/* Input */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 2,
            paddingBottom: Math.max(insets.bottom, 12) + 10,
            borderTopWidth: 1,
            borderTopColor: BORDER,
            backgroundColor: SHEET_BG,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 10,
            }}
          >
            <View
              style={{
                flex: 1,
                minHeight: 52,
                maxHeight: 120,
                backgroundColor: PANEL_BG,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: BORDER,
                paddingHorizontal: 2,
                paddingVertical: 2,
              }}
            >
              <PasteInput
                ref={inputRef}
                value={inputText}
                onChangeText={handleTextChange}
                onFocus={() => bottomSheetRef.current?.snapToIndex(1)}
                placeholder={
                  replyingTo ? "Write a reply..." : "Add a comment..."
                }
                placeholderTextColor={TEXT_TERTIARY}
                style={{
                  width: "100%",
                  minHeight: 48,
                  maxHeight: 112,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  color: TEXT_PRIMARY,
                  fontSize: 15,
                  lineHeight: 20,
                  textAlignVertical: "top",
                }}
                multiline
                blurOnSubmit={false}
                maxLength={2000}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
            </View>
            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim()}
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: inputText.trim() ? SEND_BG : PANEL_BG,
                borderWidth: 1,
                borderColor: inputText.trim()
                  ? "rgba(252,37,58,0.4)"
                  : BORDER,
                flexShrink: 0,
              }}
            >
              <Send
                size={20}
                color={inputText.trim() ? "#fff" : TEXT_TERTIARY}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}
