import { View, Text, ScrollView, Pressable, Dimensions } from "react-native"
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router"
import { useCallback } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { ArrowLeft, Heart, MessageCircle, Share2, Bookmark } from "lucide-react-native"
import { useColorScheme } from "@/lib/hooks"
import { usePost } from "@/lib/hooks/use-posts"
import { usePostStore } from "@/lib/stores/post-store"
import { useBookmarkStore } from "@/lib/stores/bookmark-store"
import { sharePost } from "@/lib/utils/sharing"
import { VideoView, useVideoPlayer } from "expo-video"
import { Image } from "expo-image"
import { SharedImage } from "@/components/shared-image"

const { width } = Dimensions.get("window")

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { data: post, isLoading } = usePost(id!)
  const { isPostLiked, toggleLike, getLikeCount } = usePostStore()
  const { isBookmarked, toggleBookmark } = useBookmarkStore()
  const { colors } = useColorScheme()
  const isVideo = post?.media[0]?.type === "video"
  const player = useVideoPlayer(isVideo ? post?.media[0]?.url ?? "" : "", (player) => {
    player.loop = false
  })

  useFocusEffect(
    useCallback(() => {
      return () => {
        try {
          player?.pause()
        } catch {
          // Player may have been released
        }
      }
    }, [player])
  )

  if (isLoading || !post) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-foreground">Loading post...</Text>
        </View>
      </SafeAreaView>
    )
  }

  const isLiked = isPostLiked(post.id)
  const isSaved = isBookmarked(post.id)
  const likeCount = getLikeCount(post.id, post.likes)

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
              <Image source={{ uri: post.author.avatar }} className="h-10 w-10 rounded-full" />
              <View>
                <Text className="text-base font-semibold text-foreground">{post.author.username}</Text>
                {post.location && <Text className="text-sm text-muted-foreground">{post.location}</Text>}
              </View>
            </View>
          </View>

          {/* Media */}
          <View style={{ width, height: width }} className="bg-muted">
            {isVideo ? (
              <VideoView player={player} style={{ width: "100%", height: "100%" }} contentFit="cover" nativeControls />
            ) : (
              <SharedImage 
                source={{ uri: post.media[0].url }} 
                style={{ width: "100%", height: "100%" }} 
                contentFit="cover" 
                sharedTag={`post-image-${post.id}`}
              />
            )}
          </View>

          {/* Actions */}
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center gap-4">
              <Pressable onPress={() => toggleLike(post.id, post.likes)}>
                <Heart size={28} color={isLiked ? "#FF5BFC" : colors.foreground} fill={isLiked ? "#FF5BFC" : "none"} />
              </Pressable>
              <Pressable onPress={() => router.push(`/(protected)/comments/${post.id}`)}>
                <MessageCircle size={28} color={colors.foreground} />
              </Pressable>
              <Pressable onPress={() => sharePost(post.id, post.caption)}>
                <Share2 size={28} color={colors.foreground} />
              </Pressable>
            </View>
            <Pressable onPress={() => toggleBookmark(post.id)}>
              <Bookmark size={28} color={colors.foreground} fill={isSaved ? colors.foreground : "none"} />
            </Pressable>
          </View>

          {/* Info */}
          <View className="px-4 pb-4">
            <Text className="text-base font-semibold text-foreground">{likeCount.toLocaleString()} likes</Text>
            {post.caption && (
              <Text className="mt-2 text-base">
                <Text className="font-semibold text-foreground">{post.author.username}</Text> <Text className="text-foreground">{post.caption}</Text>
              </Text>
            )}
            <Text className="mt-2 text-xs uppercase text-muted-foreground">{post.timeAgo}</Text>
          </View>
        </View>

        {/* Comments */}
        <View className="p-4">
          {post.comments.length > 0 ? (
            post.comments.map((comment) => (
              <View key={comment.id} className="mb-4">
                {/* Main comment */}
                <View className="flex-row gap-3">
                  <Image source={{ uri: comment.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                  <View className="flex-1">
                    <Text className="text-sm text-foreground">
                      <Text className="font-semibold text-foreground">{comment.username}</Text> <Text className="text-foreground">{comment.text}</Text>
                    </Text>
                    <Text className="mt-1 text-xs text-muted-foreground">{comment.timeAgo}</Text>
                    
                    {/* Reply button */}
                    <Pressable onPress={() => router.push(`/(protected)/comments/${post.id}?commentId=${comment.id}`)} className="mt-2">
                      <Text className="text-xs text-primary">
                        {comment.replies?.length || 0} {comment.replies?.length === 1 ? 'reply' : 'replies'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
                
                {/* Replies preview */}
                {comment.replies && comment.replies.length > 0 && (
                  <View className="ml-11 mt-2">
                    {comment.replies.slice(0, 2).map((reply) => (
                      <View key={reply.id} className="mb-2 flex-row gap-2">
                        <Image source={{ uri: reply.avatar }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                        <View className="flex-1">
                          <Text className="text-sm text-foreground">
                            <Text className="font-semibold text-foreground">{reply.username}</Text> <Text className="text-foreground">{reply.text}</Text>
                          </Text>
                          <Text className="mt-1 text-xs text-muted-foreground">{reply.timeAgo}</Text>
                        </View>
                      </View>
                    ))}
                    {comment.replies.length > 2 && (
                      <Pressable onPress={() => router.push(`/(protected)/comments/${post.id}?commentId=${comment.id}`)} className="ml-7">
                        <Text className="text-xs text-muted-foreground">
                          View all {comment.replies.length} replies
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text className="text-center text-muted-foreground">No comments yet</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
