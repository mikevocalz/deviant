import { View, Text, Pressable, Dimensions, ScrollView } from "react-native";
import { Image } from "expo-image";
import { SharedImage } from "@/components/shared-image";
import { Article } from "@expo/html-elements";
import { Avatar, AvatarSizes } from "@/components/ui/avatar";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Volume2,
  VolumeX,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/lib/hooks";
import { useFeedSlideStore } from "@/lib/stores/post-store";
import { usePostLikeState } from "@/lib/hooks/usePostLikeState";
// Note: usePostStore import removed - like state is managed by usePostLikeState via React Query
import { useComments } from "@/lib/hooks/use-comments";
import { useToggleBookmark } from "@/lib/hooks/use-bookmarks";
import type { Comment } from "@/lib/types";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useEffect, memo, useMemo, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  useVideoLifecycle,
  safePlay,
  safePause,
  safeMute,
  safeSeek,
  safeGetCurrentTime,
  safeGetDuration,
  cleanupPlayer,
  logVideoHealth,
} from "@/lib/video-lifecycle";
import { VideoSeekBar } from "@/components/video-seek-bar";
import { Motion } from "@legendapp/motion";
import { sharePost } from "@/lib/utils/sharing";
import { useFeedPostUIStore } from "@/lib/stores/feed-post-store";
import { HashtagText } from "@/components/ui/hashtag-text";
import { TagBadges } from "@/components/ui/tag-badges";
import { PostActionSheet } from "@/components/post-action-sheet";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useBookmarkStore } from "@/lib/stores/bookmark-store";
import { postsApi } from "@/lib/api/posts";
import { routeToProfile } from "@/lib/utils/route-to-profile";
import { formatLikeCount } from "@/lib/utils/format-count";
import { Alert } from "react-native";

const LONG_PRESS_DELAY = 300;

interface FeedPostProps {
  id: string;
  author: {
    username: string;
    avatar: string;
    verified?: boolean;
    id?: string;
  };
  media: {
    type: "image" | "video";
    url: string;
  }[];
  caption?: string;
  likes: number;
  viewerHasLiked?: boolean; // CRITICAL: Viewer's like state from API
  comments: number;
  timeAgo: string;
  location?: string;
  isNSFW?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const mediaSize = SCREEN_WIDTH; // Full width for media
// Instagram-like 4:5 aspect ratio for portrait-friendly display (prevents head cropping)
const PORTRAIT_HEIGHT = Math.round(SCREEN_WIDTH * 1.25); // 4:5 ratio

function FeedPostComponent({
  id,
  author,
  media,
  caption,
  likes,
  viewerHasLiked = false,
  comments,
  timeAgo,
  location,
  isNSFW,
}: FeedPostProps) {
  const router = useRouter();
  const { colors } = useColorScheme();
  // CENTRALIZED: Like state from single source of truth (React Query cache)
  // CRITICAL: Use viewerHasLiked from API response, NOT hardcoded false
  // The usePostLikeState hook manages cache internally and will sync with server
  const {
    hasLiked,
    likes: likesCount,
    toggle: toggleLike,
    isPending: isLikePending,
  } = usePostLikeState(id, likes, viewerHasLiked, author?.id);

  // DEV: Log like state for debugging sync issues
  if (__DEV__) {
    console.log(`[FeedPost:${id?.slice(0, 8)}] Like state:`, {
      hasLiked,
      likesCount,
      isPending: isLikePending,
    });
  }
  const toggleBookmarkMutation = useToggleBookmark();
  const { currentSlides, setCurrentSlide } = useFeedSlideStore();
  const currentUser = useAuthStore((state) => state.user);
  const showToast = useUIStore((state) => state.showToast);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const bookmarkStore = useBookmarkStore();

  const isOwner = currentUser?.username === author.username;

  // Debug ownership check
  if (__DEV__ && showActionSheet) {
    console.log(`[FeedPost:${id}] Owner check:`, {
      currentUsername: currentUser?.username,
      authorUsername: author.username,
      isOwner,
    });
  }

  const isBookmarked = bookmarkStore.isBookmarked(id);
  // Fetch last 3 comments for feed display
  const { data: recentCommentsData = [], refetch: refetchComments } =
    useComments(id, 3);
  const currentSlide = currentSlides[id] || 0;

  // Comments are already limited to 3 from API, sorted newest first
  const recentComments = recentCommentsData || [];

  const hasMedia = media && media.length > 0;
  const isVideo = hasMedia && media[0]?.type === "video";
  const hasMultipleMedia = hasMedia && media.length > 1 && !isVideo;

  const isFocused = useIsFocused();
  const {
    pressedPosts,
    likeAnimatingPosts,
    setPressedPost,
    setLikeAnimating,
    setVideoState,
    getVideoState,
    activePostId,
    isMuted,
    toggleMute,
  } = useFeedPostUIStore();

  const isActivePost = activePostId === id;

  const videoState = getVideoState(id);
  const showSeekBar = videoState.showSeekBar;
  const videoCurrentTime = videoState.currentTime;
  const videoDuration = videoState.duration;
  const isPressed = pressedPosts[id] || false;
  const likeAnimating = likeAnimatingPosts[id] || false;

  // CRITICAL: Video lifecycle management to prevent crashes
  const {
    isMountedRef,
    safeTimeout,
    safeInterval,
    clearSafeInterval,
    isSafeToOperate,
  } = useVideoLifecycle("FeedPost", id);

  // Validate video URL - must be valid HTTP/HTTPS URL
  const videoUrl = useMemo(() => {
    if (isVideo && media[0]?.url) {
      const url = media[0].url;
      // Only use valid HTTP/HTTPS URLs
      if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
        return url;
      }
    }
    return "";
  }, [isVideo, media]);

  const player = useVideoPlayer(videoUrl, (player) => {
    // CRITICAL: Check mount state before configuring
    if (player && videoUrl && isMountedRef.current) {
      try {
        player.loop = false;
        player.muted = isMuted;
        logVideoHealth("FeedPost", "player configured", {
          id,
          videoUrl: videoUrl.slice(0, 50),
        });
      } catch (error) {
        logVideoHealth("FeedPost", "config error", { error: String(error) });
      }
    }
  });

  // Sync mute state with player
  useEffect(() => {
    if (isVideo && player && videoUrl) {
      safeMute(player, isMountedRef, isMuted, "FeedPost");
    }
  }, [isVideo, player, isMuted, videoUrl, isMountedRef]);

  // Play/pause based on focus and active state
  useEffect(() => {
    if (!isVideo || !player) return;

    if (isSafeToOperate()) {
      if (isFocused && isActivePost && !showSeekBar) {
        safePlay(player, isMountedRef, "FeedPost");
      } else {
        safePause(player, isMountedRef, "FeedPost");
      }
    }

    // Cleanup: pause video when component unmounts or dependencies change
    return () => {
      if (isVideo && player) {
        cleanupPlayer(player, "FeedPost");
      }
    };
  }, [
    isFocused,
    isVideo,
    player,
    showSeekBar,
    isActivePost,
    id,
    isMountedRef,
    isSafeToOperate,
  ]);

  // Track video time for seek bar
  useEffect(() => {
    if (!isVideo || !player) return;

    const interval = safeInterval(() => {
      // Only update if seek bar is visible to reduce re-renders
      if (showSeekBar && isSafeToOperate()) {
        const currentTime = safeGetCurrentTime(
          player,
          isMountedRef,
          "FeedPost",
        );
        const duration = safeGetDuration(player, isMountedRef, "FeedPost");
        setVideoState(id, { currentTime, duration });
      }
    }, 250);

    return () => clearSafeInterval(interval);
  }, [
    isVideo,
    player,
    id,
    setVideoState,
    showSeekBar,
    safeInterval,
    clearSafeInterval,
    isMountedRef,
    isSafeToOperate,
  ]);

  const handleLongPress = useCallback(() => {
    if (!isVideo || !isSafeToOperate()) return;
    setVideoState(id, { showSeekBar: true });
    safePause(player, isMountedRef, "FeedPost");
  }, [isVideo, player, id, setVideoState, isSafeToOperate, isMountedRef]);

  const handleVideoPress = useCallback(() => {
    if (!isSafeToOperate()) return;
    if (showSeekBar) {
      // Tap to hide seek bar and resume
      setVideoState(id, { showSeekBar: false });
      safePlay(player, isMountedRef, "FeedPost");
    } else {
      // Normal tap - navigate to post
      console.log("[FeedPost] handleVideoPress, id:", id);
      if (id) {
        router.push(`/(protected)/post/${id}`);
      } else {
        console.error("[FeedPost] No ID for video press!");
      }
    }
  }, [
    showSeekBar,
    player,
    id,
    setVideoState,
    router,
    isSafeToOperate,
    isMountedRef,
  ]);

  const handleVideoSeek = useCallback(
    (time: number) => {
      safeSeek(player, isMountedRef, time, "FeedPost");
    },
    [player, isMountedRef],
  );

  const handleSeekEnd = useCallback(() => {
    if (!isSafeToOperate()) return;
    setVideoState(id, { showSeekBar: false });
    safePlay(player, isMountedRef, "FeedPost");
  }, [player, id, setVideoState, isSafeToOperate, isMountedRef]);

  const isLiked = hasLiked;
  const isSaved = isBookmarked; // isBookmarked is already a boolean from line 99

  // CENTRALIZED: Like count from single source of truth
  const likeCount = likesCount;

  // Comment count from props
  const commentCount = comments;

  // Refetch comments when comment count changes to ensure we have the latest
  useEffect(() => {
    if (commentCount > 0 && recentComments.length === 0) {
      // If comment count says there are comments but we don't have any, refetch
      refetchComments();
    }
  }, [commentCount, recentComments.length, refetchComments, id]);

  const handleLike = useCallback(() => {
    // CRITICAL: Block if mutation already pending
    if (isLikePending) {
      console.log(`[FeedPost] Like blocked - mutation pending for ${id}`);
      return;
    }

    setLikeAnimating(id, true);
    // CENTRALIZED: Use toggle from hook - handles optimistic updates internally
    toggleLike();
    setTimeout(() => setLikeAnimating(id, false), 300);
  }, [id, isLikePending, setLikeAnimating, toggleLike]);

  const handleSave = useCallback(() => {
    // STABILIZED: No dual state - only call mutation
    // Server response will update React Query cache via useBookmarks
    toggleBookmarkMutation.mutate({ postId: id, isBookmarked: isSaved });
  }, [id, isSaved, toggleBookmarkMutation]);

  const handleShare = useCallback(async () => {
    try {
      await sharePost(id, caption);
    } catch (error) {
      console.error("[FeedPost] Share error:", error);
    }
  }, [id, caption]);

  const handleEdit = useCallback(() => {
    router.push(`/(protected)/edit-post/${id}`);
  }, [id, router]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await postsApi.deletePost(id);
              showToast("success", "Deleted", "Post deleted successfully");
              // The feed will auto-refresh via React Query
            } catch (error) {
              console.error("[FeedPost] Delete error:", error);
              showToast("error", "Error", "Failed to delete post");
            }
          },
        },
      ],
    );
  }, [id, showToast]);

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(
      event.nativeEvent.contentOffset.x / mediaSize,
    );
    setCurrentSlide(id, slideIndex);
  };

  const handlePressIn = useCallback(() => {
    setPressedPost(id, true);
  }, [id, setPressedPost]);

  const handlePressOut = useCallback(() => {
    setPressedPost(id, false);
  }, [id, setPressedPost]);

  const handlePostPress = useCallback(() => {
    console.log("[FeedPost] handlePostPress called, id:", id);
    if (!id) {
      console.error("[FeedPost] Cannot navigate - no post ID!");
      return;
    }
    router.push(`/(protected)/post/${id}`);
  }, [router, id]);

  // Get current user for profile routing
  const currentUserId = useAuthStore((state) => state.user?.id);

  const handleProfilePress = useCallback(() => {
    if (!author?.username) return;
    routeToProfile({
      targetUserId: author?.id,
      targetUsername: author?.username,
      viewerId: currentUserId,
      router,
    });
  }, [router, author?.username, author?.id, currentUserId]);

  return (
    <Motion.View
      animate={{
        scale: isPressed ? 0.98 : 1,
        opacity: isPressed ? 0.95 : 1,
      }}
      transition={{
        type: "spring",
        damping: 20,
        stiffness: 300,
      }}
      className="w-full"
    >
      <Article className="mx-1 my-4 overflow-hidden rounded-xl border border-border bg-card">
        <View className="flex-row items-center justify-between p-3">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={handleProfilePress}>
              <Avatar
                uri={author?.avatar}
                username={author?.username || "User"}
                size={48}
                variant="roundedSquare"
              />
            </Pressable>
            <View>
              <View className="flex-row items-center gap-1">
                {author?.username && (
                  <Pressable onPress={handleProfilePress}>
                    <Text className="text-sm font-semibold text-foreground">
                      {author.username}
                    </Text>
                  </Pressable>
                )}
                {isNSFW && <Text style={{ fontSize: 12 }}>😈</Text>}
              </View>
              {location && (
                <Text className="text-xs text-muted-foreground">
                  {location}
                </Text>
              )}
            </View>
          </View>
          <Pressable className="p-2" onPress={() => setShowActionSheet(true)}>
            <MoreHorizontal size={20} color={colors.foreground} />
          </Pressable>
        </View>

        {hasMedia && (
          <View
            style={{ width: mediaSize, height: PORTRAIT_HEIGHT }}
            className="bg-muted"
          >
            {isVideo ? (
              <View style={{ width: "100%", height: "100%" }}>
                <Pressable
                  onPress={handleVideoPress}
                  onLongPress={handleLongPress}
                  delayLongPress={LONG_PRESS_DELAY}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  style={{ width: "100%", height: "100%" }}
                >
                  <View
                    pointerEvents="none"
                    style={{ width: "100%", height: "100%" }}
                  >
                    <VideoView
                      player={player}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                      nativeControls={false}
                    />
                  </View>
                </Pressable>
                <Pressable
                  onPress={toggleMute}
                  className="absolute top-4 right-4 bg-black/60 rounded-full p-2"
                >
                  {isMuted ? (
                    <VolumeX size={20} color="#fff" />
                  ) : (
                    <Volume2 size={20} color="#fff" />
                  )}
                </Pressable>
                <VideoSeekBar
                  currentTime={videoCurrentTime}
                  duration={videoDuration}
                  onSeek={handleVideoSeek}
                  onSeekEnd={handleSeekEnd}
                  visible={showSeekBar}
                  barWidth={mediaSize - 32}
                />
              </View>
            ) : hasMultipleMedia ? (
              <>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                >
                  {media.map((medium, index) => {
                    const isValidUrl =
                      medium.url &&
                      (medium.url.startsWith("http://") ||
                        medium.url.startsWith("https://"));
                    return (
                      <Pressable
                        key={index}
                        onPress={handlePostPress}
                        onPressIn={handlePressIn}
                        onPressOut={handlePressOut}
                      >
                        {isValidUrl ? (
                          <Image
                            source={{ uri: medium.url }}
                            style={{
                              width: mediaSize,
                              height: PORTRAIT_HEIGHT,
                            }}
                            contentFit="cover"
                            contentPosition="top"
                            transition={200}
                            cachePolicy="memory-disk"
                          />
                        ) : (
                          <View
                            style={{
                              width: mediaSize,
                              height: PORTRAIT_HEIGHT,
                            }}
                            className="bg-muted items-center justify-center"
                          >
                            <Text className="text-muted-foreground text-xs">
                              No image
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View
                  className="absolute bottom-4 left-0 right-0 flex-row justify-center gap-1.5"
                  pointerEvents="none"
                >
                  {media.map((_, index) => (
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
            ) : (
              <Pressable
                onPress={handlePostPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={{ width: mediaSize, height: PORTRAIT_HEIGHT }}
              >
                {media[0]?.url &&
                (media[0].url.startsWith("http://") ||
                  media[0].url.startsWith("https://")) ? (
                  <Image
                    source={{ uri: media[0].url }}
                    style={{ width: mediaSize, height: PORTRAIT_HEIGHT }}
                    contentFit="cover"
                    contentPosition="top"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View
                    style={{ width: mediaSize, height: PORTRAIT_HEIGHT }}
                    className="bg-muted items-center justify-center"
                  >
                    <Text className="text-muted-foreground text-xs">
                      No image
                    </Text>
                  </View>
                )}
              </Pressable>
            )}
          </View>
        )}

        <View className="flex-row items-center justify-between p-3">
          <View className="flex-row items-center gap-4">
            <Pressable onPress={handleLike} disabled={isLikePending}>
              <Motion.View
                animate={{
                  scale: likeAnimating ? 1.3 : 1,
                }}
                transition={{
                  type: "spring",
                  damping: 10,
                  stiffness: 400,
                }}
              >
                <Heart
                  size={24}
                  color={isLiked ? "#FF5BFC" : colors.foreground}
                  fill={isLiked ? "#FF5BFC" : "none"}
                />
              </Motion.View>
            </Pressable>
            <Pressable
              onPress={() => {
                if (id) {
                  router.push(`/(protected)/comments/${id}`);
                }
              }}
            >
              <Motion.View
                whileTap={{ scale: 0.85 }}
                transition={{ type: "spring", damping: 15, stiffness: 400 }}
              >
                <MessageCircle size={24} color={colors.foreground} />
              </Motion.View>
            </Pressable>
            <Pressable onPress={handleShare}>
              <Motion.View
                whileTap={{ scale: 0.85 }}
                transition={{ type: "spring", damping: 15, stiffness: 400 }}
              >
                <Share2 size={24} color={colors.foreground} />
              </Motion.View>
            </Pressable>
          </View>
          <Pressable onPress={handleSave}>
            <Motion.View
              whileTap={{ scale: 0.85 }}
              animate={{ rotate: isSaved ? "0deg" : "0deg" }}
              transition={{ type: "spring", damping: 15, stiffness: 400 }}
            >
              <Bookmark
                size={24}
                color={colors.foreground}
                fill={isSaved ? colors.foreground : "none"}
              />
            </Motion.View>
          </Pressable>
        </View>

        {/* Caption Section - NO gaps, explicit white text */}
        <View className="px-3 pb-3">
          <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>
            {formatLikeCount(likeCount)}
          </Text>
          {caption && (
            <View className="mt-1">
              <HashtagText
                text={`${author?.username || "Unknown User"} ${caption}`}
                textStyle={{ fontSize: 14, color: colors.foreground }}
              />
              <TagBadges text={caption} />
            </View>
          )}
          {recentComments.length > 0 || commentCount > 0 ? (
            <>
              {/* Show last 3 comments */}
              {recentComments.length > 0 && (
                <View className="mt-1 gap-1">
                  {recentComments.map((comment) => (
                    <Pressable
                      key={comment.id}
                      onPress={() => {
                        if (id) {
                          router.push(`/(protected)/comments/${id}`);
                        }
                      }}
                    >
                      <Text className="text-sm text-foreground">
                        <Text className="font-semibold text-foreground">
                          {comment.username}
                        </Text>
                        <Text className="text-foreground">{comment.text}</Text>
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {commentCount > 3 && (
                <Pressable
                  onPress={() => {
                    if (id) {
                      router.push(`/(protected)/comments/${id}`);
                    }
                  }}
                  className="mt-1"
                >
                  <Text className="text-sm text-muted-foreground">
                    View all {commentCount} comments
                  </Text>
                </Pressable>
              )}
            </>
          ) : (
            <Text className="mt-1 text-sm text-muted-foreground">
              No comments yet. Be the first to comment!
            </Text>
          )}
          <Text className="mt-1 text-xs uppercase text-muted-foreground">
            {timeAgo}
          </Text>
        </View>
      </Article>

      <PostActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        isOwner={isOwner}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </Motion.View>
  );
}

export const FeedPost = memo(FeedPostComponent);
