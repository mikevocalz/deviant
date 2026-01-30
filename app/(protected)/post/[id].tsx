import { View, Text, ScrollView, Pressable, Dimensions } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useEffect, useState } from "react";
import { Motion } from "@legendapp/motion";
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
import { usePost } from "@/lib/hooks/use-posts";
import { useComments } from "@/lib/hooks/use-comments";
import { CommentLikeButton } from "@/components/comments/threaded-comment";
import { usePostLikeState } from "@/lib/hooks/usePostLikeState";
// STABILIZED: Bookmark state comes from server via useBookmarks hook only
import { useToggleBookmark, useBookmarks } from "@/lib/hooks/use-bookmarks";
import { sharePost } from "@/lib/utils/sharing";
import { VideoView, useVideoPlayer } from "expo-video";
import { Image } from "expo-image";
import {
  useVideoLifecycle,
  safePause,
  cleanupPlayer,
  logVideoHealth,
} from "@/lib/video-lifecycle";
import { SharedImage } from "@/components/shared-image";
import { HashtagText } from "@/components/ui/hashtag-text";
import { PostCaption } from "@/components/post-caption";
import { ErrorBoundary } from "@/components/error-boundary";
import { Avatar, AvatarSizes } from "@/components/ui/avatar";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// CRITICAL: Match FeedItem's 4:5 aspect ratio for portrait-friendly display
const PORTRAIT_HEIGHT = Math.round(SCREEN_WIDTH * 1.25);

function PostDetailScreenContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // Normalize id - use empty string as fallback for hooks
  const postId = id ? String(id) : "";

  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY - before any early returns
  const { data: post, isLoading, error: postError } = usePost(postId);
  const { data: comments = [], isLoading: commentsLoading } =
    useComments(postId);
  // STABILIZED: Only use boolean checks from store for comments
  const { data: bookmarkedPostIds = [] } = useBookmarks();
  const toggleBookmarkMutation = useToggleBookmark();
  const { colors } = useColorScheme();

  // CENTRALIZED: Like state from single source of truth
  // CRITICAL: Use viewerHasLiked from API response, NOT hardcoded false
  const initialLikes = post?.likes || 0;
  const initialHasLiked = post?.viewerHasLiked || false;
  const {
    hasLiked,
    likesCount,
    toggle: toggleLike,
    isPending: isLikePending,
  } = usePostLikeState(postId, initialLikes, initialHasLiked, post?.author?.id);

  // STABILIZED: Bookmark state comes from server ONLY via React Query
  const isBookmarked = useMemo(() => {
    return bookmarkedPostIds.includes(postId);
  }, [postId, bookmarkedPostIds]);

  // CRITICAL: Video lifecycle management to prevent crashes
  const { isMountedRef, isSafeToOperate } = useVideoLifecycle(
    "PostDetail",
    postId,
  );

  // Carousel state - track current slide for multi-image posts
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleScroll = useCallback((event: any) => {
    const slideIndex = Math.round(
      event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
    );
    setCurrentSlide(slideIndex);
  }, []);

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
    if (player && videoUrl && isMountedRef.current) {
      try {
        player.loop = false;
        logVideoHealth("PostDetail", "player configured", {
          postId,
          videoUrl: videoUrl.slice(0, 50),
        });
      } catch (error) {
        logVideoHealth("PostDetail", "config error", { error: String(error) });
      }
    }
  });

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (!player || !videoUrl) return;
        // Use safe cleanup on blur
        if (isSafeToOperate()) {
          safePause(player, isMountedRef, "PostDetail");
        }
      };
    }, [player, videoUrl, isSafeToOperate, isMountedRef]),
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
  const hasMultipleMedia = hasMedia && post.media.length > 1 && !isVideo;
  const postIdString = post?.id ? String(post.id) : postId;
  const isLiked = hasLiked;
  const isSaved = isBookmarked;

  // CENTRALIZED: Like count from single source of truth
  const likeCount = likesCount;
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
                <Avatar
                  uri={post.author?.avatar}
                  username={post.author?.username || "User"}
                  size="md"
                  variant="roundedSquare"
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

          {/* Media - CRITICAL: Uses same dimensions as FeedItem (4:5 ratio) */}
          {hasMedia ? (
            <View
              style={{ width: SCREEN_WIDTH, height: PORTRAIT_HEIGHT }}
              className="bg-muted"
            >
              {isVideo && videoUrl && player ? (
                // Video - same dimensions as feed
                <View style={{ width: "100%", height: "100%" }}>
                  <VideoView
                    player={player}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    nativeControls
                  />
                </View>
              ) : isVideo && !videoUrl ? (
                // Video post but invalid URL - show placeholder
                <View
                  style={{
                    width: "100%",
                    height: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text className="text-muted-foreground">
                    Video unavailable
                  </Text>
                </View>
              ) : hasMultipleMedia ? (
                // Carousel - SAME pattern as FeedItem
                <>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                  >
                    {post.media.map((medium, index) => {
                      const isValidUrl =
                        medium.url &&
                        (medium.url.startsWith("http://") ||
                          medium.url.startsWith("https://"));
                      return (
                        <View key={index}>
                          {isValidUrl ? (
                            <Image
                              source={{ uri: medium.url }}
                              style={{
                                width: SCREEN_WIDTH,
                                height: PORTRAIT_HEIGHT,
                              }}
                              contentFit="cover"
                              contentPosition="top"
                            />
                          ) : (
                            <View
                              style={{
                                width: SCREEN_WIDTH,
                                height: PORTRAIT_HEIGHT,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              className="bg-muted"
                            >
                              <Text className="text-muted-foreground text-xs">
                                No image
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>
                  {/* Pagination dots - SAME as FeedItem */}
                  <View
                    className="absolute bottom-4 left-0 right-0 flex-row justify-center gap-1.5"
                    pointerEvents="none"
                  >
                    {post.media.map((_, index) => (
                      <Motion.View
                        key={index}
                        animate={{
                          width: index === currentSlide ? 12 : 6,
                          opacity: index === currentSlide ? 1 : 0.5,
                        }}
                        transition={{
                          type: "spring",
                          damping: 15,
                          stiffness: 300,
                        }}
                        className={`h-1.5 rounded-full ${
                          index === currentSlide
                            ? "bg-primary"
                            : "bg-foreground/50"
                        }`}
                      />
                    ))}
                  </View>
                </>
              ) : post.media?.[0]?.url &&
                (post.media[0].url.startsWith("http://") ||
                  post.media[0].url.startsWith("https://")) ? (
                // Single image
                <Image
                  source={{ uri: post.media[0].url }}
                  style={{ width: SCREEN_WIDTH, height: PORTRAIT_HEIGHT }}
                  contentFit="cover"
                  contentPosition="top"
                />
              ) : (
                <View
                  style={{
                    width: "100%",
                    height: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text className="text-muted-foreground">
                    No media available
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View
              style={{ width: SCREEN_WIDTH, height: PORTRAIT_HEIGHT }}
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
                  // CRITICAL: Block if mutation already pending
                  if (isLikePending) {
                    console.log(
                      `[PostDetail] Like blocked - mutation pending for ${postIdString}`,
                    );
                    return;
                  }
                  // CENTRALIZED: Use toggle from hook - handles optimistic updates internally
                  toggleLike();
                }}
                disabled={isLikePending}
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
                      <Avatar
                        uri={comment.avatar}
                        username={comment.username || "User"}
                        size="sm"
                        variant="roundedSquare"
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
                        <CommentLikeButton
                          postId={postIdString}
                          commentId={comment.id}
                          initialLikes={comment.likes}
                          initialHasLiked={comment.hasLiked}
                        />
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
                                <Avatar
                                  uri={reply.avatar}
                                  username={reply.username || "User"}
                                  size="xs"
                                  variant="roundedSquare"
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
