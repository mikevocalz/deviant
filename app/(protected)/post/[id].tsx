import { View, Text, ScrollView, Pressable, Dimensions } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
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
  logVideoHealth,
} from "@/lib/video-lifecycle";
import { HashtagText } from "@/components/ui/hashtag-text";
import { TagBadges } from "@/components/ui/tag-badges";
import { PostActionSheet } from "@/components/post-action-sheet";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useBookmarkStore } from "@/lib/stores/bookmark-store";
import { postsApi } from "@/lib/api/posts";
import { Avatar } from "@/components/ui/avatar";
import { ErrorBoundary } from "@/components/error-boundary";
import { formatLikeCount } from "@/lib/utils/format-count";
import { Alert } from "react-native";
import { TagOverlayViewer } from "@/components/tags/TagOverlayViewer";
import { usePostTags } from "@/lib/hooks/use-post-tags";
import { usePostTagsUIStore } from "@/lib/stores/post-tags-store";
import {
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LikesSheet } from "@/src/features/posts/likes/LikesSheet";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// CRITICAL: Match FeedItem's 4:5 aspect ratio for consistent display
const PORTRAIT_HEIGHT = Math.round(SCREEN_WIDTH * (5 / 4));

/**
 * Isolated video player — only mounts for actual video posts.
 * Keeps useVideoPlayer out of the main component to prevent
 * creating (and tearing down) a native player for every image post.
 */
function PostVideoPlayer({ postId, url }: { postId: string; url?: string }) {
  const { isMountedRef, isSafeToOperate } = useVideoLifecycle(
    "PostDetail",
    postId,
  );

  const videoUrl = useMemo(() => {
    if (
      url &&
      typeof url === "string" &&
      (url.startsWith("http://") || url.startsWith("https://"))
    ) {
      return url;
    }
    return "";
  }, [url]);

  const player = useVideoPlayer(videoUrl || null, (p) => {
    if (p && videoUrl && isMountedRef.current) {
      try {
        p.loop = false;
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
        if (isSafeToOperate()) {
          safePause(player, isMountedRef, "PostDetail");
        }
      };
    }, [player, videoUrl, isSafeToOperate, isMountedRef]),
  );

  if (!videoUrl) {
    return (
      <View
        style={{
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text className="text-muted-foreground">Video unavailable</Text>
      </View>
    );
  }

  return (
    <View style={{ width: "100%", height: "100%" }}>
      <VideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        nativeControls
      />
    </View>
  );
}

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
  const currentUser = useAuthStore((state) => state.user);
  const showToast = useUIStore((state) => state.showToast);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showLikesSheet, setShowLikesSheet] = useState(false);
  const bookmarkStore = useBookmarkStore();

  // Like state from centralized hook
  const {
    hasLiked: isPostLiked,
    likes: likeCount,
    toggle: toggleLike,
    isPending: isLikePending,
  } = usePostLikeState(
    postId,
    post?.likes || 0,
    post?.viewerHasLiked || false,
    post?.author?.id,
  );

  const isOwner = currentUser?.username === post?.author?.username;

  // Debug ownership check
  if (__DEV__) {
    console.log(`[PostDetail:${postId}] Owner check:`, {
      currentUsername: currentUser?.username,
      authorUsername: post?.author?.username,
      isOwner,
    });
  }

  const isBookmarked = useMemo(() => {
    return (
      bookmarkedPostIds.includes(postId) || bookmarkStore.isBookmarked(postId)
    );
  }, [postId, bookmarkedPostIds, bookmarkStore]);

  // Post tags (Instagram-style tap-to-reveal)
  const { data: postTags = [] } = usePostTags(postId);
  const tagsVisible = usePostTagsUIStore((s) => s.visibleTags[postId] ?? false);
  const toggleTags = usePostTagsUIStore((s) => s.toggleTags);
  const tagProgress = useSharedValue(0);

  const handleImageTap = useCallback(() => {
    if (postTags.length > 0) {
      const nextVisible = !tagsVisible;
      toggleTags(postId);
      if (nextVisible) {
        tagProgress.value = withSpring(1, {
          damping: 18,
          stiffness: 180,
          mass: 0.8,
        });
      } else {
        tagProgress.value = withTiming(0, { duration: 180 });
      }
    }
  }, [postTags.length, tagsVisible, toggleTags, postId, tagProgress]);

  // Carousel state - track current slide for multi-image posts
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleScroll = useCallback((event: any) => {
    const slideIndex = Math.round(
      event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
    );
    setCurrentSlide(slideIndex);
  }, []);

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
  const isLiked = isPostLiked; // From usePostLikeState hook
  const isSaved = isBookmarked; // isBookmarked is already a boolean from useMemo
  const commentCount = comments.length;

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 bg-background max-w-3xl w-full self-center"
    >
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
              style={{
                width: SCREEN_WIDTH,
                height: PORTRAIT_HEIGHT,
                borderRadius: 12,
                overflow: "hidden",
              }}
              className="bg-muted"
            >
              {isVideo ? (
                <PostVideoPlayer postId={postId} url={post?.media?.[0]?.url} />
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
                      <View
                        key={index}
                        style={{
                          width: index === currentSlide ? 12 : 6,
                          opacity: index === currentSlide ? 1 : 0.5,
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
                // Single image — plain Image (shared transitions disabled to prevent back-nav crash)
                <Image
                  source={{ uri: post.media[0].url }}
                  style={{ width: SCREEN_WIDTH, height: PORTRAIT_HEIGHT }}
                  contentFit="cover"
                  contentPosition="top"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ) : (
                <View
                  style={{
                    width: "100%",
                    height: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 24,
                  }}
                >
                  <Text className="text-foreground text-base font-medium text-center leading-6">
                    {post?.caption || "Media unavailable"}
                  </Text>
                </View>
              )}

              {/* Tag overlay — tap image to toggle, sits on top of all media */}
              {!isVideo && postTags.length > 0 && (
                <Pressable
                  onPress={handleImageTap}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                >
                  <TagOverlayViewer
                    postId={postId}
                    mediaIndex={currentSlide}
                    tagProgress={tagProgress}
                  />
                </Pressable>
              )}
            </View>
          ) : (
            <View
              style={{
                width: SCREEN_WIDTH,
                minHeight: SCREEN_WIDTH * 0.6,
                paddingHorizontal: 24,
                paddingVertical: 32,
              }}
              className="bg-card items-center justify-center"
            >
              <Text className="text-foreground text-lg font-semibold text-center leading-7">
                {post?.caption || ""}
              </Text>
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
            <Pressable onPress={() => setShowLikesSheet(true)}>
              <Text
                style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}
              >
                {formatLikeCount(likeCount)}
              </Text>
            </Pressable>
            {post.caption && (
              <View className="mt-2">
                <HashtagText
                  text={`${post.author?.username || "Unknown User"} ${post.caption}`}
                  textStyle={{ fontSize: 16, color: colors.foreground }}
                />
                <TagBadges text={post.caption} />
              </View>
            )}
            <Text className="mt-2 text-xs uppercase text-muted-foreground">
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

      <LikesSheet
        postId={postIdString}
        isOpen={showLikesSheet}
        onClose={() => setShowLikesSheet(false)}
      />
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
