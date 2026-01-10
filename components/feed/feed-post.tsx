import { View, Text, Pressable, Dimensions, ScrollView } from "react-native"
import { Image } from "expo-image"
import { Article } from "@expo/html-elements"
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal } from "lucide-react-native"
import { useRouter } from "expo-router"
import { useColorScheme } from "@/lib/hooks"
import { usePostStore, useFeedSlideStore } from "@/lib/stores/post-store"
import { useBookmarkStore } from "@/lib/stores/bookmark-store"
import { VideoView, useVideoPlayer } from "expo-video"
import { useRef, useCallback, useEffect } from "react"
import { useIsFocused } from "@react-navigation/native"

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
}

const { width } = Dimensions.get("window")
const mediaSize = width - 24

export function FeedPost({ id, author, media, caption, likes, comments, timeAgo, location }: FeedPostProps) {
  const router = useRouter()
  const { colors } = useColorScheme()
  const { isPostLiked, toggleLike, getLikeCount } = usePostStore()
  const { isBookmarked, toggleBookmark } = useBookmarkStore()
  const { currentSlides, setCurrentSlide } = useFeedSlideStore()
  const currentSlide = currentSlides[id] || 0

  const isVideo = media[0]?.type === "video"
  const hasMultipleMedia = media.length > 1 && !isVideo

  const isFocused = useIsFocused()

  const player = useVideoPlayer(isVideo ? media[0].url : "", (player) => {
    player.loop = false
  })

  useEffect(() => {
    if (isVideo && player) {
      try {
        if (isFocused) {
          player.play()
        } else {
          player.pause()
        }
      } catch (e) {
        // Player may have been released
      }
    }
  }, [isFocused, isVideo, player])

  const isLiked = isPostLiked(id)
  const isSaved = isBookmarked(id)
  const likeCount = getLikeCount(id, likes)

  const handleLike = () => toggleLike(id, likes)
  const handleSave = () => toggleBookmark(id)

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / mediaSize)
    setCurrentSlide(id, slideIndex)
  }

  return (
    <Article className="mx-3 my-4 overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <View className="flex-row items-center justify-between p-3">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.push(`/profile/${author.username}`)}>
            <Image source={{ uri: author.avatar }} className="h-8 w-8 rounded-full" />
          </Pressable>
          <View>
            <View className="flex-row items-center gap-1">
              <Pressable onPress={() => router.push(`/profile/${author.username}`)}>
                <Text className="text-sm font-semibold text-foreground">{author.username}</Text>
              </Pressable>
              {author.verified && (
                <View className="h-3.5 w-3.5 items-center justify-center rounded-full bg-primary">
                  <Text className="text-[8px] text-white">✓</Text>
                </View>
              )}
            </View>
            {location && <Text className="text-xs text-muted-foreground">{location}</Text>}
          </View>
        </View>
        <Pressable className="p-2">
          <MoreHorizontal size={20} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Media */}
      <View style={{ width: mediaSize, height: mediaSize }} className="bg-muted">
        {isVideo ? (
          <Pressable onPress={() => router.push(`/(protected)/post/${id}`)}>
            <VideoView player={player} style={{ width: "100%", height: "100%" }} contentFit="cover" nativeControls />
          </Pressable>
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
                <Pressable key={index} onPress={() => router.push(`/(protected)/post/${id}`)}>
                  <Image
                    source={{ uri: medium.url }}
                    style={{ width: mediaSize, height: mediaSize }}
                    contentFit="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
            <View className="absolute bottom-4 left-0 right-0 flex-row justify-center gap-1.5">
              {media.map((_, index) => (
                <View
                  key={index}
                  className={`h-1.5 rounded-full ${
                    index === currentSlide ? "w-3 bg-primary" : "w-1.5 bg-foreground/50"
                  }`}
                />
              ))}
            </View>
          </>
        ) : (
          <Pressable onPress={() => router.push(`/(protected)/post/${id}`)}>
            <Image source={{ uri: media[0].url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          </Pressable>
        )}
      </View>

      {/* Actions */}
      <View className="flex-row items-center justify-between p-3">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={handleLike}>
            <Heart size={24} color={isLiked ? "#FF5BFC" : colors.foreground} fill={isLiked ? "#FF5BFC" : "none"} />
          </Pressable>
          <Pressable onPress={() => router.push(`/(protected)/comments/${id}`)}>
            <MessageCircle size={24} color={colors.foreground} />
          </Pressable>
          <Pressable>
            <Share2 size={24} color={colors.foreground} />
          </Pressable>
        </View>
        <Pressable onPress={handleSave}>
          <Bookmark size={24} color={colors.foreground} fill={isSaved ? colors.foreground : "none"} />
        </Pressable>
      </View>

      {/* Info */}
      <View className="px-3 pb-3">
        <Text className="text-sm font-semibold">{likeCount.toLocaleString()} likes</Text>
        {caption && (
          <Text className="mt-1 text-sm">
            <Text className="font-semibold text-foreground">{author.username}</Text>{" "}
            <Text className="text-foreground/90">{caption}</Text>
          </Text>
        )}
        {comments > 0 ? (
          <Pressable onPress={() => router.push(`/(protected)/comments/${id}`)}>
            <Text className="mt-1 text-sm text-muted-foreground">View all {comments} comments</Text>
          </Pressable>
        ) : (
          <Text className="mt-1 text-sm text-muted-foreground">No comments yet. Be the first to comment!</Text>
        )}
        <Text className="mt-1 text-xs uppercase text-muted-foreground">{timeAgo}</Text>
      </View>
    </Article>
  )
}
