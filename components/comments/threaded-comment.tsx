import { memo, useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Heart } from "lucide-react-native";
import { UserAvatar } from "@/components/ui/avatar";
import { useCommentLikeState } from "@/lib/hooks/use-comment-like-state";
import { MENTION_COLOR } from "@/src/constants/mentions";

function renderCommentText(
  text: string,
  style: any,
  onProfilePress: (username: string) => void,
) {
  if (!text) return null;
  const parts = text.split(/(@\w+)/g);
  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (!part.startsWith("@")) {
          return <Text key={index}>{part}</Text>;
        }
        const username = part.slice(1);
        return (
          <Text
            key={index}
            onPress={() => onProfilePress(username)}
            style={{ color: MENTION_COLOR, fontWeight: "800" }}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

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
  rootId?: string | null;
  depth?: number;
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
        size={15}
        color={hasLiked ? "#FF5BFC" : "#7C8798"}
        fill={hasLiked ? "#FF5BFC" : "none"}
      />
      {likesCount > 0 ? (
        <Text style={[styles.likeCount, hasLiked && styles.likeCountActive]}>
          {likesCount}
        </Text>
      ) : null}
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

const AVATAR_SIZE = [36, 30, 24] as const;
const MAX_DEPTH = 2;

function CommentNode({
  comment,
  postId,
  onReply,
  onProfilePress,
  onViewAllReplies,
  maxVisibleReplies,
  showAllReplies,
  isRoot,
}: ThreadedCommentProps & { isRoot: boolean }) {
  const depth = Math.min(comment.depth || 0, MAX_DEPTH);
  const avatarSize = AVATAR_SIZE[Math.min(depth, AVATAR_SIZE.length - 1)];
  const canReply = depth < MAX_DEPTH;
  const replies = Array.isArray(comment.replies) ? comment.replies : [];
  const visibleReplies =
    isRoot && !showAllReplies ? replies.slice(0, maxVisibleReplies) : replies;
  const hiddenReplies = replies.length - visibleReplies.length;

  const handleReply = useCallback(() => {
    onReply(comment.username, comment.id);
  }, [comment.id, comment.username, onReply]);

  return (
    <View
      style={[
        styles.node,
        depth > 0 && styles.nestedNode,
        depth === 1 && styles.depthOne,
        depth === 2 && styles.depthTwo,
        isRoot && styles.rootNode,
      ]}
    >
      <View style={styles.row}>
        <Pressable onPress={() => onProfilePress(comment.username)}>
          <UserAvatar
            uri={comment.avatar}
            username={comment.username}
            size={avatarSize}
            variant="roundedSquare"
          />
        </Pressable>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => onProfilePress(comment.username)}>
              <Text
                style={[styles.username, depth > 0 && styles.usernameNested]}
              >
                {comment.username}
              </Text>
            </Pressable>
            <Text style={styles.timeAgo}>{comment.timeAgo || ""}</Text>
          </View>

          {renderCommentText(
            comment.text,
            [styles.body, depth > 0 && styles.bodyNested],
            onProfilePress,
          )}

          <View style={styles.actions}>
            <CommentLikeButton
              postId={postId}
              commentId={comment.id}
              initialLikes={comment.likes}
              initialHasLiked={comment.hasLiked}
            />
            {canReply ? (
              <Pressable onPress={handleReply}>
                <Text style={styles.replyText}>Reply</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {visibleReplies.length > 0 ? (
        <View style={styles.replies}>
          {visibleReplies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              postId={postId}
              isHighlighted={false}
              onReply={onReply}
              onViewAllReplies={onViewAllReplies}
              onProfilePress={onProfilePress}
              maxVisibleReplies={maxVisibleReplies}
              showAllReplies
              isRoot={false}
            />
          ))}
        </View>
      ) : null}

      {isRoot && hiddenReplies > 0 && onViewAllReplies ? (
        <Pressable
          onPress={() => onViewAllReplies(comment.id)}
          style={styles.viewAllButton}
        >
          <Text style={styles.viewAllText}>
            View all {replies.length} replies
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ThreadedCommentComponent({
  comment,
  postId,
  isHighlighted = false,
  onReply,
  onViewAllReplies,
  onProfilePress,
  maxVisibleReplies = 2,
  showAllReplies = false,
}: ThreadedCommentProps) {
  return (
    <View style={[styles.container, isHighlighted && styles.highlighted]}>
      {isHighlighted ? <View style={styles.highlightBar} /> : null}
      <CommentNode
        comment={comment}
        postId={postId}
        isHighlighted={isHighlighted}
        onReply={onReply}
        onViewAllReplies={onViewAllReplies}
        onProfilePress={onProfilePress}
        maxVisibleReplies={maxVisibleReplies}
        showAllReplies={showAllReplies}
        isRoot
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
    position: "relative",
  },
  highlighted: {
    paddingLeft: 8,
  },
  highlightBar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
    borderRadius: 999,
    backgroundColor: "#3EA4E5",
  },
  node: {
    gap: 10,
  },
  rootNode: {
    paddingRight: 2,
  },
  nestedNode: {
    marginTop: 12,
    paddingLeft: 14,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(148,163,184,0.18)",
  },
  depthOne: {
    marginLeft: 16,
  },
  depthTwo: {
    marginLeft: 10,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  username: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  usernameNested: {
    fontSize: 13,
  },
  timeAgo: {
    color: "#7C8798",
    fontSize: 11,
    fontWeight: "600",
  },
  body: {
    color: "#E5E7EB",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  bodyNested: {
    color: "#D6DCE5",
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 8,
  },
  replies: {
    marginLeft: 4,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  likeCount: {
    color: "#7C8798",
    fontSize: 11,
    fontWeight: "700",
  },
  likeCountActive: {
    color: "#FF5BFC",
  },
  replyText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
  },
  viewAllButton: {
    marginLeft: 64,
    marginTop: 10,
  },
  viewAllText: {
    color: "#60A5FA",
    fontSize: 12,
    fontWeight: "700",
  },
});

export const ThreadedComment = memo(ThreadedCommentComponent);
