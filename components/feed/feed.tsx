import { FlatList, View, Text } from "react-native"
import { FeedPost } from "./feed-post"
import { useFeedPosts } from "@/lib/hooks/use-posts"
import { FeedSkeleton } from "@/components/skeletons"
import Animated, { FadeInDown } from "react-native-reanimated"

export function Feed() {
  const { data: posts, isLoading, error } = useFeedPosts()

  if (isLoading) {
    return <FeedSkeleton />
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center pb-20">
        <Text className="text-destructive">Failed to load posts</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <Animated.View entering={FadeInDown.delay(index * 200).duration(800).springify()}>
          <FeedPost
            id={item.id}
            author={item.author}
            media={item.media}
            caption={item.caption}
            likes={item.likes}
            comments={item.comments.length}
            timeAgo={item.timeAgo}
            location={item.location}
          />
        </Animated.View>
      )}
      contentContainerClassName="pb-20"
      showsVerticalScrollIndicator={false}
    />
  )
}
