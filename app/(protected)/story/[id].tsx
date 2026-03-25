import {
  View,
  Text,
  TextInput,
  Pressable,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  KeyboardController,
  KeyboardProvider,
  KeyboardAvoidingView,
} from "react-native-keyboard-controller";
import { Animated as RNAnimated, Easing } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { X, Send, Eye, Heart, Trash2 } from "lucide-react-native";
import { DVNTLiquidGlass } from "@/components/media/DVNTLiquidGlass";
import * as Haptics from "expo-haptics";
import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { useQueryClient } from "@tanstack/react-query";
import { screenPrefetch } from "@/lib/prefetch";
import { getOrCreateConversationCached } from "@/lib/hooks/use-conversation-resolution";
import { Debouncer } from "@tanstack/react-pacer";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { SharedValue } from "react-native-reanimated";
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
import { useStoryViewerStore } from "@/lib/stores/comments-store";
import { VideoSeekBar } from "@/components/video-seek-bar";
import {
  useStories,
  useStoryViewerCount,
  useRecordStoryView,
  useDeleteStory,
} from "@/lib/hooks/use-stories";
import { StoryViewersSheet } from "@/components/stories/story-viewers-sheet";
import { useAuthStore } from "@/lib/stores/auth-store";
import { messagesApiClient } from "@/lib/api/messages";
import { useUIStore } from "@/lib/stores/ui-store";
import { useStoryViewerScreenStore } from "@/lib/stores/story-viewer-screen-store";
import { normalizeRouteParams } from "@/lib/navigation/route-params";
import {
  loopDetection,
  useRenderLoopDetector,
} from "@/lib/diagnostics/loop-detection";
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

function StoryViewerScreenContent() {
  // DEV-only loop detection
  useRenderLoopDetector("StoryViewer");

  const rawParams = useLocalSearchParams<{
    id: string;
    username?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  // FIX: Normalize params once to prevent string|string[] instability loops
  const normalizedParams = useMemo(
    () => normalizeRouteParams(rawParams),
    [rawParams.id, rawParams.username],
  );
  const id = normalizedParams.id;
  const usernameParam = normalizedParams.username;

  loopDetection.log("StoryViewer", "mount", { id, username: usernameParam });
  const {
    currentStoryId,
    currentItemIndex,
    setCurrentStoryId,
    setCurrentItemIndex,
  } = useStoryViewerStore();
  const insets = useSafeAreaInsets();

  const progress = useSharedValue(0);

  // FIX: Replace useState with Zustand to comply with project mandate
  const {
    showSeekBar,
    setShowSeekBar,
    videoCurrentTime,
    setVideoCurrentTime,
    videoDuration,
    setVideoDuration,
    replyText,
    setReplyText,
    isSendingReply,
    setIsSendingReply,
    isInputFocused,
    setIsInputFocused,
    resolvedUserId,
    setResolvedUserId,
    storyTags,
    setStoryTags,
    showTags,
    setShowTags,
    floatingEmojis,
    addFloatingEmoji,
    removeFloatingEmoji,
    resetStoryViewerScreen,
  } = useStoryViewerScreenStore();

  const emojiCounter = useRef(0);

  const REACTION_EMOJIS = ["❤️", "🔥", "😂", "😍", "👏", "😮", "😈"];
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
  const { data: storiesData = [], isLoading, isFetching } = useStories();

  useEffect(() => {
    if (id) {
      setCurrentStoryId(id);
    }
    // Only sync from URL param on mount / route change.
    // Do NOT include currentStoryId — internal navigation (goToNextUser)
    // updates it and must not be overwritten by this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, setCurrentStoryId]);

  // Filter stories that have content
  const availableStories = storiesData.filter(
    (s) => s.items && s.items.length > 0,
  );
  // Use loose equality to handle string/number comparison (URL params are strings, API IDs may be numbers)
  let currentStoryIndex = availableStories.findIndex(
    (s) => String(s.id) === String(currentStoryId),
  );

  // Fallback: if storyId didn't match (e.g. stale ID from chat story-reply metadata),
  // try finding by username param. Group IDs change when new stories are posted.
  const fallbackUsername =
    usernameParam ||
    (String(currentStoryId || id).startsWith("temp-")
      ? currentUser?.username
      : undefined);

  if (currentStoryIndex === -1 && fallbackUsername) {
    currentStoryIndex = availableStories.findIndex(
      (s) => s.username?.toLowerCase() === fallbackUsername.toLowerCase(),
    );
    if (currentStoryIndex !== -1) {
      const found = availableStories[currentStoryIndex];
      console.log(
        `[StoryViewer] ID miss, found by username '${fallbackUsername}' → id=${found.id}`,
      );
      setCurrentStoryId(String(found.id));
    }
  }

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
      .then((tags) => setStoryTags(tags as any))
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

          // Detect video end and auto-advance
          if (
            currentTime >= duration - 0.3 &&
            duration > 0.5 &&
            !hasAdvanced.current &&
            !isPaused.current
          ) {
            callHandleNext();
          }
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [
    isVideo,
    player,
    videoUrl,
    progress,
    isSafeToOperate,
    isMountedRef,
    callHandleNext,
  ]);

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

  // Cleanup player when it changes (e.g. switching between image/video items)
  // Do NOT call markExiting() here — that would poison isSafeToOperate() when
  // switching items within the same user's stories (currentStoryId unchanged).
  useEffect(() => {
    return () => {
      cancelAnimation(progress);
      cleanupPlayer(player, "StoryViewer");
    };
  }, [player, progress]);

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
            scheduleOnRN(callHandleNext);
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
      // Cancel running animation before switching to prevent stale callbacks
      cancelAnimation(progress);
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
    cancelAnimation,
  ]);

  const goToPrevUser = useCallback(() => {
    if (currentStoryIndex > 0) {
      const prevStory = availableStories[currentStoryIndex - 1];
      const prevStoryItemsCount = prevStory?.items?.length || 0;
      // Cancel running animation before switching to prevent stale callbacks
      cancelAnimation(progress);
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
    cancelAnimation,
  ]);

  // Check if viewing own story (don't show reply input for own story)
  // Compare by username (case-insensitive) since IDs may not match between auth systems
  const isOwnStory =
    story?.username?.toLowerCase() === currentUser?.username?.toLowerCase();

  // FIX: Replace useState with Zustand
  const { showViewersSheet, setShowViewersSheet } = useStoryViewerScreenStore();
  const currentItemId = currentItem?.id;
  // story_views.story_id points to the concrete stories row for the
  // currently visible item, not the grouped author-level story id.
  const viewableStoryId = currentItemId ? String(currentItemId) : undefined;
  const { data: viewerCount = 0 } = useStoryViewerCount(
    isOwnStory ? viewableStoryId : undefined,
  );

  // Delete story mutation
  const deleteStoryMutation = useDeleteStory();

  const handleDeleteStory = useCallback(() => {
    if (!viewableStoryId) return;
    isPaused.current = true;
    cancelAnimation(progress);
    try {
      player?.pause();
    } catch {}

    Alert.alert(
      "Delete Story",
      "This story will be permanently deleted. This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            isPaused.current = false;
            if (isSafeToOperate()) {
              safePlay(player, isMountedRef, "StoryViewer");
            }
          },
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteStoryMutation.mutate(viewableStoryId, {
              onSuccess: () => {
                showToast("success", "Deleted", "Story deleted");
                markExiting();
                if (router.canDismiss()) {
                  router.dismiss();
                } else {
                  router.back();
                }
              },
              onError: (err: any) => {
                showToast(
                  "error",
                  "Error",
                  err?.message || "Failed to delete story",
                );
                isPaused.current = false;
              },
            });
          },
        },
      ],
    );
  }, [
    viewableStoryId,
    player,
    progress,
    cancelAnimation,
    isSafeToOperate,
    isMountedRef,
    markExiting,
    router,
    deleteStoryMutation,
    showToast,
  ]);

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

    if (!viewableStoryId || isOwnStory) return;
    if (recordedViewsRef.current.has(viewableStoryId)) {
      if (__DEV__) {
        console.log(
          `[StoryViewer] View already recorded for story ${viewableStoryId}, skipping`,
        );
      }
      return;
    }

    // Debounce: wait 500ms before recording to ensure user actually viewed the story
    const capturedId = viewableStoryId;
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
  }, [viewableStoryId, isOwnStory]);

  const handleNext = useCallback(() => {
    if (!story || !story.items) return;
    if (!isSafeToOperate()) return; // Prevent multiple calls
    if (showViewersSheet) return; // Don't advance while viewers sheet is open

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
    showViewersSheet,
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

  // Refs for latest values — avoids stale closures in the debouncer callback
  const storyRef = useRef(story);
  const currentItemIndexRef = useRef(currentItemIndex);
  const resolvedUserIdRef = useRef(resolvedUserId);
  storyRef.current = story;
  currentItemIndexRef.current = currentItemIndex;
  resolvedUserIdRef.current = resolvedUserId;

  // Send story emoji reaction as DM — debounced via TanStack Debouncer
  const reactionDebouncer = useRef(
    new Debouncer(
      async (emoji: string) => {
        try {
          const userId = resolvedUserIdRef.current;
          const s = storyRef.current;
          const idx = currentItemIndexRef.current;
          if (!userId || !s) return;

          // Use cached conversation resolution
          const conversationId = await getOrCreateConversationCached(
            queryClient,
            userId,
          );
          if (!conversationId) return;

          const item = s.items?.[idx];
          const previewUrl =
            item?.type === "video"
              ? item?.thumbnail || item?.url || ""
              : item?.url || "";

          await messagesApiClient.sendMessage({
            conversationId,
            content: emoji,
            metadata: {
              type: "story_reaction",
              storyId: s.id || "",
              storyMediaUrl: previewUrl,
              storyUsername: s.username || "",
              storyAvatar: s.avatar || "",
              reactionEmoji: emoji,
              storyExpiresAt: new Date(
                Date.now() + 24 * 60 * 60 * 1000,
              ).toISOString(),
            },
          });

          console.log("[StoryViewer] Reaction sent:", emoji);
        } catch (error: any) {
          console.error(
            "[StoryViewer] Reaction error:",
            error?.message || error,
          );
        }
      },
      { wait: 1500 },
    ),
  ).current;

  const handleQuickReaction = useCallback(
    (emoji: string) => {
      loopDetection.log("StoryViewer", "reaction:quick", { emoji });
      if (!story || !resolvedUserId || isOwnStory) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const id = emojiCounter.current++;
      addFloatingEmoji({ id, emoji });
      reactionDebouncer.maybeExecute(emoji);
    },
    [story, resolvedUserId, isOwnStory, reactionDebouncer, addFloatingEmoji],
  );

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
    KeyboardController.dismiss();

    try {
      console.log("[StoryViewer] Sending reply to userId:", resolvedUserId);
      // Get or create conversation with story owner (cached)
      const conversationId = await getOrCreateConversationCached(
        queryClient,
        resolvedUserId,
      );

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
        }}
      >
        <Text style={{ color: "#fff" }}>Loading story...</Text>
      </View>
    );
  }

  if ((!story || !currentItem) && (isLoading || isFetching)) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
        }}
      >
        <ActivityIndicator color="#fff" />
        <Text style={{ color: "rgba(255,255,255,0.72)" }}>
          Finding story...
        </Text>
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
        }}
      >
        <Text style={{ color: "#fff" }}>Story not found</Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 20,
            paddingHorizontal: 20,
            paddingVertical: 10,
            backgroundColor: "rgba(255,255,255,0.15)",
            borderRadius: 20,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1, backgroundColor: "#000" }}
      >
        <View style={{ flex: 1 }}>
          {/* ── FULL-BLEED MEDIA ───────────────────────────────────────────── */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            {isVideo && videoUrl && player ? (
              <>
                {currentItem?.thumbnail ? (
                  <Image
                    source={{ uri: currentItem.thumbnail }}
                    style={{
                      position: "absolute",
                      width: "100%",
                      height: "100%",
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
              </>
            ) : isImage &&
              currentItem?.url &&
              (currentItem.url.startsWith("http://") ||
                currentItem.url.startsWith("https://")) ? (
              <Image
                source={{ uri: currentItem.url }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={150}
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
                    fontSize: 36,
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
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
                  No content
                </Text>
              </View>
            )}

            {/* Subtle top vignette for readability */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: isImage ? 112 : 180,
                opacity: isImage ? 0.14 : 0.3,
                backgroundColor: "rgba(0,0,0,0.3)",
              }}
            />
          </View>

          {/* ── TOP OVERLAY: progress bars + header ───────────────────────── */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 50,
            }}
            pointerEvents="box-none"
          >
            {/* Progress bars */}
            <View
              style={{
                flexDirection: "row",
                paddingHorizontal: 10,
                paddingTop: isOwnStory ? insets.top + 10 : 22,
                gap: 3,
              }}
            >
              {story.items?.map((_: any, index: number) => (
                <View
                  key={index}
                  style={{
                    flex: 1,
                    height: 2.5,
                    backgroundColor: "rgba(255,255,255,0.35)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  {index < currentItemIndex ? (
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: "rgba(255,255,255,0.92)",
                      }}
                    />
                  ) : index === currentItemIndex ? (
                    <ProgressBar progress={progress} />
                  ) : null}
                </View>
              ))}
            </View>

            {/* Header row: avatar + name | X */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 14,
                paddingTop: 10,
                paddingBottom: 6,
              }}
              pointerEvents="box-none"
            >
              <Pressable
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  flex: 1,
                }}
                onPress={() => {
                  if (!story?.username) return;
                  isPaused.current = true;
                  cancelAnimation(progress);
                  try {
                    player?.pause();
                  } catch {}
                  if (
                    story.username.toLowerCase() ===
                    currentUser?.username?.toLowerCase()
                  ) {
                    router.push("/(protected)/(tabs)/profile");
                  } else {
                    screenPrefetch.profile(queryClient, story.username);
                    router.push(`/(protected)/profile/${story.username}`);
                  }
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Image
                  source={{ uri: story.avatar }}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: "rgba(255,255,255,0.4)",
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "700",
                      fontSize: 14,
                      textShadowColor: "rgba(0,0,0,0.9)",
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 6,
                    }}
                    numberOfLines={1}
                  >
                    {story.username}
                  </Text>
                  {(currentItem as any).header?.subheading ? (
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.75)",
                        fontSize: 12,
                        textShadowColor: "rgba(0,0,0,0.4)",
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 3,
                      }}
                      numberOfLines={1}
                    >
                      {(currentItem as any).header?.subheading}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (isExitingRef.current) return;
                  markExiting();
                  cancelAnimation(progress);
                  if (router.canDismiss()) {
                    router.dismiss();
                  } else {
                    router.back();
                  }
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  backgroundColor: "rgba(30,30,30,0.55)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                <X size={18} color="#fff" strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>

          {/* ── TOUCH ZONES (prev / next) ─────────────────────────────────── */}
          <View
            style={{
              position: "absolute",
              top: insets.top + 90,
              bottom: isOwnStory ? 0 : 110,
              left: 0,
              right: 0,
              flexDirection: "row",
              zIndex: 20,
            }}
            pointerEvents="box-none"
          >
            <Pressable onPress={handlePrev} style={{ flex: 1 }} />
            <Pressable onPress={handleNext} style={{ flex: 1 }} />
          </View>

          {/* ── TAGGED USERS PILL ─────────────────────────────────────────── */}
          {storyTags.length > 0 && (
            <Pressable
              onPress={() => setShowTags(!showTags)}
              style={{
                position: "absolute",
                bottom: isOwnStory ? insets.bottom + 20 : 130,
                alignSelf: "center",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(0,0,0,0.6)",
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.18)",
                zIndex: 60,
              }}
            >
              {showTags ? (
                <View style={{ gap: 6 }}>
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
                          screenPrefetch.profile(queryClient, tag.username);
                          router.push(`/(protected)/profile/${tag.username}`);
                        }
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Image
                        source={{ uri: (tag as any).avatar || "" }}
                        style={{ width: 22, height: 22, borderRadius: 6 }}
                      />
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: "600",
                        }}
                      >
                        @{tag.username}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <>
                  <Image
                    source={{ uri: (storyTags[0] as any).avatar || "" }}
                    style={{ width: 20, height: 20, borderRadius: 5 }}
                  />
                  <Text
                    style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}
                  >
                    {storyTags.length === 1
                      ? `@${storyTags[0].username}`
                      : `@${storyTags[0].username} +${storyTags.length - 1}`}
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {/* ── OWN STORY: viewer count + delete ──────────────────────────── */}
          {isOwnStory && (
            <>
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
                  bottom: insets.bottom + 20,
                  left: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "rgba(0,0,0,0.55)",
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.18)",
                  zIndex: 60,
                }}
              >
                <Eye size={16} color="#fff" />
                <Text
                  style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}
                >
                  {viewerCount}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleDeleteStory}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{
                  position: "absolute",
                  bottom: insets.bottom + 20,
                  right: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "rgba(0,0,0,0.55)",
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: "rgba(255,90,90,0.3)",
                  zIndex: 60,
                }}
              >
                <Trash2 size={16} color="#FF5555" />
                <Text
                  style={{ color: "#FF5555", fontSize: 13, fontWeight: "700" }}
                >
                  Delete
                </Text>
              </Pressable>
            </>
          )}

          {/* ── STORY VIEWERS SHEET ───────────────────────────────────────── */}
          <StoryViewersSheet
            storyId={viewableStoryId}
            visible={showViewersSheet}
            onClose={() => {
              setShowViewersSheet(false);
              isPaused.current = false;
            }}
          />

          {/* ── FLOATING EMOJI REACTIONS ──────────────────────────────────── */}
          {floatingEmojis.map((e) => (
            <FloatingReactionEmoji
              key={e.id}
              emoji={e.emoji}
              onComplete={() => removeFloatingEmoji(e.id)}
            />
          ))}
        </View>

        {/* ── BOTTOM BAR: normal flow, pushed up by KeyboardAvoidingView ── */}
        {!isOwnStory && story && (
          <View>
            {/* Emoji reactions row — hidden while typing */}
            {!isInputFocused && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  paddingHorizontal: 20,
                  marginBottom: 10,
                }}
              >
                {REACTION_EMOJIS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => handleQuickReaction(emoji)}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      backgroundColor: "rgba(40,40,40,0.7)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.12)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Message input row — liquid glass pill */}
            <View
              style={{
                paddingHorizontal: 12,
                paddingTop: 6,
                paddingBottom: Math.max(insets.bottom, 8),
              }}
            >
              <DVNTLiquidGlass paddingH={6} paddingV={6} radius={28}>
                <TextInput
                  style={{
                    flex: 1,
                    color: "#fff",
                    fontSize: 15,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                  }}
                  placeholder="Send Message"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  value={replyText}
                  onChangeText={setReplyText}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  returnKeyType="send"
                  onSubmitEditing={handleSendReply}
                  editable={!isSendingReply}
                />
                <Pressable
                  onPress={
                    replyText.trim().length > 0 ? handleSendReply : undefined
                  }
                  disabled={isSendingReply || !resolvedUserId}
                  hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor:
                      replyText.trim().length > 0
                        ? "#8A40CF"
                        : "rgba(255,255,255,0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: isSendingReply ? 0.5 : 1,
                  }}
                >
                  <Send size={17} color="#fff" strokeWidth={2} />
                </Pressable>
              </DVNTLiquidGlass>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </KeyboardProvider>
  );
}

// Wrap with ErrorBoundary for crash protection
export default function StoryViewerScreen() {
  const router = useRouter();

  return (
    <ErrorBoundary
      screenName="StoryViewer"
      onGoHome={() => router.replace("/(protected)/(tabs)/feed" as any)}
    >
      <StoryViewerScreenContent />
    </ErrorBoundary>
  );
}
