import { View, Text, ScrollView, Pressable, Dimensions } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
} from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { PostDetailSkeleton } from "@/components/skeletons";
import { usePost, useLikePost } from "@/lib/hooks/use-posts";
import { useComments, useLikeComment } from "@/lib/hooks/use-comments";
import { usePostStore } from "@/lib/stores/post-store";
// STABILIZED: Bookmark state comes from server via useBookmarks hook only
import { useToggleBookmark, useBookmarks } from "@/lib/hooks/use-bookmarks";
import { sharePost } from "@/lib/utils/sharing";
import { VideoView, useVideoPlayer } from "expo-video";
import { Image } from "expo-image";
import { SharedImage } from "@/components/shared-image";
import { HashtagText } from "@/components/ui/hashtag-text";
import { PostCaption } from "@/components/post-caption";
import { ErrorBoundary } from "@/components/error-boundary";

const { width } = Dimensions.get("window");

function PostDetailScreenContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // Normalize id - use empty string as fallback for hooks
  const postId = id ? String(id) : "";

  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY - before any early returns
  const { data: post, isLoading, error: postError } = usePost(postId);
  const { data: comments = [], isLoading: commentsLoading } =
    useComments(postId);
  // STABILIZED: Only use boolean checks from store
  // Counts come from server via post data, NOT from store
  const { isPostLiked, isCommentLiked } = usePostStore();
  const { data: bookmarkedPostIds = [] } = useBookmarks();
  const toggleBookmarkMutation = useToggleBookmark();
  const { colors } = useColorScheme();
  const likePostMutation = useLikePost();
  const likeCommentMutation = useLikeComment();

  // STABILIZED: Bookmark state comes from server ONLY via React Query
  const isBookmarked = useMemo(() => {
    return bookmarkedPostIds.includes(postId);
  }, [postId, bookmarkedPostIds]);

  // Validate video URL - must be valid HTTP/HTTPS URL
  // CRITICAL: Only create a valid URL if we actually have video content
  const videoUrl = useMemo(() => {
    try {
      if (post?.media?.[0]?.type === "video" && post?.media?.[0]?.url) {
        const url = post.media[0].url;
        // Only use valid HTTP/HTTPS URLs
        if (
          url &&
          typeof url === "string" &&
          (url.startsWith("http://") || url.startsWith("https://"))
        ) {
          return url;
        }
      }
    } catch (e) {
      console.warn("[PostDetail] Error validating video URL:", e);
    }
    return "";
  }, [post?.media]);

  // CRITICAL: Only create player if we have a valid video URL
  // This prevents crashes when videoUrl is empty or invalid
  const player = useVideoPlayer(videoUrl || null, (player) => {
    if (player && videoUrl) {
      try {
        player.loop = false;
      } catch (error) {
        console.log("[PostDetail] Error configuring player:", error);
      }
    }
  });

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (!player || !videoUrl) return;
        try {
          if (typeof player.pause === "function") {
            player.pause();
          }
        } catch (error) {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code !== "ERR_USING_RELEASED_SHARED_OBJECT"
          ) {
            console.log("[PostDetail] Error pausing player:", error);
          }
        }
      };
    }, [player, videoUrl]),
  );

  // Navigate to user profile
  const handleProfilePress = useCallback(() => {
    if (!post?.author?.username) return;
    console.log(`[PostDetail] Navigating to profile: ${post.author.username}`);
    router.push(`/(protected)/profile/${post.author.username}`);
  }, [post?.author?.username, router]);

  const handleShare = useCallback(async () => {
    if (!postId || !post) return;
    try {
      await sharePost(postId, post.caption || "");
    } catch (error) {
      console.error("[PostDetail] Share error:", error);
    }
  }, [postId, post]);

  // NOW we can have early returns - after all hooks
  if (!postId) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-row items-center border-b border-border bg-background px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">Post</Text>
        </View>
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-muted-foreground text-center">
            Invalid post ID
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-4 px-4 py-2 bg-primary rounded-lg"
          >
            <Text className="text-primary-foreground font-semibold">
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-row items-center border-b border-border bg-background px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">Post</Text>
        </View>
        <PostDetailSkeleton />
      </SafeAreaView>
    );
  }

  // CRITICAL: Show error state with specific message
  // postError now contains meaningful error messages (not found, permission denied, etc.)
  if (postError) {
    const errorMessage = (postError as Error)?.message || "Failed to load post";
    console.log("[PostDetail] Error state:", { postId, errorMessage });

    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-row items-center border-b border-border bg-background px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">Post</Text>
        </View>
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-muted-foreground text-center">
            {errorMessage}
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-4 px-4 py-2 bg-primary rounded-lg"
          >
            <Text className="text-primary-foreground font-semibold">
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // CRITICAL: Only show "not found" if we're not loading AND have no post
  // This prevents flash of "not found" during initial load
  if (!post) {
    console.log("[PostDetail] No post data:", { postId, isLoading });
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-row items-center border-b border-border bg-background px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">Post</Text>
        </View>
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-muted-foreground text-center">
            Post not found
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-4 px-4 py-2 bg-primary rounded-lg"
          >
            <Text className="text-primary-foreground font-semibold">
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isVideo = post?.media?.[0]?.type === "video";
  const hasMedia =
    post?.media && Array.isArray(post.media) && post.media.length > 0;
  const postIdString = post?.id ? String(post.id) : postId;
  const isLiked = postIdString ? isPostLiked(postIdString) : false;
  const isSaved = isBookmarked;

  // STABILIZED: Counts come from server via post data ONLY
  const likeCount = post?.likes || 0;
  const commentCount = comments.length;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-row items-center border-b border-border bg-background px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-4">
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">Post</Text>
      </View>

      <ScrollView>
        <View className="border-b border-border bg-card">
          {/* Header */}
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center gap-3">
              <Pressable onPress={handleProfilePress}>
                <Image
                  source={{
                    uri:
                      post.author?.avatar ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author?.username || "User")}`,
                  }}
                  className="h-10 w-10 rounded-full"
                />
              </Pressable>
              <View>
                {post.author?.username && (
                  <Pressable onPress={handleProfilePress}>
                    <Text className="text-base font-semibold text-foreground">
                      {post.author.username}
                    </Text>
                  </Pressable>
                )}
                {post.location && (
                  <Text className="text-sm text-muted-foreground">
                    {post.location}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Media */}
          {hasMedia ? (
            <View style={{ width, height: width }} className="bg-muted">
              {isVideo && videoUrl && player ? (
                // CRITICAL: Wrap VideoView in error boundary style check
                // Only render if player is valid
                <View style={{ width: "100%", height: "100%" }}>
                  <VideoView
                    player={player}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    nativeControls
                  />
                </View>
              ) : isVideo && !videoUrl ? (
                // Video post but invalid URL - show placeholder, NOT crash
                <View className="flex-1 items-center justify-center">
                  <Text className="text-muted-foreground">
                    Video unavailable
                  </Text>
                </View>
              ) : post.media?.[0]?.url &&
                (post.media[0].url.startsWith("http://") ||
                  post.media[0].url.startsWith("https://")) ? (
                <SharedImage
                  source={{ uri: post.media[0].url }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  sharedTag={`post-image-${postIdString}`}
                />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Text className="text-muted-foreground">
                    No media available
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View
              style={{ width, height: width }}
              className="bg-muted items-center justify-center"
            >
              <Text className="text-muted-foreground">No media</Text>
            </View>
          )}

          {/* Actions */}
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center gap-4">
              <Pressable
                onPress={() => {
                  if (!postIdString || !post) return;
                  // CRITICAL: Block if mutation already pending for this post
                  if (likePostMutation.isPostPending(postIdString)) {
                    console.log(
                      `[PostDetail] Like blocked - mutation pending for ${postIdString}`,
                    );
                    return;
                  }
                  const wasLiked = isLiked;
                  // NOTE: Don't call toggleLike here - useLikePost mutation handles optimistic updates
                  // and will rollback on error. Calling toggleLike here would cause double-toggle.
                  likePostMutation.mutate({
                    postId: postIdString,
                    isLiked: wasLiked,
                  });
                }}
                disabled={likePostMutation.isPostPending(postIdString)}
              >
                <Heart
                  size={28}
                  color={isLiked ? "#FF5BFC" : colors.foreground}
                  fill={isLiked ? "#FF5BFC" : "none"}
                />
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!postIdString) return;
                  router.push(`/(protected)/comments/${postIdString}`);
                }}
              >
                <MessageCircle size={28} color={colors.foreground} />
              </Pressable>
              <Pressable onPress={handleShare}>
                <Share2 size={28} color={colors.foreground} />
              </Pressable>
            </View>
            <Pressable
              onPress={() => {
                if (!postIdString) return;
                // STABILIZED: No dual state - only call mutation
                toggleBookmarkMutation.mutate({
                  postId: postIdString,
                  isBookmarked: isSaved,
                });
              }}
            >
              <Bookmark
                size={28}
                color={colors.foreground}
                fill={isBookmarked ? colors.foreground : "none"}
              />
            </Pressable>
          </View>

          {/* Info - Caption Section with explicit white text, NO gaps */}
          <View className="px-4 pb-4">
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
              {likeCount.toLocaleString()} likes
            </Text>
            {/* CRITICAL: Caption renders only if content exists, no empty gaps */}
            {post.caption &&
              post.caption.trim().length > 0 &&
              post.author?.username && (
                <View style={{ marginTop: 8 }}>
                  <PostCaption
                    username={post.author.username}
                    caption={post.caption}
                    fontSize={16}
                    onUsernamePress={handleProfilePress}
                  />
                </View>
              )}
            <Text
              style={{
                marginTop: 8,
                fontSize: 12,
                textTransform: "uppercase",
                color: "#A3A3A3",
              }}
            >
              {post.timeAgo}
            </Text>
          </View>
        </View>

        {/* Comments */}
        <View className="p-4">
          {commentsLoading ? (
            <Text className="text-center text-muted-foreground">
              Loading comments...
            </Text>
          ) : Array.isArray(comments) && comments.length > 0 ? (
            comments.map((comment) => {
              if (!comment || !comment.id) return null;
              return (
                <View key={comment.id} className="mb-4">
                  {/* Main comment */}
                  <View className="flex-row gap-3">
                    <Pressable
                      onPress={() => {
                        if (!comment.username) return;
                        router.push(`/(protected)/profile/${comment.username}`);
                      }}
                    >
                      <Image
                        source={{
                          uri:
                            comment.avatar ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.username || "User")}`,
                        }}
                        style={{ width: 32, height: 32, borderRadius: 16 }}
                      />
                    </Pressable>
                    <View className="flex-1">
                      <Pressable
                        onPress={() => {
                          if (!comment.username) return;
                          router.push(
                            `/(protected)/profile/${comment.username}`,
                          );
                        }}
                      >
                        <Text className="text-sm text-foreground">
                          <Text className="font-semibold text-foreground">
                            {comment.username || "User"}
                          </Text>{" "}
                        </Text>
                      </Pressable>
                      <Text className="text-sm text-foreground">
                        {comment.text || ""}
                      </Text>
                      <Text className="mt-1 text-xs text-muted-foreground">
                        {comment.timeAgo}
                      </Text>

                      {/* Like and Reply buttons */}
                      <View className="mt-2 flex-row items-center gap-4">
                        <Pressable
                          onPress={() => {
                            if (!comment.id) return;
                            const wasLiked = isCommentLiked(comment.id);
                            // STABILIZED: No optimistic updates - wait for server
                            likeCommentMutation.mutate({
                              commentId: comment.id,
                              isLiked: wasLiked,
                            });
                          }}
                          className="flex-row items-center gap-1"
                        >
                          <Heart
                            size={14}
                            color={
                              isCommentLiked(comment.id || "")
                                ? "#FF5BFC"
                                : colors.mutedForeground
                            }
                            fill={
                              isCommentLiked(comment.id || "")
                                ? "#FF5BFC"
                                : "none"
                            }
                          />
                          <Text className="text-xs text-muted-foreground">
                            {comment.likes || 0}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            if (!postIdString || !comment.id) return;
                            router.push(
                              `/(protected)/comments/replies/${comment.id}?postId=${postIdString}`,
                            );
                          }}
                        >
                          <Text className="text-xs text-primary">
                            {comment.replies?.length || 0}{" "}
                            {comment.replies?.length === 1
                              ? "reply"
                              : "replies"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {/* Replies preview */}
                  {Array.isArray(comment.replies) &&
                    comment.replies.length > 0 && (
                      <View className="ml-11 mt-2">
                        {comment.replies.slice(0, 2).map((reply) => {
                          if (!reply || !reply.id) return null;
                          return (
                            <View
                              key={reply.id}
                              className="mb-2 flex-row gap-2"
                            >
                              <Pressable
                                onPress={() => {
                                  if (!reply.username) return;
                                  router.push(
                                    `/(protected)/profile/${reply.username}`,
                                  );
                                }}
                              >
                                <Image
                                  source={{
                                    uri:
                                      reply.avatar ||
                                      `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.username || "User")}`,
                                  }}
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 12,
                                  }}
                                />
                              </Pressable>
                              <View className="flex-1">
                                <Pressable
                                  onPress={() => {
                                    if (!reply.username) return;
                                    router.push(
                                      `/(protected)/profile/${reply.username}`,
                                    );
                                  }}
                                >
                                  <Text className="text-sm font-semibold text-foreground">
                                    {reply.username || "User"}
                                  </Text>
                                </Pressable>
                                <Text className="text-sm text-foreground">
                                  {reply.text || ""}
                                </Text>
                                <Text className="mt-1 text-xs text-muted-foreground">
                                  {reply.timeAgo || "Just now"}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                        {Array.isArray(comment.replies) &&
                          comment.replies.length > 2 && (
                            <Pressable
                              onPress={() => {
                                if (!postIdString || !comment.id) return;
                                router.push(
                                  `/(protected)/comments/${postIdString}?commentId=${comment.id}`,
                                );
                              }}
                              className="ml-7"
                            >
                              <Text className="text-xs text-muted-foreground">
                                View all {comment.replies.length} replies
                              </Text>
                            </Pressable>
                          )}
                      </View>
                    )}
                </View>
              );
            })
          ) : (
            <Text className="text-center text-muted-foreground">
              No comments yet
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Wrap with ErrorBoundary for crash protection (especially video)
export default function PostDetailScreen() {
  const router = useRouter();

  return (
    <ErrorBoundary
      screenName="PostDetail"
      onGoHome={() => router.replace("/(protected)/(tabs)/feed" as any)}
    >
      <PostDetailScreenContent />
    </ErrorBoundary>
  );
}
