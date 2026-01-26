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
import { useBookmarkStore } from "@/lib/stores/bookmark-store";
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
  const { isPostLiked, toggleLike, getLikeCount, getCommentCount, postLikeCounts, postCommentCounts } = usePostStore();
  const bookmarkStore = useBookmarkStore();
  const { data: bookmarkedPostIds = [] } = useBookmarks();
  const toggleBookmarkMutation = useToggleBookmark();
  const { currentSlides, setCurrentSlide } = useFeedSlideStore();
  const likePostMutation = useLikePost();
  
  // Sync bookmarks from API to local store on mount
  useEffect(() => {
    if (bookmarkedPostIds.length > 0) {
      // Update local store to match API state
      const currentBookmarks = bookmarkStore.getBookmarkedPostIds();
      const missingBookmarks = bookmarkedPostIds.filter(id => !currentBookmarks.includes(id));
      const extraBookmarks = currentBookmarks.filter(id => !bookmarkedPostIds.includes(id));
      
      // Add missing bookmarks
      missingBookmarks.forEach(id => {
        if (!bookmarkStore.isBookmarked(id)) {
          bookmarkStore.toggleBookmark(id);
        }
      });
      
      // Remove extra bookmarks
      extraBookmarks.forEach(id => {
        if (bookmarkStore.isBookmarked(id)) {
          bookmarkStore.toggleBookmark(id);
        }
      });
    }
  }, [bookmarkedPostIds]);
  
  const isBookmarked = bookmarkStore.isBookmarked(id) || bookmarkedPostIds.includes(id);
  // Fetch last 3 comments for feed display
  const { data: recentCommentsData = [] } = useComments(id, 3);
  const currentSlide = currentSlides[id] || 0;
  
  // Comments are already limited to 3 from API, sorted newest first
  const recentComments = recentCommentsData;

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

  const player = useVideoPlayer(
    videoUrl,
    (player) => {
      if (player && videoUrl) {
        try {
          player.loop = false;
          player.muted = isMuted;
        } catch (error) {
          console.log("[FeedPost] Error configuring player:", error);
        }
      }
    },
  );

  useEffect(() => {
    if (isVideo && player && videoUrl) {
      try {
        player.muted = isMuted;
      } catch (error) {
        // Player may have been released - this is expected
        if (error && typeof error === "object" && "code" in error && error.code !== "ERR_USING_RELEASED_SHARED_OBJECT") {
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
  // Subscribe to like counts to trigger re-renders when they change
  const storedLikeCount = postLikeCounts[id];
  const likeCount = storedLikeCount !== undefined ? storedLikeCount : likes;
  // Subscribe to comment counts to trigger re-renders when they change
  const storedCommentCount = postCommentCounts[id];
  const commentCount = storedCommentCount !== undefined ? storedCommentCount : comments;

  const handleLike = useCallback(() => {
    const wasLiked = isPostLiked(id);
    setLikeAnimating(id, true);
    toggleLike(id, likes);
    likePostMutation.mutate(
      { postId: id, isLiked: wasLiked },
      {
        onError: () => {
          // Rollback on error
          toggleLike(id, likes);
        },
        onSettled: () => {
          setTimeout(() => setLikeAnimating(id, false), 300);
        },
      },
    );
  }, [id, likes, isPostLiked, toggleLike, setLikeAnimating, likePostMutation]);

  const handleSave = useCallback(() => {
    const currentBookmarked = isSaved; // Use isSaved which is the boolean value
    // Optimistically update local store
    bookmarkStore.toggleBookmark(id);
    // Sync with backend
    toggleBookmarkMutation.mutate(
      { postId: id, isBookmarked: currentBookmarked },
      {
        onError: () => {
          // Rollback on error
          bookmarkStore.toggleBookmark(id);
        },
      }
    );
  }, [id, isSaved, bookmarkStore, toggleBookmarkMutation]);

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
                  source={{ uri: author?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(author?.username || "User")}` }}
                  className="h-8 w-8 rounded-full"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              </Motion.View>
            </Pressable>
            <View>
              <View className="flex-row items-center gap-1">
                <Pressable onPress={handleProfilePress}>
                  <Text className="text-sm font-semibold text-foreground">
                    {author?.username || "Unknown User"}
                  </Text>
                </Pressable>
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
            style={{ width: mediaSize, height: mediaSize }}
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
                    const isValidUrl = medium.url && (medium.url.startsWith("http://") || medium.url.startsWith("https://"));
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
                            style={{ width: mediaSize, height: mediaSize }}
                            contentFit="cover"
                            transition={200}
                            cachePolicy="memory-disk"
                          />
                        ) : (
                          <View style={{ width: mediaSize, height: mediaSize }} className="bg-muted items-center justify-center">
                            <Text className="text-muted-foreground text-xs">No image</Text>
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
                style={{ width: mediaSize, height: mediaSize }}
              >
                {media[0]?.url && (media[0].url.startsWith("http://") || media[0].url.startsWith("https://")) ? (
                  <Image
                    source={{ uri: media[0].url }}
                    style={{ width: mediaSize, height: mediaSize }}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={{ width: mediaSize, height: mediaSize }} className="bg-muted items-center justify-center">
                    <Text className="text-muted-foreground text-xs">No image</Text>
                  </View>
                )}
              </Pressable>
            )}
          </View>
        )}

        <View className="flex-row items-center justify-between p-3">
          <View className="flex-row items-center gap-4">
            <Pressable onPress={handleLike}>
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
              onPress={() => router.push(`/(protected)/comments/${id}`)}
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

        <View className="px-3 pb-3">
          <Text className="text-sm font-semibold">
            {likeCount.toLocaleString()} likes
          </Text>
          {caption && (
            <View className="mt-1">
              <HashtagText
                text={`${author?.username || "Unknown User"} ${caption}`}
                textStyle={{ fontSize: 14 }}
              />
            </View>
          )}
          {recentComments.length > 0 || commentCount > 0 ? (
            <>
              {/* Show last 3 comments */}
              {recentComments.length > 0 && (
                <View className="mt-2 gap-1">
                  {recentComments.map((comment) => (
                    <Pressable
                      key={comment.id}
                      onPress={() => router.push(`/(protected)/comments/${id}`)}
                    >
                      <Text className="text-sm text-foreground">
                        <Text className="font-semibold text-foreground">
                          {comment.username}
                        </Text>{" "}
                        <Text className="text-foreground">{comment.text}</Text>
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {commentCount > 3 && (
                <Pressable
                  onPress={() => router.push(`/(protected)/comments/${id}`)}
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
