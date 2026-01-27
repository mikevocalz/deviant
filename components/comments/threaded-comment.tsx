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
import { Image } from "expo-image";
import { Heart } from "lucide-react-native";
import { memo, useCallback } from "react";

// Thread line color - subtle dark gray
const THREAD_LINE_COLOR = "#333";
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
  replies?: CommentData[];
}

interface ThreadedCommentProps {
  comment: CommentData;
  isHighlighted?: boolean;
  isLiked: (commentId: string) => boolean;
  onLike: (commentId: string, isCurrentlyLiked: boolean) => void;
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
  isLiked,
  onLike,
  onProfilePress,
}: {
  reply: CommentData;
  isLast: boolean;
  isLiked: boolean;
  onLike: () => void;
  onProfilePress: () => void;
}) {
  return (
    <View style={styles.replyRow}>
      {/* Horizontal connector from vertical line to avatar */}
      <View style={styles.horizontalConnector} />

      {/* Reply content */}
      <Pressable onPress={onProfilePress}>
        <Image
          source={{
            uri:
              reply.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.username)}&background=3EA4E5&color=fff`,
          }}
          style={styles.replyAvatar}
        />
      </Pressable>

      <View style={styles.replyContent}>
        <View style={styles.replyHeader}>
          <Pressable onPress={onProfilePress}>
            <Text style={styles.replyUsername}>{reply.username}</Text>
          </Pressable>
          <Text style={styles.replyTime}>{reply.timeAgo || ""}</Text>
        </View>

        <Text style={styles.replyText}>{reply.text}</Text>

        {/* Reply actions - Like only, NO reply button (2-level limit) */}
        <View style={styles.replyActions}>
          <Pressable onPress={onLike} style={styles.likeButton}>
            <Heart
              size={14}
              color={isLiked ? "#FF5BFC" : "#555"}
              fill={isLiked ? "#FF5BFC" : "none"}
            />
            <Text style={[styles.likeCount, isLiked && styles.likeCountActive]}>
              {reply.likes || 0}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

// Reply Container with vertical thread line
const ReplyContainer = memo(function ReplyContainer({
  replies,
  isLiked,
  onLike,
  onProfilePress,
  maxVisible,
  showAll,
  onViewAll,
  parentId,
}: {
  replies: CommentData[];
  isLiked: (commentId: string) => boolean;
  onLike: (commentId: string, isCurrentlyLiked: boolean) => void;
  onProfilePress: (username: string) => void;
  maxVisible: number;
  showAll: boolean;
  onViewAll?: (commentId: string) => void;
  parentId: string;
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
            isLast={index === visibleReplies.length - 1 && !hasMoreReplies}
            isLiked={isLiked(reply.id)}
            onLike={() => onLike(reply.id, isLiked(reply.id))}
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
  comment,
  isHighlighted = false,
  isLiked,
  onLike,
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

  const handleLikeParent = useCallback(() => {
    onLike(comment.id, isLiked(comment.id));
  }, [comment.id, isLiked, onLike]);

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
          <Image
            source={{
              uri:
                comment.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.username)}&background=3EA4E5&color=fff`,
            }}
            style={styles.parentAvatar}
          />
        </Pressable>

        <View style={styles.parentContent}>
          <View style={styles.parentHeader}>
            <Pressable onPress={() => onProfilePress(comment.username)}>
              <Text style={styles.parentUsername}>{comment.username}</Text>
            </Pressable>
            <Text style={styles.parentTime}>{comment.timeAgo || ""}</Text>
          </View>

          <Text style={styles.parentText}>{comment.text}</Text>

          {/* Parent actions - Like AND Reply */}
          <View style={styles.parentActions}>
            <Pressable onPress={handleLikeParent} style={styles.likeButton}>
              <Heart
                size={16}
                color={isLiked(comment.id) ? "#FF5BFC" : "#666"}
                fill={isLiked(comment.id) ? "#FF5BFC" : "none"}
              />
              <Text
                style={[
                  styles.parentLikeCount,
                  isLiked(comment.id) && styles.likeCountActive,
                ]}
              >
                {comment.likes || 0}
              </Text>
            </Pressable>

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
          isLiked={isLiked}
          onLike={onLike}
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
    borderRadius: PARENT_AVATAR_SIZE / 2,
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
    borderRadius: REPLY_AVATAR_SIZE / 2,
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
