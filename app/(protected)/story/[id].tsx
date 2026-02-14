import {
  View,
  Text,
  TextInput,
  Pressable,
  Dimensions,
  Keyboard,
} from "react-native";
import { Animated as RNAnimated, Easing } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { X, Send, Eye, Heart } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  SharedValue,
  cancelAnimation,
} from "react-native-reanimated";
import {
  useVideoLifecycle,
  safePlay,
  safePause,
  safeSeek,
  safeGetCurrentTime,
  safeGetDuration,
  cleanupPlayer,
  logVideoHealth,
} from "@/lib/video-lifecycle";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useStoryViewerStore } from "@/lib/stores/comments-store";
import { VideoSeekBar } from "@/components/video-seek-bar";
import {
  useStories,
  useStoryViewerCount,
  useRecordStoryView,
} from "@/lib/hooks/use-stories";
import { StoryViewersSheet } from "@/components/stories/story-viewers-sheet";
import { useAuthStore } from "@/lib/stores/auth-store";
import { messagesApiClient } from "@/lib/api/messages";
import { useUIStore } from "@/lib/stores/ui-store";
import { usersApi } from "@/lib/api/users";
import { storyTagsApi, type StoryTag } from "@/lib/api/stories";

const { width, height } = Dimensions.get("window");
const LONG_PRESS_DELAY = 300;

function ProgressBar({ progress }: { progress: SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    height: "100%",
    backgroundColor: "#fff",
  }));

  return <Animated.View style={animatedStyle} />;
}

function FloatingReactionEmoji({
  emoji,
  onComplete,
}: {
  emoji: string;
  onComplete: () => void;
}) {
  const translateY = useRef(new RNAnimated.Value(0)).current;
  const opacity = useRef(new RNAnimated.Value(1)).current;
  const scale = useRef(new RNAnimated.Value(0.3)).current;
  const translateX = useRef(
    new RNAnimated.Value((Math.random() - 0.5) * 80),
  ).current;

  useRef(
    RNAnimated.parallel([
      RNAnimated.timing(translateY, {
        toValue: -300 - Math.random() * 100,
        duration: 2200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      RNAnimated.sequence([
        RNAnimated.spring(scale, {
          toValue: 1.3,
          speed: 40,
          bounciness: 12,
          useNativeDriver: true,
        }),
        RNAnimated.timing(scale, {
          toValue: 0.8,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
      RNAnimated.timing(opacity, {
        toValue: 0,
        duration: 2200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(onComplete),
  ).current;

  return (
    <RNAnimated.Text
      style={{
        position: "absolute",
        bottom: 100,
        right: 30,
        fontSize: 36,
        zIndex: 999,
        opacity,
        transform: [{ translateY }, { translateX }, { scale }],
      }}
    >
      {emoji}
    </RNAnimated.Text>
  );
}

export default function StoryViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    currentStoryId,
    currentItemIndex,
    setCurrentStoryId,
    setCurrentItemIndex,
  } = useStoryViewerStore();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const [showSeekBar, setShowSeekBar] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [storyTags, setStoryTags] = useState<StoryTag[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<
    { id: number; emoji: string }[]
  >([]);
  const emojiCounter = useRef(0);

  const REACTION_EMOJIS = ["❤️", "🔥", "😂", "😍", "👏", "😮"];
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPaused = useRef(false);
  const hasAdvanced = useRef(false);
  const handleNextRef = useRef<() => void>(() => {});

  // CRITICAL: Video lifecycle management to prevent crashes
  const {
    isMountedRef,
    isExitingRef,
    markExiting,
    safeTimeout,
    isSafeToOperate,
  } = useVideoLifecycle("StoryViewer", currentStoryId);

  // Auth and utilities
  const { user: currentUser } = useAuthStore();
  const showToast = useUIStore((s) => s.showToast);

  // Fetch real stories from API
  const { data: storiesData = [], isLoading } = useStories();

  useEffect(() => {
    if (id && currentStoryId !== id) {
      setCurrentStoryId(id);
    }
  }, [id, currentStoryId, setCurrentStoryId]);

  // Filter stories that have content
  const availableStories = storiesData.filter(
    (s) => s.items && s.items.length > 0,
  );
  // Use loose equality to handle string/number comparison (URL params are strings, API IDs may be numbers)
  const currentStoryIndex = availableStories.findIndex(
    (s) => String(s.id) === String(currentStoryId),
  );
  const story = availableStories[currentStoryIndex];
  const currentItem = story?.items?.[currentItemIndex];

  // Debug story lookup
  useEffect(() => {
    console.log("[StoryViewer] Story lookup:", {
      urlId: id,
      currentStoryId,
      availableStoriesCount: availableStories.length,
      availableStoryIds: availableStories.map((s) => s.id),
      foundIndex: currentStoryIndex,
      hasStory: !!story,
      hasItems: story?.items?.length || 0,
      userId: story?.userId,
      username: story?.username,
    });
  }, [id, currentStoryId, availableStories.length, currentStoryIndex, story]);

  // If story has username but no userId, look it up
  useEffect(() => {
    if (story?.userId) {
      // Already have userId, use it
      setResolvedUserId(story.userId);
    } else if (story?.username) {
      // No userId but have username, look it up
      console.log(
        "[StoryViewer] Looking up userId for username:",
        story.username,
      );
      usersApi
        .getProfileByUsername(story.username)
        .then((result: any) => {
          if (result?.id) {
            console.log("[StoryViewer] Found userId:", result.id);
            setResolvedUserId(result.id);
          } else {
            console.warn(
              "[StoryViewer] User not found for username:",
              story.username,
            );
            setResolvedUserId(null);
          }
        })
        .catch((error: any) => {
          console.error("[StoryViewer] Error looking up userId:", error);
          setResolvedUserId(null);
        });
    } else {
      setResolvedUserId(null);
    }
  }, [story?.userId, story?.username]);

  // Fetch tags for current story item
  useEffect(() => {
    if (!currentItem?.id) {
      setStoryTags([]);
      return;
    }
    storyTagsApi
      .getTagsForStory(String(currentItem.id))
      .then(setStoryTags)
      .catch(() => setStoryTags([]));
  }, [currentItem?.id]);

  const hasNextUser = currentStoryIndex < availableStories.length - 1;
  const hasPrevUser = currentStoryIndex > 0;

  const isVideo = currentItem?.type === "video";
  const isImage = currentItem?.type === "image";

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
        isValidUrl: currentItem.url
          ? currentItem.url.startsWith("http://") ||
            currentItem.url.startsWith("https://")
          : false,
        isImage,
        isVideo,
      });
    }
  }, [currentItem, isImage, isVideo]);

  const player = useVideoPlayer(videoUrl, (player) => {
    if (player && videoUrl) {
      try {
        player.loop = false;
        player.muted = false;
        // Don't play immediately in callback - wait for VideoView to mount
      } catch (error) {
        console.error("[StoryViewer] Error configuring player:", error);
      }
    }
  });

  // Wrapper function that calls the ref - this ensures we always use the latest handleNext
  const callHandleNext = useCallback(() => {
    handleNextRef.current();
  }, []);

  // Play video when it's ready and VideoView is mounted
  useEffect(() => {
    if (!isVideo || !player || !videoUrl) return;
    if (!isSafeToOperate()) return;
    if (isPaused.current) return;

    // Small delay to ensure VideoView is mounted
    const playTimer = safeTimeout(() => {
      if (isSafeToOperate() && !isPaused.current) {
        logVideoHealth("StoryViewer", "Playing video", {
          videoUrl: videoUrl.slice(0, 50),
        });
        safeSeek(player, isMountedRef, 0, "StoryViewer");
        safePlay(player, isMountedRef, "StoryViewer");
      }
    }, 100);

    return () => clearTimeout(playTimer);
  }, [videoUrl, isVideo, player, isSafeToOperate, safeTimeout, isMountedRef]);

  useEffect(() => {
    if (!isVideo || !player || !videoUrl) return;

    const interval = setInterval(() => {
      if (isSafeToOperate()) {
        const currentTime = safeGetCurrentTime(
          player,
          isMountedRef,
          "StoryViewer",
        );
        const duration = safeGetDuration(player, isMountedRef, "StoryViewer");
        setVideoCurrentTime(currentTime);
        setVideoDuration(duration);

        // Update progress bar based on video playback
        if (duration > 0) {
          const progressValue = Math.min(currentTime / duration, 1);
          progress.value = progressValue;
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isVideo, player, videoUrl, progress, isSafeToOperate, isMountedRef]);

  const handleLongPressStart = useCallback(() => {
    if (!isVideo || !isSafeToOperate()) return;
    longPressTimer.current = setTimeout(() => {
      setShowSeekBar(true);
      isPaused.current = true;
      progress.value = progress.value; // Pause the animation
      safePause(player, isMountedRef, "StoryViewer");
    }, LONG_PRESS_DELAY);
  }, [isVideo, player, progress, isSafeToOperate, isMountedRef]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (showSeekBar && isSafeToOperate()) {
      setShowSeekBar(false);
      isPaused.current = false;
      safePlay(player, isMountedRef, "StoryViewer");
    }
  }, [showSeekBar, player, isSafeToOperate, isMountedRef]);

  const handleSeek = useCallback(
    (time: number) => {
      safeSeek(player, isMountedRef, time, "StoryViewer");
    },
    [player, isMountedRef],
  );

  // Cleanup on unmount or navigation away
  useEffect(() => {
    return () => {
      markExiting();
      cancelAnimation(progress);
      cleanupPlayer(player, "StoryViewer");
    };
  }, [player, progress, markExiting]);

  useFocusEffect(
    useCallback(() => {
      // Play video when screen is focused
      if (
        isVideo &&
        player &&
        videoUrl &&
        isSafeToOperate() &&
        !isPaused.current
      ) {
        const focusTimer = setTimeout(() => {
          if (isSafeToOperate()) {
            safePlay(player, isMountedRef, "StoryViewer");
          }
        }, 150);
        return () => clearTimeout(focusTimer);
      }

      return () => {
        if (isVideo && isSafeToOperate()) {
          safePause(player, isMountedRef, "StoryViewer");
        }
      };
    }, [player, isVideo, videoUrl, isSafeToOperate, isMountedRef]),
  );

  useEffect(() => {
    if (!currentItem || !currentStoryId) return;

    // Don't start animation if already navigating away
    if (!isSafeToOperate()) return;

    // Reset progress for new item
    progress.value = 0;
    hasAdvanced.current = false;

    logVideoHealth("StoryViewer", "Starting animation", {
      currentItemIndex,
      currentStoryId,
      isVideo,
    });

    // For images, use the item duration or default 5 seconds
    // For videos, the video end detection will handle advancement
    const duration = isVideo ? 30000 : currentItem.duration || 5000; // Longer timeout for video as backup

    // Small delay to ensure component is mounted
    const timer = setTimeout(() => {
      // Don't start if already exiting
      if (!isSafeToOperate()) return;

      // Animate progress bar - use callHandleNext which reads from ref to avoid stale closures
      if (!isVideo) {
        // For images, animate progress bar
        progress.value = withTiming(1, { duration }, (finished) => {
          if (
            finished &&
            !hasAdvanced.current &&
            isMountedRef.current &&
            !isExitingRef.current
          ) {
            // Do NOT set hasAdvanced here — handleNext sets it itself.
            // Setting it here would cause handleNext's guard to block the call.
            runOnJS(callHandleNext)();
          }
        });
      } else {
        // For videos, progress bar will be synced with video playback time in the video tracking effect
        // Start at 0, it will update as video plays
        progress.value = 0;
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      cancelAnimation(progress);
      progress.value = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentItemIndex,
    currentStoryId,
    isVideo,
    callHandleNext,
    isSafeToOperate,
    isMountedRef,
    isExitingRef,
  ]);

  const goToNextUser = useCallback(() => {
    if (currentStoryIndex < availableStories.length - 1) {
      const nextStory = availableStories[currentStoryIndex + 1];
      // Update state instead of navigating - this keeps the viewer open
      setCurrentItemIndex(0);
      setCurrentStoryId(String(nextStory.id));
      progress.value = 0;
      hasAdvanced.current = false;
    }
  }, [
    currentStoryIndex,
    availableStories,
    setCurrentItemIndex,
    setCurrentStoryId,
    progress,
  ]);

  const goToPrevUser = useCallback(() => {
    if (currentStoryIndex > 0) {
      const prevStory = availableStories[currentStoryIndex - 1];
      const prevStoryItemsCount = prevStory?.items?.length || 0;
      // Update state instead of navigating - this keeps the viewer open
      setCurrentItemIndex(Math.max(0, prevStoryItemsCount - 1));
      setCurrentStoryId(String(prevStory.id));
      progress.value = 0;
      hasAdvanced.current = false;
    }
  }, [
    currentStoryIndex,
    availableStories,
    setCurrentItemIndex,
    setCurrentStoryId,
    progress,
  ]);

  // Check if viewing own story (don't show reply input for own story)
  // Compare by username (case-insensitive) since IDs may not match between auth systems
  const isOwnStory =
    story?.username?.toLowerCase() === currentUser?.username?.toLowerCase();

  // Story viewers (own stories only)
  const [showViewersSheet, setShowViewersSheet] = useState(false);
  const currentItemId = currentItem?.id;
  // story_views.story_id is an integer FK to stories.id (parent),
  // NOT the hex string item ID from stories_items
  const storyParentId = story?.id ? String(story.id) : undefined;
  const { data: viewerCount = 0 } = useStoryViewerCount(
    isOwnStory ? storyParentId : undefined,
  );

  // Record view when viewing someone else's story (once per story parent).
  // Uses a 500ms debounce to avoid recording flicker-views (e.g. fast swipe past).
  // The Set prevents duplicate calls for the same story within this session.
  const recordView = useRecordStoryView();
  const recordedViewsRef = useRef<Set<string>>(new Set());
  const viewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any pending timer from previous story
    if (viewTimerRef.current) {
      clearTimeout(viewTimerRef.current);
      viewTimerRef.current = null;
    }

    if (!storyParentId || isOwnStory) return;
    if (recordedViewsRef.current.has(storyParentId)) {
      if (__DEV__) {
        console.log(
          `[StoryViewer] View already recorded for story ${storyParentId}, skipping`,
        );
      }
      return;
    }

    // Debounce: wait 500ms before recording to ensure user actually viewed the story
    const capturedId = storyParentId;
    viewTimerRef.current = setTimeout(() => {
      if (__DEV__) {
        console.log(
          `[StoryViewer] Recording view for story ${capturedId} after debounce`,
        );
      }
      recordedViewsRef.current.add(capturedId);
      recordView.mutate(capturedId);
    }, 500);

    return () => {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
        viewTimerRef.current = null;
      }
    };
  }, [storyParentId, isOwnStory]);

  const handleNext = useCallback(() => {
    if (!story || !story.items) return;
    if (!isSafeToOperate()) return; // Prevent multiple calls

    // Prevent double calls - set flag immediately
    if (hasAdvanced.current) {
      logVideoHealth(
        "StoryViewer",
        "Already advanced, ignoring duplicate call",
      );
      return;
    }
    hasAdvanced.current = true;

    logVideoHealth("StoryViewer", "handleNext called", {
      currentItemIndex,
      storyItemsLength: story.items.length,
      currentStoryIndex,
      availableStoriesLength: availableStories.length,
    });

    // Cancel any ongoing animations
    cancelAnimation(progress);

    if (currentItemIndex < story.items.length - 1) {
      // Next story item for current user
      logVideoHealth("StoryViewer", "Moving to next item");
      setCurrentItemIndex(currentItemIndex + 1);
      // Flag will be reset in useEffect when item changes
    } else if (currentStoryIndex < availableStories.length - 1) {
      // Move to next user's stories
      logVideoHealth("StoryViewer", "Moving to next user");
      goToNextUser();
      // Flag will be reset in goToNextUser
    } else {
      // No more stories, exit
      logVideoHealth("StoryViewer", "No more stories, exiting");
      markExiting();
      cancelAnimation(progress);
      router.back();
    }
  }, [
    story,
    currentItemIndex,
    currentStoryIndex,
    availableStories,
    setCurrentItemIndex,
    goToNextUser,
    router,
    progress,
    isSafeToOperate,
    markExiting,
  ]);

  // Keep ref updated with latest handleNext
  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  const handlePrev = useCallback(() => {
    if (currentItemIndex > 0) {
      // Previous story item for current user
      setCurrentItemIndex(currentItemIndex - 1);
    } else if (currentStoryIndex > 0) {
      // Move to previous user's last story
      goToPrevUser();
    }
  }, [currentItemIndex, currentStoryIndex, setCurrentItemIndex, goToPrevUser]);

  // Reset flags when item changes
  useEffect(() => {
    // Small delay to prevent race conditions
    const timer = setTimeout(() => {
      hasAdvanced.current = false;
    }, 100);
    // Don't reset isExiting or hasNavigatedAway here - those are permanent for the session
    return () => clearTimeout(timer);
  }, [currentItemIndex, currentStoryId]);

  // Pause animation when input is focused
  useEffect(() => {
    if (isInputFocused) {
      isPaused.current = true;
      cancelAnimation(progress);
      safePause(player, isMountedRef, "StoryViewer");
    } else {
      isPaused.current = false;
      if (isSafeToOperate()) {
        safePlay(player, isMountedRef, "StoryViewer");
      }
    }
  }, [isInputFocused, player, progress, isMountedRef, isSafeToOperate]);

  // Send story emoji reaction as DM
  const handleStoryReaction = useCallback(
    async (emoji: string) => {
      if (!story || !resolvedUserId || isOwnStory) return;

      // Floating animation + haptic
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const id = emojiCounter.current++;
      setFloatingEmojis((prev) => [...prev, { id, emoji }]);

      try {
        const conversationId =
          await messagesApiClient.getOrCreateConversation(resolvedUserId);
        if (!conversationId) return;

        const currentItem = story.items?.[currentItemIndex];
        const previewUrl =
          currentItem?.type === "video"
            ? currentItem?.thumbnail || currentItem?.url || ""
            : currentItem?.url || "";

        await messagesApiClient.sendMessage({
          conversationId,
          content: emoji,
          metadata: {
            type: "story_reaction",
            storyId: story.id || "",
            storyMediaUrl: previewUrl,
            storyUsername: story.username || "",
            storyAvatar: story.avatar || "",
            reactionEmoji: emoji,
            storyExpiresAt: new Date(
              Date.now() + 24 * 60 * 60 * 1000,
            ).toISOString(),
          },
        });

        console.log("[StoryViewer] Reaction sent:", emoji);
      } catch (error: any) {
        console.error("[StoryViewer] Reaction error:", error?.message || error);
      }
    },
    [story, resolvedUserId, isOwnStory, currentItemIndex],
  );

  const removeFloatingEmoji = useCallback((id: number) => {
    setFloatingEmojis((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Send story reply as DM
  const handleSendReply = useCallback(async () => {
    if (!replyText.trim() || !story || isSendingReply) return;
    if (isOwnStory) {
      showToast("info", "Info", "You can't reply to your own story");
      return;
    }

    if (!resolvedUserId) {
      console.error("[StoryViewer] No resolved userId for story:", story);
      showToast("error", "Error", "Story data incomplete. Cannot send reply.");
      return;
    }

    setIsSendingReply(true);
    Keyboard.dismiss();

    try {
      console.log("[StoryViewer] Sending reply to userId:", resolvedUserId);
      // Get or create conversation with story owner
      const conversationId =
        await messagesApiClient.getOrCreateConversation(resolvedUserId);

      if (!conversationId) {
        console.error("[StoryViewer] Failed to get/create conversation");
        showToast("error", "Error", "Could not start conversation");
        setIsSendingReply(false);
        return;
      }

      // Send reply with story context as metadata for StoryReplyBubble rendering
      const currentItem = story.items?.[currentItemIndex];
      // For video stories, use thumbnail if available for the preview image
      const previewUrl =
        currentItem?.type === "video"
          ? currentItem?.thumbnail || currentItem?.url || ""
          : currentItem?.url || "";
      const message = await messagesApiClient.sendMessage({
        conversationId: conversationId,
        content: replyText.trim(),
        metadata: {
          type: "story_reply",
          storyId: story.id || "",
          storyMediaUrl: previewUrl,
          storyUsername: story.username || "",
          storyAvatar: story.avatar || "",
          // Story expires 24h after creation — pass expiry so chat can show/hide preview
          storyExpiresAt: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      });

      console.log("[StoryViewer] Reply sent successfully");
      showToast("success", "Sent", "Reply sent to their messages");
      setReplyText("");
    } catch (error: any) {
      console.error("[StoryViewer] Reply error:", error?.message || error);
      const errorMsg =
        error?.message || error?.error?.message || "Failed to send reply";
      showToast("error", "Error", errorMsg);
    } finally {
      setIsSendingReply(false);
      setIsInputFocused(false);
    }
  }, [replyText, story, isSendingReply, isOwnStory, showToast, resolvedUserId]);

  // Video end detection - auto-advance when video finishes
  useEffect(() => {
    if (!isVideo || !player || videoDuration === 0) return;
    if (!isSafeToOperate()) return;
    if (isPaused.current) return;
    if (hasAdvanced.current) return; // Already advanced

    // Check if video has ended (within 0.2s of end) and we haven't already advanced
    if (videoCurrentTime >= videoDuration - 0.2 && videoDuration > 0) {
      logVideoHealth("StoryViewer", "Video ended, advancing", {
        videoCurrentTime,
        videoDuration,
      });
      // Set flag to prevent this effect from re-firing on next 100ms tick
      hasAdvanced.current = true;
      // Cancel the progress animation since video ended naturally
      cancelAnimation(progress);
      // Small delay to ensure state is consistent
      safeTimeout(() => {
        // Reset flag right before calling so handleNext's guard doesn't block
        hasAdvanced.current = false;
        callHandleNext();
      }, 50);
    }
  }, [
    isVideo,
    player,
    videoCurrentTime,
    videoDuration,
    callHandleNext,
    progress,
    isSafeToOperate,
    safeTimeout,
  ]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          justifyContent: "center",
          alignItems: "center",
          paddingTop: insets.top,
        }}
      >
        <Text style={{ color: "#fff" }}>Loading story...</Text>
      </View>
    );
  }

  if (!story || !currentItem) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          justifyContent: "center",
          alignItems: "center",
          paddingTop: insets.top,
        }}
      >
        <Text style={{ color: "#fff" }}>Story not found</Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 20,
            padding: 12,
            backgroundColor: "#333",
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "#fff" }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top }}>
      {/* Progress bars */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 8,
          paddingTop: 8,
          gap: 4,
        }}
      >
        {story.items?.map((_: any, index: number) => (
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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 12,
        }}
      >
        <Pressable
          style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
          onPress={() => {
            // Navigate to user profile
            if (!story?.username) return;
            // Pause story and navigate
            isPaused.current = true;
            cancelAnimation(progress);
            try {
              player?.pause();
            } catch {}

            // Check if it's the current user's profile
            if (
              story.username.toLowerCase() ===
              currentUser?.username?.toLowerCase()
            ) {
              router.push("/(protected)/(tabs)/profile");
            } else {
              router.push(`/(protected)/profile/${story.username}`);
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Image
            source={{ uri: story.avatar }}
            style={{ width: 40, height: 40, borderRadius: 20 }}
          />
          <View>
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
              {story.username}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
              {(currentItem as any).header?.subheading}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => {
            if (isExitingRef.current) return; // Prevent multiple presses
            markExiting();
            cancelAnimation(progress);
            router.back();
          }}
          style={{ padding: 12, zIndex: 1000 }}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <X size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Content — full screen behind header */}
      <View style={{ flex: 1 }}>
        {isVideo && videoUrl && player ? (
          <View style={{ flex: 1 }}>
            {currentItem?.thumbnail ? (
              <Image
                source={{ uri: currentItem.thumbnail }}
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  zIndex: 0,
                }}
                contentFit="cover"
              />
            ) : null}
            <VideoView
              player={player}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              nativeControls={false}
              fullscreenOptions={{ enable: false }}
              allowsPictureInPicture={false}
            />
            <VideoSeekBar
              currentTime={videoCurrentTime}
              duration={videoDuration}
              onSeek={handleSeek}
              visible={showSeekBar}
              barWidth={width - 32}
            />
          </View>
        ) : isImage &&
          currentItem?.url &&
          (currentItem.url.startsWith("http://") ||
            currentItem.url.startsWith("https://")) ? (
          <Image
            source={{ uri: currentItem.url }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : currentItem?.type === "text" ? (
          <View
            style={{
              flex: 1,
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
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff" }}>No content available</Text>
          </View>
        )}
      </View>

      {/* Tagged users indicator */}
      {storyTags.length > 0 && (
        <Pressable
          onPress={() => setShowTags((v) => !v)}
          style={{
            position: "absolute",
            bottom: isOwnStory ? 16 : 90,
            alignSelf: "center",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: showTags ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.5)",
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.15)",
            zIndex: 100,
          }}
        >
          {showTags ? (
            <View style={{ gap: 4 }}>
              {storyTags.map((tag) => (
                <Pressable
                  key={tag.id}
                  onPress={() => {
                    isPaused.current = true;
                    cancelAnimation(progress);
                    try {
                      player?.pause();
                    } catch {}
                    if (
                      tag.username.toLowerCase() ===
                      currentUser?.username?.toLowerCase()
                    ) {
                      router.push("/(protected)/(tabs)/profile");
                    } else {
                      router.push(`/(protected)/profile/${tag.username}`);
                    }
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 2,
                  }}
                >
                  <Image
                    source={{
                      uri:
                        tag.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(tag.username)}&background=1a1a1a&color=fff`,
                    }}
                    style={{ width: 22, height: 22, borderRadius: 11 }}
                  />
                  <Text
                    style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}
                  >
                    @{tag.username}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <>
              <Image
                source={{
                  uri:
                    storyTags[0].avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(storyTags[0].username)}&background=1a1a1a&color=fff`,
                }}
                style={{ width: 20, height: 20, borderRadius: 10 }}
              />
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                {storyTags.length === 1
                  ? `@${storyTags[0].username}`
                  : `@${storyTags[0].username} +${storyTags.length - 1}`}
              </Text>
            </>
          )}
        </Pressable>
      )}

      {/* Touch areas for navigation - full screen overlay */}
      <View
        style={{
          position: "absolute",
          top: 100,
          bottom: isOwnStory ? 0 : 80,
          left: 0,
          right: 0,
          flexDirection: "row",
        }}
        pointerEvents="box-none"
      >
        {/* Left tap area - previous */}
        <Pressable onPress={handlePrev} style={{ flex: 1 }} />
        {/* Right tap area - next */}
        <Pressable onPress={handleNext} style={{ flex: 1 }} />
      </View>

      {/* Viewer count — own stories only (Instagram-style bottom-left) */}
      {isOwnStory && (
        <Pressable
          onPress={() => {
            isPaused.current = true;
            cancelAnimation(progress);
            try {
              player?.pause();
            } catch {}
            setShowViewersSheet(true);
          }}
          style={{
            position: "absolute",
            bottom: insets.bottom + 16,
            left: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: "rgba(0,0,0,0.5)",
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.15)",
            zIndex: 100,
          }}
        >
          <Eye size={18} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
            {viewerCount}
          </Text>
        </Pressable>
      )}

      {/* Story Viewers Sheet */}
      <StoryViewersSheet
        storyId={storyParentId}
        visible={showViewersSheet}
        onClose={() => {
          setShowViewersSheet(false);
          isPaused.current = false;
        }}
      />

      {/* Floating emoji reactions */}
      {floatingEmojis.map((e) => (
        <FloatingReactionEmoji
          key={e.id}
          emoji={e.emoji}
          onComplete={() => removeFloatingEmoji(e.id)}
        />
      ))}

      {/* Reply input + reactions - only show for other users' stories */}
      {!isOwnStory && story && resolvedUserId && (
        <KeyboardStickyView
          offset={{ closed: 0, opened: 0 }}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          {/* Emoji reaction row */}
          {!isInputFocused && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                gap: 10,
                marginBottom: 6,
                paddingHorizontal: 16,
              }}
            >
              {REACTION_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => handleStoryReaction(emoji)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View
            style={{
              paddingBottom: insets.bottom + 8,
              paddingTop: 8,
              paddingHorizontal: 16,
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

            {replyText.trim().length > 0 ? (
              <Pressable
                onPress={handleSendReply}
                disabled={isSendingReply}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
            ) : (
              <Pressable
                onPress={() => handleStoryReaction("❤️")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Heart size={20} color="#fff" />
              </Pressable>
            )}
          </View>
        </KeyboardStickyView>
      )}
    </View>
  );
}
