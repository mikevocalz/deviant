import { FlatList, View, Text, LayoutAnimation, Platform, UIManager, RefreshControl, StyleSheet } from "react-native"
import { FeedPost } from "./feed-post"
import { useInfiniteFeedPosts } from "@/lib/hooks/use-posts"
import { FeedSkeleton } from "@/components/skeletons"
import { useAppStore } from "@/lib/stores/app-store"
import { useMemo, useEffect, useRef, useCallback } from "react"
import Animated, { FadeInDown, FadeOut, Layout } from "react-native-reanimated"
import type { Post } from "@/lib/types"


if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const REFRESH_COLORS = ["#34A2DF", "#8A40CF", "#FF5BFC"]

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

function LoadMoreIndicator() {
  return (
    <View style={styles.loadMoreContainer}>
      <View style={styles.loadMoreDots}>
        <View style={[styles.loadMoreDot, { backgroundColor: REFRESH_COLORS[0] }]} />
        <View style={[styles.loadMoreDot, { backgroundColor: REFRESH_COLORS[1] }]} />
        <View style={[styles.loadMoreDot, { backgroundColor: REFRESH_COLORS[2] }]} />
      </View>
    </View>
  )
}

export function Feed() {
  const { 
    data, 
    isLoading, 
    error, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteFeedPosts()
  
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

  const allPosts = useMemo(() => {
    if (!data?.pages) return []
    return data.pages.flatMap(page => page.data)
  }, [data])

  const filteredPosts = useMemo(() => {
    if (nsfwEnabled) return allPosts
    return allPosts.filter((post) => !post.isNSFW)
  }, [allPosts, nsfwEnabled])

  const renderItem = useCallback(({ item, index }: { item: Post; index: number }) => (
    <AnimatedFeedPost item={item} index={index} />
  ), [])

  const keyExtractor = useCallback((item: Post) => item.id, [])

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      console.log("[Feed] Loading more posts...")
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleRefresh = useCallback(async () => {
    console.log("[Feed] Refreshing feed...")
    await refetch()
  }, [refetch])

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null
    return <LoadMoreIndicator />
  }, [isFetchingNextPage])

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
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={renderFooter}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          tintColor={REFRESH_COLORS[1]}
          colors={REFRESH_COLORS}
          progressBackgroundColor="#ffffff"
          title="Pull to refresh"
          titleColor={REFRESH_COLORS[1]}
        />
      }
    />
  )
}

const styles = StyleSheet.create({
  loadMoreContainer: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreDots: {
    flexDirection: "row",
    gap: 8,
  },
  loadMoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})
