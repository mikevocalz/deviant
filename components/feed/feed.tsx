import { FlatList, View, Text, LayoutAnimation, Platform, UIManager, RefreshControl, StyleSheet, Animated as RNAnimated } from "react-native"
import { FeedPost } from "./feed-post"
import { useInfiniteFeedPosts } from "@/lib/hooks/use-posts"
import { FeedSkeleton } from "@/components/skeletons"
import { useAppStore } from "@/lib/stores/app-store"
import { useMemo, useEffect, useRef, useCallback } from "react"
import { useFeedPostUIStore } from "@/lib/stores/feed-post-store"
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated"
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
        isNSFW={item.isNSFW}
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

function GradientRefreshIndicator({ refreshing }: { refreshing: boolean }) {
  const dot1Anim = useRef(new RNAnimated.Value(0)).current
  const dot2Anim = useRef(new RNAnimated.Value(0)).current
  const dot3Anim = useRef(new RNAnimated.Value(0)).current
  const animationRef = useRef<RNAnimated.CompositeAnimation | null>(null)

  useEffect(() => {
    if (refreshing) {
      animationRef.current = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(dot1Anim, { toValue: 1, duration: 250, useNativeDriver: true }),
          RNAnimated.timing(dot2Anim, { toValue: 1, duration: 250, useNativeDriver: true }),
          RNAnimated.timing(dot3Anim, { toValue: 1, duration: 250, useNativeDriver: true }),
          RNAnimated.timing(dot1Anim, { toValue: 0, duration: 250, useNativeDriver: true }),
          RNAnimated.timing(dot2Anim, { toValue: 0, duration: 250, useNativeDriver: true }),
          RNAnimated.timing(dot3Anim, { toValue: 0, duration: 250, useNativeDriver: true }),
        ])
      )
      animationRef.current.start()
    } else {
      animationRef.current?.stop()
      dot1Anim.setValue(0)
      dot2Anim.setValue(0)
      dot3Anim.setValue(0)
    }
    return () => {
      animationRef.current?.stop()
    }
  }, [refreshing, dot1Anim, dot2Anim, dot3Anim])

  const dot1Scale = dot1Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] })
  const dot2Scale = dot2Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] })
  const dot3Scale = dot3Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] })

  return (
    <View style={styles.gradientRefreshContainer}>
      <RNAnimated.View style={[styles.gradientDot, { backgroundColor: REFRESH_COLORS[0], transform: [{ scale: dot1Scale }] }]} />
      <RNAnimated.View style={[styles.gradientDot, { backgroundColor: REFRESH_COLORS[1], transform: [{ scale: dot2Scale }] }]} />
      <RNAnimated.View style={[styles.gradientDot, { backgroundColor: REFRESH_COLORS[2], transform: [{ scale: dot3Scale }] }]} />
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
  const { setActivePostId } = useFeedPostUIStore()
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
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleRefresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null
    return <LoadMoreIndicator />
  }, [isFetchingNextPage])

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 70,
    minimumViewTime: 50,
  }).current

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { item: Post; isViewable: boolean }[] }) => {
    if (viewableItems.length > 0) {
      const firstViewable = viewableItems[0]
      if (firstViewable?.isViewable && firstViewable?.item?.id) {
        setActivePostId(firstViewable.item.id)
      }
    } else {
      setActivePostId(null)
    }
  }).current

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
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          tintColor={Platform.OS === "ios" ? "transparent" : REFRESH_COLORS[1]}
          colors={REFRESH_COLORS}
          progressBackgroundColor="#ffffff"
        >
          {Platform.OS === "ios" && <GradientRefreshIndicator refreshing={isRefetching} />}
        </RefreshControl>
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
  gradientRefreshContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 40,
  },
  gradientDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
})
