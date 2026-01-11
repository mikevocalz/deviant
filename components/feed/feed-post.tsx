import { View, Text, Pressable, Dimensions, ScrollView } from "react-native"
import { Image } from "expo-image"
import { SharedImage } from "@/components/shared-image"
import { Article } from "@expo/html-elements"
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal } from "lucide-react-native"
import { useRouter } from "expo-router"
import { useColorScheme } from "@/lib/hooks"
import { usePostStore, useFeedSlideStore } from "@/lib/stores/post-store"
import { useBookmarkStore } from "@/lib/stores/bookmark-store"
import { VideoView, useVideoPlayer } from "expo-video"
import { useRef, useCallback, useEffect, memo } from "react"
import { useIsFocused } from "@react-navigation/native"
import { VideoSeekBar } from "@/components/video-seek-bar"
import { Motion } from "@legendapp/motion"
import { sharePost } from "@/lib/utils/sharing"
import { useFeedPostUIStore } from "@/lib/stores/feed-post-store"

const LONG_PRESS_DELAY = 300

interface FeedPostProps {
  id: string
  author: {
    username: string
    avatar: string
    verified?: boolean
  }
  media: {
    type: "image" | "video"
    url: string
  }[]
  caption?: string
  likes: number
  comments: number
  timeAgo: string
  location?: string
  isNSFW?: boolean
}

const { width } = Dimensions.get("window")
const mediaSize = width - 24

function FeedPostComponent({ id, author, media, caption, likes, comments, timeAgo, location, isNSFW }: FeedPostProps) {
  const router = useRouter()
  const { colors } = useColorScheme()
  const { isPostLiked, toggleLike, getLikeCount } = usePostStore()
  const { isBookmarked, toggleBookmark } = useBookmarkStore()
  const { currentSlides, setCurrentSlide } = useFeedSlideStore()
  const currentSlide = currentSlides[id] || 0

  const isVideo = media[0]?.type === "video"
  const hasMultipleMedia = media.length > 1 && !isVideo

  const isFocused = useIsFocused()
  const {
    pressedPosts,
    likeAnimatingPosts,
    setPressedPost,
    setLikeAnimating,
    setVideoState,
    getVideoState,
    activePostId,
  } = useFeedPostUIStore()
  
  const isActivePost = activePostId === id
  
  const videoState = getVideoState(id)
  const showSeekBar = videoState.showSeekBar
  const videoCurrentTime = videoState.currentTime
  const videoDuration = videoState.duration
  const isPressed = pressedPosts[id] || false
  const likeAnimating = likeAnimatingPosts[id] || false
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const player = useVideoPlayer(isVideo ? media[0].url : "", (player) => {
    player.loop = false
  })

  useEffect(() => {
    if (isVideo && player) {
      try {
        if (isFocused && isActivePost && !showSeekBar) {
          console.log("[FeedPost] Playing video:", id)
          player.play()
        } else {
          console.log("[FeedPost] Pausing video:", id)
          player.pause()
        }
      } catch {
        // Player may have been released
      }
    }
  }, [isFocused, isVideo, player, showSeekBar, isActivePost, id])

  useEffect(() => {
    if (!isVideo || !player) return

    const interval = setInterval(() => {
      try {
        setVideoState(id, {
          currentTime: player.currentTime,
          duration: player.duration || 0,
        })
      } catch {
        // Player may have been released
      }
    }, 100)

    return () => clearInterval(interval)
  }, [isVideo, player, id, setVideoState])

  const handleLongPressStart = useCallback(() => {
    if (!isVideo) return
    longPressTimer.current = setTimeout(() => {
      setVideoState(id, { showSeekBar: true })
      try {
        player?.pause()
      } catch {}
    }, LONG_PRESS_DELAY)
  }, [isVideo, player, id, setVideoState])

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (showSeekBar) {
      setVideoState(id, { showSeekBar: false })
      try {
        player?.play()
      } catch {}
    }
  }, [showSeekBar, player, id, setVideoState])

  const handleVideoSeek = useCallback((time: number) => {
    try {
      if (player) {
        player.currentTime = time
      }
    } catch (e) {
      console.log("Seek error:", e)
    }
  }, [player])

  const isLiked = isPostLiked(id)
  const isSaved = isBookmarked(id)
  const likeCount = getLikeCount(id, likes)

  const handleLike = useCallback(() => {
    setLikeAnimating(id, true)
    toggleLike(id, likes)
    setTimeout(() => setLikeAnimating(id, false), 300)
  }, [id, likes, toggleLike, setLikeAnimating])

  const handleSave = useCallback(() => {
    toggleBookmark(id)
  }, [id, toggleBookmark])

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / mediaSize)
    setCurrentSlide(id, slideIndex)
  }

  const handlePressIn = useCallback(() => {
    setPressedPost(id, true)
  }, [id, setPressedPost])

  const handlePressOut = useCallback(() => {
    setPressedPost(id, false)
  }, [id, setPressedPost])

  const handlePostPress = useCallback(() => {
    router.push(`/(protected)/post/${id}`)
  }, [router, id])

  const handleProfilePress = useCallback(() => {
    router.push(`/(protected)/profile/${author.username}`)
  }, [router, author.username])

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

        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePostPress}
        >
          <View
            style={{ width: mediaSize, height: mediaSize }}
            className="bg-muted"
          >
            {isVideo ? (
              <Pressable
                onPress={handlePostPress}
                onPressIn={handleLongPressStart}
                onPressOut={handleLongPressEnd}
              >
                <VideoView
                  player={player}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  nativeControls={false}
                />
                <VideoSeekBar
                  currentTime={videoCurrentTime}
                  duration={videoDuration}
                  onSeek={handleVideoSeek}
                  visible={showSeekBar}
                  barWidth={mediaSize - 32}
                />
              </Pressable>
            ) : hasMultipleMedia ? (
              <>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  className="z-50"
                >
                  {media.map((medium, index) => (
                    <Image
                      key={index}
                      source={{ uri: medium.url }}
                      style={{ width: mediaSize, height: mediaSize }}
                      contentFit="cover"
                    />
                  ))}
                </ScrollView>
                <View className="absolute bottom-4 left-0 right-0 flex-row justify-center gap-1.5">
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
              <SharedImage
                source={{ uri: media[0].url }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                sharedTag={`post-image-${id}`}
              />
            )}
          </View>
        </Pressable>

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
            <Pressable onPress={() => sharePost(id, caption)}>
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

export const FeedPost = memo(FeedPostComponent)
