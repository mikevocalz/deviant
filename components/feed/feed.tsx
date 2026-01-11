import { FlatList, View, Text, LayoutAnimation, Platform, UIManager } from "react-native"
import { FeedPost } from "./feed-post"
import { useFeedPosts } from "@/lib/hooks/use-posts"
import { FeedSkeleton } from "@/components/skeletons"
import { useAppStore } from "@/lib/stores/app-store"
import { useMemo, useEffect, useRef, useCallback } from "react"
import Animated, { FadeInDown, FadeOut, Layout } from "react-native-reanimated"
import type { Post } from "@/lib/types"

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

function AnimatedFeedPost({ item, index }: { item: Post; index: number }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(600).springify()}
      exiting={FadeOut.duration(300)}
      layout={Platform.OS !== "web" ? Layout.springify() : undefined}
    >
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
  )
}

export function Feed() {
  const { data: posts, isLoading, error } = useFeedPosts()
  const { nsfwEnabled, loadNsfwSetting, nsfwLoaded } = useAppStore()
  const prevNsfwEnabled = useRef(nsfwEnabled)

  useEffect(() => {
    loadNsfwSetting()
  }, [loadNsfwSetting])

  useEffect(() => {
    if (prevNsfwEnabled.current !== nsfwEnabled && Platform.OS !== "web") {
      LayoutAnimation.configureNext({
        duration: 300,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        delete: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
      })
    }
    prevNsfwEnabled.current = nsfwEnabled
  }, [nsfwEnabled])

  const filteredPosts = useMemo(() => {
    if (!posts) return []
    if (nsfwEnabled) return posts
    return posts.filter((post) => !post.isNSFW)
  }, [posts, nsfwEnabled])

  const renderItem = useCallback(({ item, index }: { item: Post; index: number }) => (
    <AnimatedFeedPost item={item} index={index} />
  ), [])

  const keyExtractor = useCallback((item: Post) => item.id, [])

  if (isLoading || !nsfwLoaded) {
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
      data={filteredPosts}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerClassName="pb-20"
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={false}
    />
  )
}
