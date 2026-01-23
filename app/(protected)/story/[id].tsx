
import { View, Text, Pressable, Dimensions } from "react-native"
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router"
import { Image } from "expo-image"
import { VideoView, useVideoPlayer } from "expo-video"
import { X, ChevronLeft, ChevronRight } from "lucide-react-native"
import { useEffect, useCallback, useRef, useState } from "react"
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, SharedValue } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useStoryViewerStore } from "@/lib/stores/comments-store"
import { VideoSeekBar } from "@/components/video-seek-bar"
import { useStories } from "@/lib/hooks/use-stories"

const { width, height } = Dimensions.get("window")
const LONG_PRESS_DELAY = 300

function ProgressBar({ progress }: { progress: SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    height: "100%",
    backgroundColor: "#fff",
  }))

  return <Animated.View style={animatedStyle} />
}

export default function StoryViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { currentStoryId, currentItemIndex, setCurrentStoryId, setCurrentItemIndex } = useStoryViewerStore()
  const insets = useSafeAreaInsets()
  const progress = useSharedValue(0)
  const [showSeekBar, setShowSeekBar] = useState(false)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPaused = useRef(false)

  // Fetch real stories from API
  const { data: storiesData = [], isLoading } = useStories()

  useEffect(() => {
    if (id && currentStoryId !== id) {
      setCurrentStoryId(id)
    }
  }, [id, currentStoryId, setCurrentStoryId])

  // Filter stories that have content
  const availableStories = storiesData.filter((s) => s.items && s.items.length > 0)
  const currentStoryIndex = availableStories.findIndex((s) => s.id === currentStoryId)
  const story = availableStories[currentStoryIndex]
  const currentItem = story?.items?.[currentItemIndex]

  const hasNextUser = currentStoryIndex < availableStories.length - 1
  const hasPrevUser = currentStoryIndex > 0

  const isVideo = currentItem?.type === "video"
  const isImage = currentItem?.type === "image"
  const videoUrl = isVideo && currentItem?.url ? currentItem.url : ""

  const player = useVideoPlayer(videoUrl, (player) => {
    if (player && videoUrl) {
      player.loop = false
      player.play()
    }
  })

  useEffect(() => {
    if (!isVideo || !player) return

    const interval = setInterval(() => {
      try {
        setVideoCurrentTime(player.currentTime)
        setVideoDuration(player.duration || 0)
      } catch {
        // Player may have been released
      }
    }, 100)

    return () => clearInterval(interval)
  }, [isVideo, player])

  const handleLongPressStart = useCallback(() => {
    if (!isVideo) return
    longPressTimer.current = setTimeout(() => {
      setShowSeekBar(true)
      isPaused.current = true
      progress.value = progress.value // Pause the animation
      try {
        player?.pause()
      } catch {}
    }, LONG_PRESS_DELAY)
  }, [isVideo, player, progress])

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (showSeekBar) {
      setShowSeekBar(false)
      isPaused.current = false
      try {
        player?.play()
      } catch {}
    }
  }, [showSeekBar, player])

  const handleSeek = useCallback((time: number) => {
    try {
      if (player) {
        player.currentTime = time
      }
    } catch (e) {
      console.log("Seek error:", e)
    }
  }, [player])

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

  useEffect(() => {
    if (!currentItem || !currentStoryId) return

    // Reset progress for new item
    progress.value = 0
    
    const duration = currentItem.duration || 5000
    
    // Small delay to ensure component is mounted
    const timer = setTimeout(() => {
      // Animate progress bar
      progress.value = withTiming(1, { duration }, (finished) => {
        if (finished) {
          runOnJS(handleNext)()
        }
      })
    }, 50)

    return () => {
      clearTimeout(timer)
      progress.value = 0
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItemIndex, currentStoryId])

  const goToNextUser = useCallback(() => {
    if (currentStoryIndex < availableStories.length - 1) {
      const nextStory = availableStories[currentStoryIndex + 1]
      setCurrentItemIndex(0)
      progress.value = 0
      // Navigate to the next user's story
      router.replace(`/(protected)/story/${nextStory.id}`)
    }
  }, [currentStoryIndex, availableStories, setCurrentItemIndex, progress, router])

  const goToPrevUser = useCallback(() => {
    if (currentStoryIndex > 0) {
      const prevStory = availableStories[currentStoryIndex - 1]
      const prevStoryItemsCount = prevStory?.items?.length || 0
      setCurrentItemIndex(Math.max(0, prevStoryItemsCount - 1))
      progress.value = 0
      // Navigate to the previous user's story
      router.replace(`/(protected)/story/${prevStory.id}`)
    }
  }, [currentStoryIndex, availableStories, setCurrentItemIndex, progress, router])

  const handleNext = useCallback(() => {
    if (!story || !story.items) return

    if (currentItemIndex < story.items.length - 1) {
      // Next story item for current user
      setCurrentItemIndex(currentItemIndex + 1)
    } else if (currentStoryIndex < availableStories.length - 1) {
      // Move to next user's stories
      goToNextUser()
    } else {
      // No more stories, exit
      router.back()
    }
  }, [story, currentItemIndex, currentStoryIndex, availableStories, setCurrentItemIndex, goToNextUser, router])

  const handlePrev = useCallback(() => {
    if (currentItemIndex > 0) {
      // Previous story item for current user
      setCurrentItemIndex(currentItemIndex - 1)
    } else if (currentStoryIndex > 0) {
      // Move to previous user's last story
      goToPrevUser()
    }
  }, [currentItemIndex, currentStoryIndex, setCurrentItemIndex, goToPrevUser])

  // Video end detection - auto-advance when video finishes
  useEffect(() => {
    if (!isVideo || !player || videoDuration === 0) return
    
    // Check if video has ended (within 0.3s of end)
    if (videoCurrentTime >= videoDuration - 0.3 && !isPaused.current) {
      handleNext()
    }
  }, [isVideo, player, videoCurrentTime, videoDuration, handleNext])

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center", paddingTop: insets.top }}>
        <Text style={{ color: "#fff" }}>Loading story...</Text>
      </View>
    )
  }

  if (!story || !currentItem) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center", paddingTop: insets.top }}>
        <Text style={{ color: "#fff" }}>Story not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20, padding: 12, backgroundColor: "#333", borderRadius: 8 }}>
          <Text style={{ color: "#fff" }}>Go Back</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top }}>
      {/* Progress bars */}
      <View style={{ flexDirection: "row", paddingHorizontal: 8, paddingTop: 8, gap: 4 }}>
          {story.items?.map((_, index) => (
            <View
              key={index}
              style={{
                flex: 1,
                height: 2,
                backgroundColor: "rgba(255,255,255,0.6)",
                borderRadius: 1,
                overflow: "hidden",
              }}
            >
              {index < currentItemIndex ? (
                <View style={{ flex: 1, backgroundColor: "#fff" }} />
              ) : index === currentItemIndex ? (
                <ProgressBar progress={progress} />
              ) : null}
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Image source={{ uri: story.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
            <View>
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>{story.username}</Text>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>{currentItem.header?.subheading}</Text>
            </View>
          </View>
          <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
            <X size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Content */}
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          {isVideo && videoUrl && player ? (
            <View style={{ width, height: height * 0.7 }}>
              <VideoView
                player={player}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
                nativeControls={false}
              />
              <VideoSeekBar
                currentTime={videoCurrentTime}
                duration={videoDuration}
                onSeek={handleSeek}
                visible={showSeekBar}
                barWidth={width - 32}
              />
            </View>
          ) : isImage && currentItem?.url ? (
            <Image
              source={{ uri: currentItem.url }}
              style={{ width, height: height * 0.7 }}
              contentFit="contain"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : currentItem?.type === "text" ? (
            <View
              style={{
                width,
                height: height * 0.7,
                justifyContent: "center",
                alignItems: "center",
                padding: 20,
              }}
            >
              <Text
                style={{
                  color: currentItem.textColor || "#fff",
                  fontSize: 32,
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                {currentItem.text}
              </Text>
            </View>
          ) : (
            <View style={{ width, height: height * 0.7, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: "#fff" }}>No content available</Text>
            </View>
          )}
        </View>

      {/* Touch areas for navigation - full screen overlay */}
      <View style={{ position: "absolute", top: 100, bottom: 0, left: 0, right: 0, flexDirection: "row" }} pointerEvents="box-none">
        {/* Left tap area - previous */}
        <Pressable 
          onPress={handlePrev} 
          style={{ flex: 1 }} 
        />
        {/* Right tap area - next */}
        <Pressable 
          onPress={handleNext} 
          style={{ flex: 1 }} 
        />
      </View>
    </View>
  )
}
