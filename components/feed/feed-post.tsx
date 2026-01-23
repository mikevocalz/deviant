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
import { useBookmarkStore } from "@/lib/stores/bookmark-store";
import { VideoView, useVideoPlayer } from "expo-video";
import { useRef, useCallback, useEffect, memo } from "react";
import { useIsFocused } from "@react-navigation/native";
import { VideoSeekBar } from "@/components/video-seek-bar";
import { Motion } from "@legendapp/motion";
import { sharePost } from "@/lib/utils/sharing";
import { useFeedPostUIStore } from "@/lib/stores/feed-post-store";

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

const { width } = Dimensions.get("window");
const mediaSize = width - 24;

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
  const { isPostLiked, toggleLike, getLikeCount } = usePostStore();
  const { isBookmarked, toggleBookmark } = useBookmarkStore();
  const { currentSlides, setCurrentSlide } = useFeedSlideStore();
  const likePostMutation = useLikePost();
  const currentSlide = currentSlides[id] || 0;

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

  const player = useVideoPlayer(
    isVideo && media[0]?.url ? media[0].url : "",
    (player) => {
      player.loop = false;
      player.muted = isMuted;
    },
  );

  useEffect(() => {
    if (isVideo && player) {
      try {
        player.muted = isMuted;
      } catch {
        // Player may have been released
      }
    }
  }, [isVideo, player, isMuted]);

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
      router.push(`/(protected)/post/${id}`);
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
  const isSaved = isBookmarked(id);
  const likeCount = getLikeCount(id, likes);

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
    toggleBookmark(id);
  }, [id, toggleBookmark]);

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
    router.push(`/(protected)/profile/${author.username}`);
  }, [router, author.username]);

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
      <Article className="mx-3 my-4 overflow-hidden rounded-xl border border-border bg-card">
        <View className="flex-row items-center justify-between p-3">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={handleProfilePress}>
              <Motion.View
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", damping: 15, stiffness: 400 }}
              >
                <Image
                  source={{ uri: author.avatar }}
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
                    {author.username}
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
                  {media.map((medium, index) => (
                    <Pressable
                      key={index}
                      onPress={handlePostPress}
                      onPressIn={handlePressIn}
                      onPressOut={handlePressOut}
                    >
                      <Image
                        source={{ uri: medium.url }}
                        style={{ width: mediaSize, height: mediaSize }}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                      />
                    </Pressable>
                  ))}
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
                <Image
                  source={{ uri: media[0]?.url }}
                  style={{ width: mediaSize, height: mediaSize }}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
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
            <Text className="mt-1 text-sm">
              <Text className="font-semibold text-foreground">
                {author.username}
              </Text>{" "}
              <Text className="text-foreground/90">{caption}</Text>
            </Text>
          )}
          {comments > 0 ? (
            <Pressable
              onPress={() => router.push(`/(protected)/comments/${id}`)}
            >
              <Text className="mt-1 text-sm text-muted-foreground">
                View all {comments} comments
              </Text>
            </Pressable>
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
