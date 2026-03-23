import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  Modal,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from "react";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Volume2,
  VolumeX,
  Play,
  Maximize2,
  Minimize2,
} from "lucide-react-native";
import { useColorScheme } from "@/lib/hooks";
import { PostDetailSkeleton } from "@/components/skeletons";
import { usePost, useDeletePost } from "@/lib/hooks/use-posts";
import { useComments } from "@/lib/hooks/use-comments";
import { CommentLikeButton } from "@/components/comments/threaded-comment";
import { usePostLikeState } from "@/lib/hooks/usePostLikeState";
import { useVideoPlayerStore } from "@/lib/stores/video-player-store";
// STABILIZED: Bookmark state comes from server via useBookmarks hook only
import { useToggleBookmark, useBookmarks } from "@/lib/hooks/use-bookmarks";
import { sharePost } from "@/lib/utils/sharing";
import { VideoView, useVideoPlayer } from "expo-video";
import { Image } from "expo-image";
import {
  useVideoLifecycle,
  safePlay,
  safePause,
  safeSeek,
  safeGetCurrentTime,
  safeGetDuration,
  logVideoHealth,
} from "@/lib/video-lifecycle";
import { DVNTSeekBar } from "@/components/media/DVNTSeekBar";
import {
  DVNTLiquidGlass,
  DVNTLiquidGlassIconButton,
} from "@/components/media/DVNTLiquidGlass";
import { HashtagText } from "@/components/ui/hashtag-text";
import { PostActionSheet } from "@/components/post-action-sheet";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useBookmarkStore } from "@/lib/stores/bookmark-store";
import { usePostDetailScreenStore } from "@/lib/stores/post-detail-screen-store";
import { normalizeRouteParams } from "@/lib/navigation/route-params";
import {
  loopDetection,
  useRenderLoopDetector,
} from "@/lib/diagnostics/loop-detection";
import { postsApi } from "@/lib/api/posts";
import { Avatar } from "@/components/ui/avatar";
import { ErrorBoundary } from "@/components/error-boundary";
import { useQueryClient } from "@tanstack/react-query";
import { screenPrefetch } from "@/lib/prefetch";
import { formatLikeCount } from "@/lib/utils/format-count";
import { Alert } from "react-native";
import { TagOverlayViewer } from "@/components/tags/TagOverlayViewer";
import { Galeria } from "@nandorojo/galeria";
import { usePostTags } from "@/lib/hooks/use-post-tags";
import { usePostTagsUIStore } from "@/lib/stores/post-tags-store";
import {
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  useLikesSheet,
  fireLikesTap,
} from "@/src/features/likes/LikesSheetController";
import { normalizePost } from "@/lib/normalization/safe-entity";
import { validatePostParams } from "@/lib/validation/post-params";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// CRITICAL: Match FeedItem's 4:5 aspect ratio for consistent display
const PORTRAIT_HEIGHT = Math.round(SCREEN_WIDTH * (5 / 4));

/**
 * Mini error boundary for media section — if video or Galeria crashes,
 * the rest of the screen (header, caption, comments) still works.
 */
class SafeMediaWrapper extends React.Component<
  { children: React.ReactNode; width: number; height: number },
  { crashed: boolean; error: string }
> {
  state = { crashed: false, error: "" };
  static getDerivedStateFromError(e: Error) {
    return { crashed: true, error: e?.message || "Media failed to load" };
  }
  componentDidCatch(e: Error) {
    console.error("[PostDetail:SafeMedia]", e?.message);
  }
  render() {
    if (this.state.crashed) {
      return (
        <View
          style={{
            width: this.props.width,
            height: this.props.height,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1a1a1a",
          }}
        >
          <Text style={{ color: "#999", fontSize: 14 }}>Media unavailable</Text>
          <Text style={{ color: "#666", fontSize: 11, marginTop: 4 }}>
            {this.state.error}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

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
  const {
    currentTime,
    duration,
    isMuted,
    isPlaying,
    isFullscreen,
    setCurrentTime,
    setDuration,
    setIsMuted,
    setIsPlaying,
    setIsFullscreen,
    reset,
  } = useVideoPlayerStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        p.muted = false;
        logVideoHealth("PostDetail", "player configured", {
          postId,
          videoUrl: videoUrl.slice(0, 50),
        });
      } catch (error) {
        logVideoHealth("PostDetail", "config error", { error: String(error) });
      }
    }
  });

  // Poll video time
  useEffect(() => {
    if (!player || !videoUrl) return;
    pollRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      const t = safeGetCurrentTime(player, isMountedRef, "PostDetail");
      const d = safeGetDuration(player, isMountedRef, "PostDetail");
      if (t !== null) setCurrentTime(t);
      if (d !== null && d > 0) setDuration(d);
    }, 250);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [player, videoUrl, isMountedRef]);

  useFocusEffect(
    useCallback(() => {
      if (player && videoUrl && isSafeToOperate()) {
        safePlay(player, isMountedRef, "PostDetail");
        setIsPlaying(true);
      }
      return () => {
        if (!player || !videoUrl) return;
        if (isSafeToOperate()) {
          safePause(player, isMountedRef, "PostDetail");
          setIsPlaying(false);
        }
      };
    }, [player, videoUrl, isSafeToOperate, isMountedRef]),
  );

  const handleSeek = useCallback(
    (time: number) => safeSeek(player, isMountedRef, time, "PostDetail"),
    [player, isMountedRef],
  );

  const togglePlayPause = useCallback(() => {
    if (!player || !isMountedRef.current) return;
    if (isPlaying) {
      safePause(player, isMountedRef, "PostDetail");
      setIsPlaying(false);
    } else {
      safePlay(player, isMountedRef, "PostDetail");
      setIsPlaying(true);
    }
  }, [player, isMountedRef, isPlaying]);

  const toggleMute = useCallback(() => {
    if (!player || !isMountedRef.current) return;
    try {
      player.muted = !isMuted;
      setIsMuted(!isMuted);
    } catch {}
  }, [player, isMountedRef, isMuted]);

  const handleFullscreenToggle = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen, setIsFullscreen]);

  // CRITICAL: NO early returns - always render same structure to maintain hook count
  const hasVideo = !!videoUrl;

  return (
    <View style={{ width: "100%", height: "100%" }}>
      {!hasVideo ? (
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
      ) : (
        <Pressable onPress={togglePlayPause} style={{ flex: 1 }}>
          <VideoView
            player={player}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            nativeControls={false}
          />
          {/* Play overlay when paused */}
          {!isPlaying && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Play size={28} color="#fff" fill="#fff" />
              </View>
            </View>
          )}
        </Pressable>
      )}

      {/* Mute toggle - only show for videos */}
      <Pressable
        onPress={toggleMute}
        style={{
          display: hasVideo ? "flex" : "none",
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 50,
        }}
        hitSlop={12}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isMuted ? (
            <VolumeX size={16} color="#fff" />
          ) : (
            <Volume2 size={16} color="#fff" />
          )}
        </View>
      </Pressable>

      {/* Expand button - only show for videos */}
      <Pressable
        onPress={handleFullscreenToggle}
        style={{
          display: hasVideo ? "flex" : "none",
          position: "absolute",
          bottom: 12,
          right: 12,
          zIndex: 50,
        }}
        hitSlop={12}
      >
        <DVNTLiquidGlassIconButton size={36}>
          <Maximize2 size={17} color="#fff" />
        </DVNTLiquidGlassIconButton>
      </Pressable>

      {/* Seek bar - only show for videos */}
      <View style={{ display: hasVideo ? "flex" : "none" }}>
        <DVNTSeekBar
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
          onSeekEnd={() => {
            if (isPlaying) safePlay(player, isMountedRef, "PostDetail");
          }}
          barWidth={SCREEN_WIDTH - 32}
        />
      </View>

      {/* Fullscreen modal - only show for videos */}
      <Modal
        visible={hasVideo && isFullscreen}
        animationType="fade"
        supportedOrientations={["portrait", "landscape"]}
        statusBarTranslucent
        onRequestClose={handleFullscreenToggle}
      >
        <StatusBar hidden />
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <Pressable onPress={togglePlayPause} style={{ flex: 1 }}>
            <VideoView
              player={player}
              style={{ flex: 1 }}
              contentFit="contain"
              nativeControls={false}
            />
            {!isPlaying && (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Play size={28} color="#fff" fill="#fff" />
                </View>
              </View>
            )}
          </Pressable>
          {/* Seek bar — 20px from bottom */}
          <View
            style={{
              position: "absolute",
              bottom: 16,
              left: 0,
              right: 0,
              height: 28,
            }}
          >
            <DVNTSeekBar
              currentTime={currentTime}
              duration={duration}
              onSeek={handleSeek}
              onSeekEnd={() => {
                if (isPlaying) safePlay(player, isMountedRef, "PostDetail");
              }}
            />
          </View>
          {/* Minimize — bottom right, above seek bar */}
          <Pressable
            onPress={handleFullscreenToggle}
            style={{ position: "absolute", bottom: 56, right: 20 }}
            hitSlop={16}
          >
            <DVNTLiquidGlassIconButton size={42}>
              <Minimize2 size={20} color="#fff" />
            </DVNTLiquidGlassIconButton>
          </Pressable>
          {/* Mute */}
          <Pressable
            onPress={toggleMute}
            style={{ position: "absolute", top: 52, left: 20 }}
            hitSlop={16}
          >
            <DVNTLiquidGlassIconButton size={42}>
              {isMuted ? (
                <VolumeX size={20} color="#fff" />
              ) : (
                <Volume2 size={20} color="#fff" />
              )}
            </DVNTLiquidGlassIconButton>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function PostDetailScreenContent() {
  // DEV-only loop detection
  useRenderLoopDetector("PostDetail");

  const rawParams = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useColorScheme();

  // FIX: Normalize params once to prevent string|string[] instability loops
  const normalizedParams = useMemo(
    () => normalizeRouteParams(rawParams),
    [rawParams.id],
  );

  loopDetection.log("PostDetail", "mount", { id: normalizedParams.id });

  // CRITICAL: Validate params but DON'T return early
  // Compute validation result, use for conditional rendering AFTER all hooks
  const paramsResult = validatePostParams(normalizedParams);
  const postId = paramsResult.valid ? paramsResult.postId : "";

  // CRITICAL: ALL HOOKS MUST BE CALLED UNCONDITIONALLY
  // Pass empty string if invalid - hooks will handle gracefully
  const { data: post, isLoading, error: postError } = usePost(postId);
  const { data: comments = [], isLoading: commentsLoading } =
    useComments(postId);
  const { data: bookmarkedPostIds = [] } = useBookmarks();
  const toggleBookmarkMutation = useToggleBookmark();
  const currentUser = useAuthStore((state) => state.user);
  const showToast = useUIStore((state) => state.showToast);

  // FIX: Replace useState with Zustand to comply with project mandate
  const { showActionSheet, setShowActionSheet, resetPostDetailScreen } =
    usePostDetailScreenStore();

  const deletePostMutation = useDeletePost();
  const bookmarkStore = useBookmarkStore();
  const { open: openLikesSheet, prefetch: prefetchLikesSheet } =
    useLikesSheet();

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

  // FIX: Replace useState with Zustand
  const { currentSlide, setCurrentSlide } = usePostDetailScreenStore();

  const handleScroll = useCallback(
    (event: any) => {
      const slideIndex = Math.round(
        event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
      );
      setCurrentSlide(slideIndex);
      loopDetection.log("PostDetail", "carousel:scroll", { slideIndex });
    },
    [setCurrentSlide],
  );

  // FIX: Cleanup effect - reset all screen state on unmount
  useEffect(() => {
    return () => {
      loopDetection.log("PostDetail", "unmount", { postId });
      resetPostDetailScreen();
    };
  }, [postId, resetPostDetailScreen]);

  // CRITICAL: Suspense-style guard - if post becomes null mid-render (e.g., deleted),
  // show loading state instead of crashing. This handles the case where:
  // 1. Initial render has cached post data
  // 2. Background refetch completes
  // 3. Post was deleted → query updates to null
  // 4. Component re-renders with null post
  // Without this guard, accessing post.media crashes the app.
  if (!post && !isLoading && !postError) {
    // Post became null after initial load (likely deleted)
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-row items-center border-b border-border bg-background px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={16}
            style={{ padding: 8, margin: -8, marginRight: 8 }}
          >
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">Post</Text>
        </View>
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-muted-foreground text-center">
            This post is no longer available
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

  // NORMALIZATION: Create safePost with guaranteed non-null values
  // This prevents crashes if TanStack Query updates post to null during render
  const safePost = useMemo(() => normalizePost(post, postId), [post, postId]);

  // Navigate to user profile
  const handleProfilePress = useCallback(() => {
    const username = safePost.author?.username;
    if (!username) return;
    console.log(`[PostDetail] Navigating to profile: ${username}`);
    screenPrefetch.profile(queryClient, username);
    router.push({
      pathname: `/(protected)/profile/${username}`,
      params: {
        ...(safePost.author?.avatar ? { avatar: safePost.author.avatar } : {}),
        ...(safePost.author?.name ? { name: safePost.author.name } : {}),
      },
    } as any);
  }, [
    safePost.author?.username,
    safePost.author?.avatar,
    safePost.author?.name,
    router,
    queryClient,
  ]);

  const handleShare = useCallback(async () => {
    if (!postId || !safePost) return;
    try {
      await sharePost(postId, safePost.caption || "");
    } catch (error) {
      console.error("[PostDetail] Share error:", error);
    }
  }, [postId, safePost]);

  const handleActionEdit = useCallback(() => {
    if (postId) {
      loopDetection.log("PostDetail", "navigation:edit", { postId });
      router.push(`/(protected)/edit-post/${postId}`);
    }
    setShowActionSheet(false);
  }, [postId, router, setShowActionSheet]);

  const handleActionDelete = useCallback(() => {
    if (!postId) return;
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deletePostMutation.mutate(postId, {
            onSuccess: () => {
              showToast("success", "Deleted", "Post deleted");
              router.back();
            },
            onError: () => showToast("error", "Error", "Failed to delete post"),
          });
          setShowActionSheet(false);
        },
      },
    ]);
  }, [postId, deletePostMutation, showToast, router]);

  // EARLY RETURNS: Only AFTER all hooks have been called
  // Invalid params - show error UI
  if (!paramsResult.valid) {
    if (__DEV__) {
      console.error(
        "[PostDetail] Invalid params:",
        paramsResult.error,
        paramsResult.rawValue,
      );
    }
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-row items-center border-b border-border bg-background px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={16}
            style={{ padding: 8, margin: -8, marginRight: 8 }}
          >
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">Post</Text>
        </View>
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-muted-foreground text-center mb-2">
            Invalid post link
          </Text>
          <Text className="text-muted-foreground text-sm text-center mb-4">
            {paramsResult.error}
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="px-4 py-2 bg-primary rounded-lg"
          >
            <Text className="text-primary-foreground font-semibold">
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Empty postId after validation
  if (!postId) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-row items-center border-b border-border bg-background px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={16}
            style={{ padding: 8, margin: -8, marginRight: 8 }}
          >
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
          <Pressable
            onPress={() => router.back()}
            hitSlop={16}
            style={{ padding: 8, margin: -8, marginRight: 8 }}
          >
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
          <Pressable
            onPress={() => router.back()}
            hitSlop={16}
            style={{ padding: 8, margin: -8, marginRight: 8 }}
          >
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
          <Pressable
            onPress={() => router.back()}
            hitSlop={16}
            style={{ padding: 8, margin: -8, marginRight: 8 }}
          >
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

  const isVideo = safePost.media?.[0]?.type === "video";
  const hasMedia =
    safePost.media &&
    Array.isArray(safePost.media) &&
    safePost.media.length > 0;
  const hasMultipleMedia = hasMedia && safePost.media.length > 1 && !isVideo;
  const postIdString = safePost.id ? String(safePost.id) : postId;

  // Collect valid image URLs for Galeria full-screen viewer
  const imageUrls = useMemo(() => {
    if (!hasMedia || isVideo) return [];
    return safePost.media
      .filter(
        (m) =>
          m.type !== "video" &&
          m.url &&
          (m.url.startsWith("http://") || m.url.startsWith("https://")),
      )
      .map((m) => m.url);
  }, [hasMedia, isVideo, safePost.media]);
  const isLiked = isPostLiked; // From usePostLikeState hook
  const isSaved = isBookmarked; // isBookmarked is already a boolean from useMemo
  const commentCount = comments.length;

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 bg-background max-w-3xl w-full self-center"
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <DVNTLiquidGlassIconButton size={40}>
            <ArrowLeft size={20} color="#fff" />
          </DVNTLiquidGlassIconButton>
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">Post</Text>
        <Pressable onPress={() => setShowActionSheet(true)} hitSlop={12}>
          <DVNTLiquidGlassIconButton size={40}>
            <MoreHorizontal size={20} color="#fff" />
          </DVNTLiquidGlassIconButton>
        </Pressable>
      </View>

      <ScrollView>
        <View className="border-b border-border bg-card">
          {/* Header */}
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center gap-3">
              <Pressable onPress={handleProfilePress}>
                <Avatar
                  uri={safePost.author?.avatar}
                  username={safePost.author?.username || "User"}
                  size="md"
                  variant="roundedSquare"
                />
              </Pressable>
              <View>
                {safePost.author?.username && (
                  <Pressable onPress={handleProfilePress}>
                    <Text className="text-base font-semibold text-foreground">
                      {safePost.author.username}
                    </Text>
                  </Pressable>
                )}
                {safePost.location && (
                  <Text className="text-sm text-muted-foreground">
                    {safePost.location}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Media - CRITICAL: Always render to maintain stable hook count */}
          <View
            style={{
              display: hasMedia ? "flex" : "none",
              width: SCREEN_WIDTH,
              height: PORTRAIT_HEIGHT,
              borderRadius: isVideo ? 0 : 12,
              overflow: "hidden",
            }}
            className="bg-muted"
          >
            {/* CRITICAL: Always render PostVideoPlayer to prevent hook-order violations
                  Pass empty URL for image posts - component handles gracefully */}
            <View
              style={{
                display: isVideo ? "flex" : "none",
                width: "100%",
                height: "100%",
              }}
            >
              <SafeMediaWrapper width={SCREEN_WIDTH} height={PORTRAIT_HEIGHT}>
                <PostVideoPlayer
                  postId={postId}
                  url={isVideo ? safePost.media?.[0]?.url : ""}
                />
              </SafeMediaWrapper>
            </View>

            <View
              style={{
                display: isVideo ? "none" : "flex",
                width: "100%",
                height: "100%",
              }}
            >
              <SafeMediaWrapper width={SCREEN_WIDTH} height={PORTRAIT_HEIGHT}>
                <Galeria urls={imageUrls.length > 0 ? imageUrls : undefined}>
                  {hasMultipleMedia ? (
                    // Carousel - SAME pattern as FeedItem
                    <>
                      <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                      >
                        {safePost.media.map((medium, index) => {
                          const isValidUrl =
                            medium.url &&
                            (medium.url.startsWith("http://") ||
                              medium.url.startsWith("https://"));
                          const galeriaIndex = isValidUrl
                            ? imageUrls.indexOf(medium.url)
                            : -1;
                          return (
                            <View key={index}>
                              {isValidUrl ? (
                                <Galeria.Image
                                  index={galeriaIndex >= 0 ? galeriaIndex : 0}
                                >
                                  <Image
                                    source={{ uri: medium.url }}
                                    style={{
                                      width: SCREEN_WIDTH,
                                      height: PORTRAIT_HEIGHT,
                                    }}
                                    contentFit="cover"
                                    contentPosition="top"
                                  />
                                </Galeria.Image>
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
                        {safePost.media.map((_, index) => (
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
                    // Single image — tap to view full-screen via Galeria
                    <Galeria.Image index={0}>
                      <Image
                        source={{ uri: post.media[0].url }}
                        style={{
                          width: SCREEN_WIDTH,
                          height: PORTRAIT_HEIGHT,
                        }}
                        contentFit="cover"
                        contentPosition="top"
                        transition={200}
                        cachePolicy="memory-disk"
                      />
                    </Galeria.Image>
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
                        {safePost?.caption || "Media unavailable"}
                      </Text>
                    </View>
                  )}
                </Galeria>
              </SafeMediaWrapper>
            </View>

            {/* Tag overlay — tap image to toggle, sits on top of all media */}
            <Pressable
              onPress={handleImageTap}
              style={{
                display: !isVideo && postTags.length > 0 ? "flex" : "none",
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

            {/* Action pill overlay — matches feed design */}
            <View
              style={{
                position: "absolute",
                bottom: 12,
                left: 12,
                zIndex: 50,
              }}
            >
              <DVNTLiquidGlass paddingH={12} paddingV={9} radius={14}>
                {/* Like */}
                <Pressable
                  onPress={() => {
                    if (!postIdString || !post || isLikePending) return;
                    toggleLike();
                  }}
                  disabled={isLikePending}
                  hitSlop={8}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Heart
                    size={22}
                    color={isLiked ? "#FF5BFC" : "#fff"}
                    fill={isLiked ? "#FF5BFC" : "none"}
                  />
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: "600",
                      textShadowColor: "rgba(0,0,0,0.8)",
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 3,
                    }}
                  >
                    {formatLikeCount(likeCount)}
                  </Text>
                </Pressable>

                <View
                  style={{
                    width: 1,
                    height: 18,
                    backgroundColor: "rgba(255,255,255,0.2)",
                  }}
                />

                {/* Comment */}
                <Pressable
                  hitSlop={8}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                  onPressIn={() => {
                    if (postIdString)
                      screenPrefetch.comments(queryClient, postIdString);
                  }}
                  onPress={() => {
                    if (postIdString)
                      router.push(`/(protected)/comments/${postIdString}`);
                  }}
                >
                  <MessageCircle size={22} color="#fff" />
                  {commentCount > 0 && (
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 14,
                        fontWeight: "600",
                        textShadowColor: "rgba(0,0,0,0.8)",
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 3,
                      }}
                    >
                      {commentCount}
                    </Text>
                  )}
                </Pressable>

                <View
                  style={{
                    width: 1,
                    height: 18,
                    backgroundColor: "rgba(255,255,255,0.2)",
                  }}
                />

                {/* Share */}
                <Pressable hitSlop={8} onPress={handleShare}>
                  <Send size={22} color="#fff" />
                </Pressable>

                <View
                  style={{
                    width: 1,
                    height: 18,
                    backgroundColor: "rgba(255,255,255,0.2)",
                  }}
                />

                {/* Bookmark */}
                <Pressable
                  onPress={() => {
                    if (!postIdString) return;
                    toggleBookmarkMutation.mutate({
                      postId: postIdString,
                      isBookmarked: isSaved,
                    });
                  }}
                  hitSlop={8}
                >
                  <Bookmark
                    size={22}
                    color={isBookmarked ? "#3FDCFF" : "#fff"}
                    fill={isBookmarked ? "#3FDCFF" : "none"}
                  />
                </Pressable>

                <View
                  style={{
                    width: 1,
                    height: 18,
                    backgroundColor: "rgba(255,255,255,0.2)",
                  }}
                />

                {/* Timestamp */}
                <Text
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.6)",
                    textTransform: "uppercase",
                    textShadowColor: "rgba(0,0,0,0.8)",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3,
                  }}
                >
                  {safePost.timeAgo}
                </Text>
              </DVNTLiquidGlass>
            </View>
          </View>

          {/* Text-only post - shown when no media */}
          {!hasMedia && (
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
                {safePost?.caption || ""}
              </Text>
            </View>
          )}

          {/* Caption */}
          {safePost.caption && (
            <View className="px-4 py-3">
              <Text
                style={{
                  fontSize: 15,
                  color: colors.foreground,
                  lineHeight: 22,
                }}
              >
                <Text
                  style={{ fontWeight: "700" }}
                  onPress={() =>
                    router.push(
                      `/(protected)/profile/${safePost.author?.username}` as any,
                    )
                  }
                >
                  {safePost.author?.username || "Unknown User"}{" "}
                </Text>
                <HashtagText
                  text={safePost.caption}
                  textStyle={{ fontSize: 15, color: colors.foreground }}
                />
              </Text>
            </View>
          )}
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

      <PostActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        isOwner={isOwner}
        onEdit={handleActionEdit}
        onDelete={handleActionDelete}
        onShare={handleShare}
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
      onGoBack={() => router.back()}
      onGoHome={() => router.replace("/(protected)/(tabs)" as any)}
    >
      <PostDetailScreenContent />
    </ErrorBoundary>
  );
}
