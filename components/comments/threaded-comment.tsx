/**
 * ThreadedComment Component
 *
 * Instagram-style threaded comment with:
 * - Parent comment at top
 * - Replies nested below with vertical connector line
 * - Horizontal branch connectors to each reply
 * - Proper indentation and avatar sizing
 *
 * Two levels only: Parent → Replies (no nested replies)
 */

import { View, Text, Pressable, StyleSheet } from "react-native";
import { Heart } from "lucide-react-native";
import { memo, useCallback } from "react";
import { UserAvatar } from "@/components/ui/avatar";
import { useCommentLikeState } from "@/lib/hooks/use-comment-like-state";
import { MENTION_COLOR } from "@/src/constants/mentions";

// Render comment text with tappable @mentions
function renderCommentText(
  text: string,
  style: any,
  onProfilePress: (username: string) => void,
) {
  if (!text) return null;
  const parts = text.split(/(@\w+)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          const username = part.slice(1);
          return (
            <Text
              key={i}
              onPress={() => onProfilePress(username)}
              style={{ color: MENTION_COLOR, fontWeight: "800" }}
            >
              {part}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

// Thread line color - more visible
const THREAD_LINE_COLOR = "#555";
const THREAD_LINE_WIDTH = 2;

// Avatar sizes
const PARENT_AVATAR_SIZE = 36;
const REPLY_AVATAR_SIZE = 28;

// Indentation
const REPLY_INDENT = 48; // Aligned under parent text, not avatar

export interface CommentData {
  id: string;
  username: string;
  avatar?: string;
  text: string;
  timeAgo?: string;
  likes?: number;
  hasLiked?: boolean;
  postId?: string;
  parentId?: string | null;
  replies?: CommentData[];
}

interface CommentLikeButtonProps {
  postId: string;
  commentId: string;
  initialLikes?: number;
  initialHasLiked?: boolean;
}

export function CommentLikeButton({
  postId,
  commentId,
  initialLikes = 0,
  initialHasLiked = false,
}: CommentLikeButtonProps) {
  const { hasLiked, likesCount, toggle, isPending } = useCommentLikeState(
    postId,
    commentId,
    initialLikes,
    initialHasLiked,
  );

  return (
    <Pressable onPress={toggle} disabled={isPending} style={styles.likeButton}>
      <Heart
        size={16}
        color={hasLiked ? "#FF5BFC" : "#666"}
        fill={hasLiked ? "#FF5BFC" : "none"}
      />
      <Text style={[styles.likeCount, hasLiked && styles.likeCountActive]}>
        {likesCount > 0 ? likesCount : ""}
      </Text>
    </Pressable>
  );
}

interface ThreadedCommentProps {
  comment: CommentData;
  postId: string;
  isHighlighted?: boolean;
  onReply: (username: string, commentId: string) => void;
  onViewAllReplies?: (commentId: string) => void;
  onProfilePress: (username: string) => void;
  maxVisibleReplies?: number;
  showAllReplies?: boolean;
}

// Single Reply Item Component
const ReplyItem = memo(function ReplyItem({
  reply,
  isLast,
  onProfilePress,
  postId,
}: {
  reply: CommentData;
  isLast: boolean;
  onProfilePress: () => void;
  postId: string;
}) {
  return (
    <View style={styles.replyRow}>
      {/* Horizontal connector from vertical line to avatar */}
      <View style={styles.horizontalConnector} />

      {/* Reply content */}
      <Pressable onPress={onProfilePress}>
        <UserAvatar
          uri={reply.avatar}
          username={reply.username}
          size={REPLY_AVATAR_SIZE}
          variant="roundedSquare"
        />
      </Pressable>

      <View style={styles.replyContent}>
        <View style={styles.replyHeader}>
          <Pressable onPress={onProfilePress}>
            <Text style={styles.replyUsername}>{reply.username}</Text>
          </Pressable>
          <Text style={styles.replyTime}>{reply.timeAgo || ""}</Text>
        </View>

        {renderCommentText(reply.text, styles.replyText, onProfilePress)}

        {/* Reply actions - Like only, NO reply button (2-level limit) */}
        <View style={styles.replyActions}>
          <CommentLikeButton
            postId={postId}
            commentId={reply.id}
            initialLikes={reply.likes}
            initialHasLiked={reply.hasLiked}
          />
        </View>
      </View>
    </View>
  );
});

// Reply Container with vertical thread line
const ReplyContainer = memo(function ReplyContainer({
  replies,
  onProfilePress,
  maxVisible,
  showAll,
  onViewAll,
  parentId,
  postId,
}: {
  replies: CommentData[];
  onProfilePress: (username: string) => void;
  maxVisible: number;
  showAll: boolean;
  onViewAll?: (commentId: string) => void;
  parentId: string;
  postId: string;
}) {
  const visibleReplies = showAll ? replies : replies.slice(0, maxVisible);
  const hasMoreReplies = !showAll && replies.length > maxVisible;

  return (
    <View style={styles.replyContainer}>
      {/* Vertical thread line - runs full height of replies */}
      <View style={styles.verticalThreadLine} />

      {/* Replies list */}
      <View style={styles.repliesList}>
        {visibleReplies.map((reply, index) => (
          <ReplyItem
            key={reply.id}
            reply={reply}
            postId={postId}
            isLast={index === visibleReplies.length - 1 && !hasMoreReplies}
            onProfilePress={() => onProfilePress(reply.username)}
          />
        ))}

        {/* View all replies button */}
        {hasMoreReplies && onViewAll && (
          <Pressable
            onPress={() => onViewAll(parentId)}
            style={styles.viewAllButton}
          >
            <View style={styles.horizontalConnector} />
            <Text style={styles.viewAllText}>
              View all {replies.length} replies
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

// Main ThreadedComment Component
function ThreadedCommentComponent({
  postId,
  comment,
  isHighlighted = false,
  onReply,
  onViewAllReplies,
  onProfilePress,
  maxVisibleReplies = 2,
  showAllReplies = false,
}: ThreadedCommentProps) {
  const hasReplies =
    comment.replies &&
    Array.isArray(comment.replies) &&
    comment.replies.length > 0;

  const handleReply = useCallback(() => {
    onReply(comment.username, comment.id);
  }, [comment.username, comment.id, onReply]);

  return (
    <View style={styles.container}>
      {/* Highlight indicator */}
      {isHighlighted && <View style={styles.highlightBar} />}

      {/* Parent comment */}
      <View style={styles.parentRow}>
        <Pressable onPress={() => onProfilePress(comment.username)}>
          <UserAvatar
            uri={comment.avatar}
            username={comment.username}
            size={PARENT_AVATAR_SIZE}
            variant="roundedSquare"
          />
        </Pressable>

        <View style={styles.parentContent}>
          <View style={styles.parentHeader}>
            <Pressable onPress={() => onProfilePress(comment.username)}>
              <Text style={styles.parentUsername}>{comment.username}</Text>
            </Pressable>
            <Text style={styles.parentTime}>{comment.timeAgo || ""}</Text>
          </View>

          {renderCommentText(comment.text, styles.parentText, onProfilePress)}

          {/* Parent actions - Like AND Reply */}
          <View style={styles.parentActions}>
            <CommentLikeButton
              postId={postId}
              commentId={comment.id}
              initialLikes={comment.likes}
              initialHasLiked={comment.hasLiked}
            />

            <Pressable onPress={handleReply}>
              <Text style={styles.replyButtonText}>Reply</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Threaded replies */}
      {hasReplies && (
        <ReplyContainer
          replies={comment.replies!}
          postId={postId}
          onProfilePress={onProfilePress}
          maxVisible={maxVisibleReplies}
          showAll={showAllReplies}
          onViewAll={onViewAllReplies}
          parentId={comment.id}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    position: "relative",
  },
  highlightBar: {
    position: "absolute",
    left: -4,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "#3EA4E5",
    borderRadius: 2,
  },

  // Parent comment styles
  parentRow: {
    flexDirection: "row",
    gap: 12,
  },
  parentAvatar: {
    width: PARENT_AVATAR_SIZE,
    height: PARENT_AVATAR_SIZE,
    borderRadius: Math.min(Math.round(PARENT_AVATAR_SIZE * 0.18), 16),
  },
  parentContent: {
    flex: 1,
  },
  parentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  parentUsername: {
    fontWeight: "600",
    fontSize: 14,
    color: "#fff",
  },
  parentTime: {
    color: "#666",
    fontSize: 12,
  },
  parentText: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
    color: "#fff",
  },
  parentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 8,
  },
  parentLikeCount: {
    color: "#666",
    fontSize: 12,
  },

  // Reply container styles
  replyContainer: {
    marginTop: 12,
    marginLeft: PARENT_AVATAR_SIZE / 2 - THREAD_LINE_WIDTH / 2, // Align line under avatar center
    position: "relative",
    backgroundColor: "rgba(85, 85, 85, 0.1)", // Subtle background to show threading
    borderRadius: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  verticalThreadLine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 12,
    width: THREAD_LINE_WIDTH,
    backgroundColor: THREAD_LINE_COLOR,
    borderRadius: THREAD_LINE_WIDTH / 2,
  },
  repliesList: {
    paddingLeft: REPLY_INDENT - PARENT_AVATAR_SIZE / 2, // Total indent from left edge
  },

  // Reply item styles
  replyRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    position: "relative",
  },
  horizontalConnector: {
    position: "absolute",
    left: -(REPLY_INDENT - PARENT_AVATAR_SIZE / 2),
    top: REPLY_AVATAR_SIZE / 2 - THREAD_LINE_WIDTH / 2,
    width: REPLY_INDENT - PARENT_AVATAR_SIZE / 2 - 4,
    height: THREAD_LINE_WIDTH,
    backgroundColor: THREAD_LINE_COLOR,
    borderRadius: THREAD_LINE_WIDTH / 2,
  },
  replyAvatar: {
    width: REPLY_AVATAR_SIZE,
    height: REPLY_AVATAR_SIZE,
    borderRadius: Math.min(Math.round(REPLY_AVATAR_SIZE * 0.18), 16),
  },
  replyContent: {
    flex: 1,
  },
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  replyUsername: {
    fontWeight: "600",
    fontSize: 13,
    color: "#fff",
  },
  replyTime: {
    color: "#555",
    fontSize: 11,
  },
  replyText: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
    color: "#e0e0e0",
  },
  replyActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 6,
  },

  // Shared styles
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  likeCount: {
    color: "#555",
    fontSize: 11,
  },
  likeCountActive: {
    color: "#FF5BFC",
  },
  replyButtonText: {
    color: "#666",
    fontSize: 12,
    fontWeight: "500",
  },

  // View all button
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    position: "relative",
  },
  viewAllText: {
    color: "#3EA4E5",
    fontSize: 12,
    fontWeight: "500",
  },
});

export const ThreadedComment = memo(ThreadedCommentComponent);
