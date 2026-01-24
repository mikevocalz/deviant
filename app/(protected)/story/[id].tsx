
import { View, Text, Pressable, Dimensions, TextInput, Keyboard } from "react-native"
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router"
import { Image } from "expo-image"
import { VideoView, useVideoPlayer } from "expo-video"
import { X, Send } from "lucide-react-native"
import { useEffect, useCallback, useRef, useState, useMemo } from "react"
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, SharedValue, cancelAnimation } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useStoryViewerStore } from "@/lib/stores/comments-store"
import { VideoSeekBar } from "@/components/video-seek-bar"
import { useStories } from "@/lib/hooks/use-stories"
import { useAuthStore } from "@/lib/stores/auth-store"
import { messagesApiClient } from "@/lib/api/messages"
import { useUIStore } from "@/lib/stores/ui-store"

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
  const [replyText, setReplyText] = useState("")
  const [isSendingReply, setIsSendingReply] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPaused = useRef(false)
  const hasAdvanced = useRef(false)
  const isExiting = useRef(false)
  const hasNavigatedAway = useRef(false)
  const handleNextRef = useRef<() => void>(() => {})
  
  // Auth and utilities
  const { user: currentUser } = useAuthStore()
  const showToast = useUIStore((s) => s.showToast)

  // Fetch real stories from API
  const { data: storiesData = [], isLoading } = useStories()

  useEffect(() => {
    if (id && currentStoryId !== id) {
      setCurrentStoryId(id)
    }
  }, [id, currentStoryId, setCurrentStoryId])

  // Filter stories that have content
  const availableStories = storiesData.filter((s) => s.items && s.items.length > 0)
  // Use loose equality to handle string/number comparison (URL params are strings, API IDs may be numbers)
  const currentStoryIndex = availableStories.findIndex((s) => String(s.id) === String(currentStoryId))
  const story = availableStories[currentStoryIndex]
  const currentItem = story?.items?.[currentItemIndex]
  
  // Debug story lookup
  useEffect(() => {
    console.log("[StoryViewer] Story lookup:", {
      urlId: id,
      currentStoryId,
      availableStoriesCount: availableStories.length,
      availableStoryIds: availableStories.map(s => s.id),
      foundIndex: currentStoryIndex,
      hasStory: !!story,
      hasItems: story?.items?.length || 0,
    })
  }, [id, currentStoryId, availableStories.length, currentStoryIndex, story])

  const hasNextUser = currentStoryIndex < availableStories.length - 1
  const hasPrevUser = currentStoryIndex > 0

  const isVideo = currentItem?.type === "video"
  const isImage = currentItem?.type === "image"
  
  // Validate video URL - must be valid HTTP/HTTPS URL
  const videoUrl = useMemo(() => {
    if (isVideo && currentItem?.url) {
      const url = currentItem.url;
      // Only use valid HTTP/HTTPS URLs
      if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
        return url;
      }
    }
    return "";
  }, [isVideo, currentItem?.url]);
  
  // Debug logging for story items
  useEffect(() => {
    if (currentItem) {
      console.log("[StoryViewer] Current item:", {
        type: currentItem.type,
        url: currentItem.url,
        hasUrl: !!currentItem.url,
        isValidUrl: currentItem.url ? (currentItem.url.startsWith("http://") || currentItem.url.startsWith("https://")) : false,
        isImage,
        isVideo,
      });
    }
  }, [currentItem, isImage, isVideo])

  const player = useVideoPlayer(videoUrl, (player) => {
    if (player && videoUrl) {
      try {
        player.loop = false
        player.play()
      } catch (error) {
        console.log("[StoryViewer] Error configuring player:", error);
      }
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

  // Wrapper function that calls the ref - this ensures we always use the latest handleNext
  const callHandleNext = useCallback(() => {
    handleNextRef.current()
  }, [])

  useEffect(() => {
    if (!currentItem || !currentStoryId) return
    
    // Don't start animation if already navigating away
    if (isExiting.current || hasNavigatedAway.current) return

    // Reset progress for new item
    progress.value = 0
    hasAdvanced.current = false
    
    console.log("[StoryViewer] Starting animation for item:", currentItemIndex, "story:", currentStoryId)
    
    // For images, use the item duration or default 5 seconds
    // For videos, the video end detection will handle advancement
    const duration = isVideo ? 30000 : (currentItem.duration || 5000) // Longer timeout for video as backup
    
    // Small delay to ensure component is mounted
    const timer = setTimeout(() => {
      // Don't start if already exiting
      if (isExiting.current || hasNavigatedAway.current) return
      
      // Animate progress bar - use callHandleNext which reads from ref to avoid stale closures
      progress.value = withTiming(1, { duration }, (finished) => {
        if (finished && !hasAdvanced.current && !isExiting.current && !hasNavigatedAway.current) {
          hasAdvanced.current = true
          runOnJS(callHandleNext)()
        }
      })
    }, 50)

    return () => {
      clearTimeout(timer)
      cancelAnimation(progress)
      progress.value = 0
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItemIndex, currentStoryId, isVideo, callHandleNext])

  const goToNextUser = useCallback(() => {
    if (currentStoryIndex < availableStories.length - 1) {
      const nextStory = availableStories[currentStoryIndex + 1]
      // Update state instead of navigating - this keeps the viewer open
      setCurrentItemIndex(0)
      setCurrentStoryId(String(nextStory.id))
      progress.value = 0
      hasAdvanced.current = false
    }
  }, [currentStoryIndex, availableStories, setCurrentItemIndex, setCurrentStoryId, progress])

  const goToPrevUser = useCallback(() => {
    if (currentStoryIndex > 0) {
      const prevStory = availableStories[currentStoryIndex - 1]
      const prevStoryItemsCount = prevStory?.items?.length || 0
      // Update state instead of navigating - this keeps the viewer open
      setCurrentItemIndex(Math.max(0, prevStoryItemsCount - 1))
      setCurrentStoryId(String(prevStory.id))
      progress.value = 0
      hasAdvanced.current = false
    }
  }, [currentStoryIndex, availableStories, setCurrentItemIndex, setCurrentStoryId, progress])

  const handleNext = useCallback(() => {
    if (!story || !story.items) return
    if (isExiting.current || hasNavigatedAway.current) return // Prevent multiple calls

    console.log("[StoryViewer] handleNext called:", {
      currentItemIndex,
      storyItemsLength: story.items.length,
      currentStoryIndex,
      availableStoriesLength: availableStories.length,
    })

    if (currentItemIndex < story.items.length - 1) {
      // Next story item for current user
      console.log("[StoryViewer] Moving to next item")
      hasAdvanced.current = false // Reset for next item
      setCurrentItemIndex(currentItemIndex + 1)
    } else if (currentStoryIndex < availableStories.length - 1) {
      // Move to next user's stories
      console.log("[StoryViewer] Moving to next user")
      goToNextUser()
    } else {
      // No more stories, exit
      console.log("[StoryViewer] No more stories, exiting")
      isExiting.current = true
      hasNavigatedAway.current = true
      cancelAnimation(progress)
      router.back()
    }
  }, [story, currentItemIndex, currentStoryIndex, availableStories, setCurrentItemIndex, goToNextUser, router, progress])

  // Keep ref updated with latest handleNext
  useEffect(() => {
    handleNextRef.current = handleNext
  }, [handleNext])

  const handlePrev = useCallback(() => {
    if (currentItemIndex > 0) {
      // Previous story item for current user
      setCurrentItemIndex(currentItemIndex - 1)
    } else if (currentStoryIndex > 0) {
      // Move to previous user's last story
      goToPrevUser()
    }
  }, [currentItemIndex, currentStoryIndex, setCurrentItemIndex, goToPrevUser])

  // Reset flags when item changes
  useEffect(() => {
    hasAdvanced.current = false
    // Don't reset isExiting or hasNavigatedAway here - those are permanent for the session
  }, [currentItemIndex, currentStoryId])
  
  // Check if viewing own story (don't show reply input for own story)
  // Compare by username (case-insensitive) since IDs may not match between auth systems
  const isOwnStory = story?.username?.toLowerCase() === currentUser?.username?.toLowerCase()
  
  // Pause animation when input is focused
  useEffect(() => {
    if (isInputFocused) {
      isPaused.current = true
      cancelAnimation(progress)
      try {
        player?.pause()
      } catch {}
    } else {
      isPaused.current = false
      try {
        player?.play()
      } catch {}
    }
  }, [isInputFocused, player, progress])
  
  // Send story reply as DM
  const handleSendReply = useCallback(async () => {
    if (!replyText.trim() || !story || isSendingReply) return
    if (isOwnStory) {
      showToast("info", "Info", "You can't reply to your own story")
      return
    }
    
    setIsSendingReply(true)
    Keyboard.dismiss()
    
    try {
      // Get or create conversation with story owner
      const conversation = await messagesApiClient.getOrCreateConversation(story.userId)
      
      if (!conversation) {
        showToast("error", "Error", "Could not start conversation")
        setIsSendingReply(false)
        return
      }
      
      // Send the reply as a message
      const storyReplyPrefix = `📷 Replied to your story: `
      const message = await messagesApiClient.sendMessage({
        conversationId: conversation.id,
        content: `${storyReplyPrefix}${replyText.trim()}`,
      })
      
      if (message) {
        showToast("success", "Sent", "Reply sent to their messages")
        setReplyText("")
      } else {
        showToast("error", "Error", "Failed to send reply")
      }
    } catch (error) {
      console.error("[StoryViewer] Reply error:", error)
      showToast("error", "Error", "Failed to send reply")
    } finally {
      setIsSendingReply(false)
      setIsInputFocused(false)
    }
  }, [replyText, story, isSendingReply, isOwnStory, showToast])

  // Video end detection - auto-advance when video finishes
  useEffect(() => {
    if (!isVideo || !player || videoDuration === 0) return
    
    // Check if video has ended (within 0.3s of end) and we haven't already advanced
    if (videoCurrentTime >= videoDuration - 0.3 && !isPaused.current && !hasAdvanced.current) {
      hasAdvanced.current = true
      callHandleNext()
    }
  }, [isVideo, player, videoCurrentTime, videoDuration, callHandleNext])

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
          ) : isImage && currentItem?.url && (currentItem.url.startsWith("http://") || currentItem.url.startsWith("https://")) ? (
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
      <View style={{ position: "absolute", top: 100, bottom: isOwnStory ? 0 : 60, left: 0, right: 0, flexDirection: "row" }} pointerEvents="box-none">
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
      
      {/* Reply input - only show for other users' stories */}
      {!isOwnStory && story && (
        <View 
          style={{ 
            position: "absolute", 
            bottom: insets.bottom + 8, 
            left: 16, 
            right: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <View 
            style={{ 
              flex: 1, 
              flexDirection: "row", 
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.15)", 
              borderRadius: 24,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.3)",
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <TextInput
              style={{ 
                flex: 1, 
                color: "#fff", 
                fontSize: 14,
                paddingVertical: 4,
              }}
              placeholder={`Reply to ${story.username}...`}
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={replyText}
              onChangeText={setReplyText}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              returnKeyType="send"
              onSubmitEditing={handleSendReply}
              editable={!isSendingReply}
            />
          </View>
          
          {replyText.trim().length > 0 && (
            <Pressable
              onPress={handleSendReply}
              disabled={isSendingReply}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "#8A40CF",
                alignItems: "center",
                justifyContent: "center",
                opacity: isSendingReply ? 0.5 : 1,
              }}
            >
              <Send size={18} color="#fff" />
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}
