import { View, Text, Pressable, Dimensions } from "react-native"
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router"
import { Image } from "expo-image"
import { VideoView, useVideoPlayer } from "expo-video"
import { X, ChevronLeft, ChevronRight } from "lucide-react-native"
import { useEffect, useCallback, useRef, useState } from "react"
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, SharedValue } from "react-native-reanimated"
import { storiesData } from "@/lib/constants"
import { SafeAreaView } from "react-native-safe-area-context"
import { useStoryViewerStore } from "@/lib/stores/comments-store"
import { VideoSeekBar } from "@/components/video-seek-bar"

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
  const progress = useSharedValue(0)
  const [showSeekBar, setShowSeekBar] = useState(false)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPaused = useRef(false)

  useEffect(() => {
    if (id && currentStoryId !== id) {
      setCurrentStoryId(id)
    }
  }, [id, currentStoryId, setCurrentStoryId])

  // Filter stories that have content (exclude "your-story" if empty)
  const availableStories = storiesData.filter((s) => s.stories.length > 0)
  const currentStoryIndex = availableStories.findIndex((s) => s.id === currentStoryId)
  const story = availableStories[currentStoryIndex]
  const currentItem = story?.stories[currentItemIndex]

  const hasNextUser = currentStoryIndex < availableStories.length - 1
  const hasPrevUser = currentStoryIndex > 0

  const isVideo = currentItem?.type === "video"

  const player = useVideoPlayer(isVideo ? currentItem?.url : "", (player) => {
    player.loop = false
    player.play()
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
    if (!currentItem) return

    // Reset progress for new item
    progress.value = 0
    
    const duration = currentItem.duration || 5000
    
    // Animate progress bar
    progress.value = withTiming(1, { duration }, (finished) => {
      if (finished) {
        runOnJS(handleNext)()
      }
    })

    return () => {
      progress.value = 0
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItemIndex])

  const handleNext = () => {
    if (!story) return

    if (currentItemIndex < story.stories.length - 1) {
      // Next story item for current user
      setCurrentItemIndex(currentItemIndex + 1)
    } else if (hasNextUser) {
      // Move to next user's stories
      goToNextUser()
    } else {
      // No more stories, exit
      router.back()
    }
  }

  const handlePrev = () => {
    if (currentItemIndex > 0) {
      // Previous story item for current user
      setCurrentItemIndex(currentItemIndex - 1)
    } else if (hasPrevUser) {
      // Move to previous user's last story
      goToPrevUser()
    }
  }

  const goToNextUser = () => {
    if (hasNextUser) {
      const nextStory = availableStories[currentStoryIndex + 1]
      setCurrentStoryId(nextStory.id)
      setCurrentItemIndex(0)
      progress.value = 0
    }
  }

  const goToPrevUser = () => {
    if (hasPrevUser) {
      const prevStory = availableStories[currentStoryIndex - 1]
      setCurrentStoryId(prevStory.id)
      setCurrentItemIndex(prevStory.stories.length - 1)
      progress.value = 0
    }
  }

  if (!story || !currentItem) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#fff" }}>Story not found</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Progress bars */}
        <View style={{ flexDirection: "row", paddingHorizontal: 8, paddingTop: 8, gap: 4 }}>
          {story.stories.map((_, index) => (
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
          {isVideo ? (
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
          ) : (
            <Image
              source={{ uri: currentItem.url }}
              style={{ width, height: height * 0.7 }}
              contentFit="contain"
            />
          )}
        </View>

        {/* Touch areas for navigation */}
        <View style={{ position: "absolute", top: 100, bottom: 0, left: 0, right: 0, flexDirection: "row" }}>
          <Pressable 
            onPress={handlePrev} 
            onPressIn={handleLongPressStart}
            onPressOut={handleLongPressEnd}
            style={{ flex: 1 }} 
          />
          <Pressable 
            onPress={handleNext} 
            onPressIn={handleLongPressStart}
            onPressOut={handleLongPressEnd}
            style={{ flex: 1 }} 
          />
        </View>

        {/* Arrow buttons for user navigation */}
        {hasPrevUser && (
          <Pressable
            onPress={goToPrevUser}
            style={{
              position: "absolute",
              left: 8,
              top: "50%",
              marginTop: -20,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.2)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <ChevronLeft size={24} color="#fff" />
          </Pressable>
        )}
        {hasNextUser && (
          <Pressable
            onPress={goToNextUser}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              marginTop: -20,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.2)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <ChevronRight size={24} color="#fff" />
          </Pressable>
        )}
      </SafeAreaView>
    </View>
  )
}
