import { View, Text, Pressable, Dimensions, ScrollView } from "react-native";
import { Image } from "expo-image";
import { SharedImage } from "@/components/shared-image";
import { Article } from "@expo/html-elements";
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
import { usePostStore, useFeedSlideStore } from "@/lib/stores/post-store";
import { useLikePost } from "@/lib/hooks/use-posts";
import { useComments } from "@/lib/hooks/use-comments";
// STABILIZED: Bookmark state comes from server via useBookmarks hook only
import { useToggleBookmark, useBookmarks } from "@/lib/hooks/use-bookmarks";
import type { Comment } from "@/lib/types";
import { VideoView, useVideoPlayer } from "expo-video";
import { useRef, useCallback, useEffect, memo, useMemo, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { VideoSeekBar } from "@/components/video-seek-bar";
import { Motion } from "@legendapp/motion";
import { sharePost } from "@/lib/utils/sharing";
import { useFeedPostUIStore } from "@/lib/stores/feed-post-store";
import { HashtagText } from "@/components/ui/hashtag-text";
import { PostCaption } from "@/components/post-caption";

const LONG_PRESS_DELAY = 300;

interface FeedPostProps {
  id: string;
  author: {
    username: string;
    avatar: string;
    verified?: boolean;
  };
  media: {
    type: "image" | "video";
    url: string;
  }[];
  caption?: string;
  likes: number;
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
  comments,
  timeAgo,
  location,
  isNSFW,
}: FeedPostProps) {
  const router = useRouter();
  const { colors } = useColorScheme();
  // STABILIZED: Only use isPostLiked for boolean check
  // Counts come from server via props, NOT from store
  const { isPostLiked, getCommentCount, postCommentCounts } = usePostStore();
  const { data: bookmarkedPostIds = [] } = useBookmarks();
  const toggleBookmarkMutation = useToggleBookmark();
  const { currentSlides, setCurrentSlide } = useFeedSlideStore();
  const likePostMutation = useLikePost();

  // STABILIZED: Bookmark state comes from server ONLY via React Query
  // No local store sync needed - bookmarkedPostIds is the single source of truth
  const isBookmarked = bookmarkedPostIds.includes(id);
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
    if (player && videoUrl) {
      try {
        player.loop = false;
        player.muted = isMuted;
      } catch (error) {
        console.log("[FeedPost] Error configuring player:", error);
      }
    }
  });

  useEffect(() => {
    if (isVideo && player && videoUrl) {
      try {
        player.muted = isMuted;
      } catch (error) {
        // Player may have been released - this is expected
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code !== "ERR_USING_RELEASED_SHARED_OBJECT"
        ) {
          console.log("[FeedPost] Error setting mute:", error);
        }
      }
    }
  }, [isVideo, player, isMuted, videoUrl]);

  useEffect(() => {
    if (isVideo && player) {
      try {
        if (isFocused && isActivePost && !showSeekBar) {
          player.play();
        } else {
          player.pause();
        }
      } catch {
        // Player may have been released
      }
    }

    // Cleanup: pause video when component unmounts or dependencies change
    return () => {
      if (isVideo && player) {
        try {
          player.pause();
        } catch {
          // Player may have been released
        }
      }
    };
  }, [isFocused, isVideo, player, showSeekBar, isActivePost, id]);

  useEffect(() => {
    if (!isVideo || !player) return;

    const interval = setInterval(() => {
      try {
        // Only update if seek bar is visible to reduce re-renders
        if (showSeekBar) {
          setVideoState(id, {
            currentTime: player.currentTime,
            duration: player.duration || 0,
          });
        }
      } catch {
        // Player may have been released
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isVideo, player, id, setVideoState, showSeekBar]);

  const handleLongPress = useCallback(() => {
    if (!isVideo) return;
    setVideoState(id, { showSeekBar: true });
    try {
      player?.pause();
    } catch {}
  }, [isVideo, player, id, setVideoState]);

  const handleVideoPress = useCallback(() => {
    if (showSeekBar) {
      // Tap to hide seek bar and resume
      setVideoState(id, { showSeekBar: false });
      try {
        player?.play();
      } catch {}
    } else {
      // Normal tap - navigate to post
      if (id) {
        router.push(`/(protected)/post/${id}`);
      }
    }
  }, [showSeekBar, player, id, setVideoState, router]);

  const handleVideoSeek = useCallback(
    (time: number) => {
      try {
        if (player) {
          player.currentTime = time;
        }
      } catch (e) {
        console.log("Seek error:", e);
      }
    },
    [player],
  );

  const handleSeekEnd = useCallback(() => {
    setVideoState(id, { showSeekBar: false });
    try {
      player?.play();
    } catch {}
  }, [player, id, setVideoState]);

  const isLiked = isPostLiked(id);
  const isSaved = isBookmarked; // isBookmarked is already a boolean from line 99

  // STABILIZED: Like count comes from server via props ONLY
  // No client-side count manipulation
  const likeCount = likes;

  // Comment counts can be tracked for UI updates
  const storedCommentCount = postCommentCounts[id];
  const commentCount =
    storedCommentCount !== undefined ? storedCommentCount : comments;

  // Refetch comments when comment count changes to ensure we have the latest
  useEffect(() => {
    if (commentCount > 0 && recentComments.length === 0) {
      // If comment count says there are comments but we don't have any, refetch
      refetchComments();
    }
  }, [commentCount, recentComments.length, refetchComments, id]);

  const handleLike = useCallback(() => {
    // CRITICAL: Block if mutation already pending for this post
    if (likePostMutation.isPostPending(id)) {
      console.log(`[FeedPost] Like blocked - mutation pending for ${id}`);
      return;
    }

    const wasLiked = isPostLiked(id);
    setLikeAnimating(id, true);

    // STABILIZED: No optimistic updates - wait for server
    // Animation clears after delay regardless of result
    likePostMutation.mutate({ postId: id, isLiked: wasLiked });
    setTimeout(() => setLikeAnimating(id, false), 300);
  }, [id, isPostLiked, setLikeAnimating, likePostMutation]);

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
    router.push(`/(protected)/post/${id}`);
  }, [router, id]);

  const handleProfilePress = useCallback(() => {
    if (!author?.username) return;
    router.push(`/(protected)/profile/${author.username}`);
  }, [router, author?.username]);

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
              <Motion.View
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", damping: 15, stiffness: 400 }}
              >
                <Image
                  source={{
                    uri:
                      author?.avatar ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(author?.username || "User")}`,
                  }}
                  className="h-8 w-8 rounded-full"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              </Motion.View>
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
                {isNSFW && (
                  <View className="h-3.5 w-3.5 items-center justify-center rounded-full bg-[#FC253A]">
                    <Text className="text-[8px] text-white">✓</Text>
                  </View>
                )}
              </View>
              {location && (
                <Text className="text-xs text-muted-foreground">
                  {location}
                </Text>
              )}
            </View>
          </View>
          <Pressable className="p-2">
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
            <Pressable
              onPress={handleLike}
              disabled={likePostMutation.isPostPending(id)}
            >
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
            {likeCount.toLocaleString()} likes
          </Text>
          {/* CRITICAL: Caption renders only if content exists, no empty gaps */}
          {caption && caption.trim().length > 0 && author?.username && (
            <View style={{ marginTop: 4 }}>
              <PostCaption
                username={author.username}
                caption={caption}
                fontSize={14}
                onUsernamePress={handleProfilePress}
              />
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
    </Motion.View>
  );
}

export const FeedPost = memo(FeedPostComponent);
