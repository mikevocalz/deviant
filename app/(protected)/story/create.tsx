import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import {
  X,
  Image as ImageIcon,
  Video,
  Camera,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Type,
  Sticker,
  Sparkles,
  Download,
  Star,
  Globe,
  UserPlus,
  Plus,
  Send,
} from "lucide-react-native";
import {
  useRouter,
  useNavigation,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { Motion } from "@legendapp/motion";
import { useColorScheme } from "@/lib/hooks";
import { useCreateStoryStore } from "@/lib/stores/create-story-store";
import type { MediaAsset } from "@/lib/hooks/use-media-picker";
import { useMediaPicker } from "@/lib/hooks";
import { useCallback, useLayoutEffect, useEffect } from "react";
import { useCreateStory } from "@/lib/hooks/use-stories";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { useUIStore } from "@/lib/stores/ui-store";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StoryTagPicker } from "@/components/stories/story-tag-picker";
import { storyTagsApi } from "@/lib/api/stories";
import { generateVideoThumbnail } from "@/lib/video-thumbnail";
import { useCameraResultStore } from "@/lib/stores/camera-result-store";
import { LinearGradient } from "expo-linear-gradient";

// Creative tools — floating vertical toolbar on canvas
const CREATIVE_TOOLS = [
  { id: "text", icon: Type, label: "Aa" },
  { id: "stickers", icon: Sticker, label: "Stickers" },
  { id: "draw", icon: Pencil, label: "Draw" },
  { id: "effects", icon: Sparkles, label: "Effects" },
  { id: "save", icon: Download, label: "Save" },
] as const;

const MAX_STORY_ITEMS = 4;
const MAX_VIDEO_DURATION = 30;
const MAX_FILE_SIZE_MB = 50;

export default function CreateStoryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { colors } = useColorScheme();

  // ── Responsive layout ─────────────────────────────────────────────
  // On phones: canvas fills entire screen edge-to-edge
  // On tablets/foldables: canvas maxes out at 9:16 ratio, centered
  const isWideScreen = width >= 600; // tablet / foldable threshold
  const maxCanvasW = isWideScreen ? Math.min(width * 0.65, 500) : width;
  const screenH = height;
  // Bottom bar height adapts to safe area
  const BOTTOM_BAR_H = 110 + insets.bottom;

  const {
    selectedMedia,
    mediaTypes,
    setSelectedMedia,
    reset,
    currentIndex,
    setCurrentIndex,
    mediaAssets,
    setMediaAssets,
    nextSlide,
    prevSlide,
    isSharing,
    setIsSharing,
    visibility,
    setVisibility,
    taggedUsers,
    setTaggedUsers,
    showTagPicker,
    setShowTagPicker,
    videoThumbnails,
    setVideoThumbnail,
  } = useCreateStoryStore();

  const { pickStoryMedia, recordStoryVideo, requestPermissions } =
    useMediaPicker();
  const createStory = useCreateStory();
  const showToast = useUIStore((s) => s.showToast);
  const {
    uploadMultiple,
    progress: uploadProgress,
    statusMessage: uploadStatus,
  } = useMediaUpload({ folder: "stories" });

  const consumeCameraResult = useCameraResultStore((s) => s.consumeResult);

  // Pick up edited URI coming back from the Skia editor
  const { editedUri, editedIndex } = useLocalSearchParams<{
    editedUri?: string;
    editedIndex?: string;
  }>();

  useEffect(() => {
    if (editedUri && editedIndex !== undefined) {
      const idx = parseInt(editedIndex, 10);
      if (!isNaN(idx) && mediaAssets[idx]) {
        // Editing existing media — replace in-place
        const updated = [...mediaAssets];
        updated[idx] = { ...updated[idx], uri: editedUri, type: "image" };
        setMediaAssets(updated);
        setSelectedMedia([editedUri], ["image"]);
        console.log("[Story] Applied edited image at index", idx);
      } else if (mediaAssets.length === 0) {
        // Text-only story — canvas snapshot returned with no existing media
        const asset: MediaAsset = {
          id: editedUri,
          uri: editedUri,
          type: "image",
        };
        setMediaAssets([asset]);
        setSelectedMedia([editedUri], ["image"]);
        setCurrentIndex(0);
        console.log("[Story] Applied text-only story snapshot");
      }
    }
  }, [editedUri, editedIndex]);

  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  const handleMediaSelected = useCallback(
    (media: MediaAsset[]) => {
      const currentCount = mediaAssets.length;
      const newItems = media.slice(0, MAX_STORY_ITEMS - currentCount);

      if (media.length > MAX_STORY_ITEMS - currentCount) {
        showToast(
          "warning",
          "Story Limit",
          `You can add up to ${MAX_STORY_ITEMS} items per story.`,
        );
      }

      const validMedia: MediaAsset[] = [];
      const errors: string[] = [];

      for (const item of newItems) {
        if (item.type === "video") {
          if (item.duration && item.duration > MAX_VIDEO_DURATION) {
            errors.push(`Video must be ${MAX_VIDEO_DURATION}s or less`);
            continue;
          }
          const fileSizeMB = item.fileSize ? item.fileSize / (1024 * 1024) : 0;
          if (fileSizeMB > MAX_FILE_SIZE_MB) {
            errors.push(`Video exceeds ${MAX_FILE_SIZE_MB}MB limit`);
            continue;
          }
        }
        validMedia.push(item);
      }

      if (errors.length > 0) {
        showToast(
          "warning",
          "Some videos couldn't be added",
          errors.join(", "),
        );
      }

      if (validMedia.length > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const updatedAssets = [...mediaAssets, ...validMedia];
        setMediaAssets(updatedAssets);
        setSelectedMedia(
          updatedAssets.map((m) => m.uri),
          updatedAssets.map((m) => m.type),
        );
        setCurrentIndex(mediaAssets.length === 0 ? 0 : mediaAssets.length);

        // Generate thumbnails for any new videos
        for (const item of validMedia) {
          if (item.type === "video") {
            generateVideoThumbnail(item.uri, 500).then((result) => {
              if (result.success && result.uri) {
                setVideoThumbnail(item.uri, result.uri!);
              }
            });
          }
        }
      }
    },
    [
      mediaAssets,
      setMediaAssets,
      setSelectedMedia,
      setCurrentIndex,
      setVideoThumbnail,
      showToast,
    ],
  );

  const handlePickLibrary = async () => {
    if (mediaAssets.length >= MAX_STORY_ITEMS) {
      showToast(
        "warning",
        "Story Limit",
        `Maximum ${MAX_STORY_ITEMS} items per story.`,
      );
      return;
    }
    try {
      const media = await pickStoryMedia?.({
        maxDuration: MAX_VIDEO_DURATION,
        maxFileSizeMB: MAX_FILE_SIZE_MB,
      });
      if (media && media.length > 0) {
        handleMediaSelected(media);
      }
    } catch (error) {
      showToast("error", "Error", "Failed to pick media.");
    }
  };

  // Consume camera result when returning from camera screen
  // Auto-open the Skia editor for images so user skips the extra tap
  useFocusEffect(
    useCallback(() => {
      const result = consumeCameraResult();
      if (result) {
        const media: MediaAsset = {
          id: result.uri,
          uri: result.uri,
          type: result.type,
          width: result.width,
          height: result.height,
          duration: result.duration,
        };
        handleMediaSelected([media]);

        // Auto-open editor for images (skip the redundant canvas-tap step)
        if (result.type === "image") {
          setTimeout(() => {
            router.push({
              pathname: "/(protected)/story/editor",
              params: {
                uri: encodeURIComponent(result.uri),
                type: result.type,
              },
            });
          }, 300);
        }
      }
    }, [consumeCameraResult, handleMediaSelected, router]),
  );

  const handleCreateTextStory = () => {
    router.push({
      pathname: "/(protected)/story/editor",
      params: {
        uri: "",
        type: "image",
        initialMode: "text",
      },
    });
  };

  const handleOpenCamera = () => {
    if (mediaAssets.length >= MAX_STORY_ITEMS) {
      showToast(
        "warning",
        "Story Limit",
        `Maximum ${MAX_STORY_ITEMS} items per story.`,
      );
      return;
    }
    router.push({
      pathname: "/(protected)/camera",
      params: {
        mode: "both",
        source: "story",
        maxDuration: String(MAX_VIDEO_DURATION),
      },
    });
  };

  const handleRemoveMedia = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = mediaAssets.filter((_, i) => i !== index);
    setMediaAssets(updated);
    setSelectedMedia(
      updated.map((m) => m.uri),
      updated.map((m) => m.type),
    );
    if (currentIndex >= updated.length && updated.length > 0) {
      setCurrentIndex(updated.length - 1);
    }
  };

  const handleOpenSkiaEditor = useCallback(
    (index: number, initialMode?: string) => {
      const asset = mediaAssets[index];
      if (!asset) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/(protected)/story/editor",
        params: {
          uri: encodeURIComponent(asset.uri),
          type: asset.type,
          ...(initialMode && { initialMode }),
        },
      });
    },
    [mediaAssets, router],
  );

  const handleShare = async () => {
    console.log("[Story] handleShare called", {
      isSharing,
      isPending: createStory.isPending,
      mediaAssetsCount: mediaAssets.length,
    });

    if (isSharing || createStory.isPending) {
      console.log("[Story] handleShare blocked:", {
        isSharing,
        isPending: createStory.isPending,
      });
      return;
    }
    if (mediaAssets.length === 0) {
      showToast("warning", "Empty Story", "Please add media to your story");
      return;
    }

    setIsSharing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const mediaFiles = mediaAssets.map((m) => ({
        uri: m.uri,
        type: m.type as "image" | "video",
      }));
      console.log("[Story] Uploading", mediaFiles.length, "files");

      const uploadResults = await uploadMultiple(mediaFiles);
      console.log(
        "[Story] Upload results:",
        uploadResults.map((r) => ({ success: r.success, error: r.error })),
      );
      const failedUploads = uploadResults.filter((r) => !r.success);

      if (failedUploads.length > 0) {
        console.error("[Story] Upload failures:", failedUploads);
        setIsSharing(false);
        showToast(
          "error",
          "Upload Error",
          failedUploads[0]?.error || "Failed to upload media.",
        );
        return;
      }

      const storyItems = uploadResults.map((r) => ({
        type: r.type,
        url: r.url,
        thumbnail: r.thumbnail,
      }));
      console.log("[Story] Creating story with", storyItems.length, "items");

      createStory.mutate(
        { items: storyItems, visibility },
        {
          onSuccess: (newStory: any) => {
            console.log("[Story] Story created!", newStory?.id);
            if (taggedUsers.length > 0 && newStory?.id) {
              const tags = taggedUsers.map((u) => ({
                userId: u.id,
                x: 0.5,
                y: 0.5,
              }));
              storyTagsApi.addTags(String(newStory.id), tags).catch((err) => {
                console.error("[Story] Failed to save tags:", err);
              });
            }
            setIsSharing(false);
            showToast("success", "Success", "Story shared successfully!");
            reset();
            router.back();
          },
          onError: (error: any) => {
            console.error("[Story] createStory mutation error:", error);
            setIsSharing(false);
            showToast(
              "error",
              "Error",
              error?.message || "Failed to share story.",
            );
          },
        },
      );
    } catch (error: any) {
      console.error("[Story] handleShare error:", error);
      setIsSharing(false);
      showToast("error", "Error", error?.message || "Something went wrong.");
    }
  };

  const handleClose = () => {
    if (selectedMedia.length > 0) {
      Alert.alert("Discard Story?", "You have unsaved changes.", [
        { text: "Keep Editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            reset();
            router.back();
          },
        },
      ]);
    } else {
      router.back();
    }
  };

  const currentMedia = selectedMedia[currentIndex];
  const currentMediaType = mediaTypes[currentIndex];
  const hasMedia = mediaAssets.length > 0;

  // Hide the native header — we render a floating one
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  return (
    <>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {/* ── Full-screen canvas container ─────────────────────────────── */}
        {/* On tablets: centered with max width; On phones: edge-to-edge  */}
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: maxCanvasW,
              height: screenH,
              overflow: "hidden",
              ...(isWideScreen && {
                borderRadius: 24,
                borderCurve: "continuous",
                maxHeight: maxCanvasW * (16 / 9),
              }),
            }}
          >
            {currentMedia ? (
              <View style={{ flex: 1, backgroundColor: "#000" }}>
                {/* ── Media layer ─────────────────────────────────────── */}
                {currentMediaType === "video" ? (
                  <View
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#000",
                    }}
                  >
                    {videoThumbnails[currentMedia] ? (
                      <Image
                        source={{ uri: videoThumbnails[currentMedia] }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    ) : (
                      <Video size={48} color="rgba(255,255,255,0.3)" />
                    )}
                    <View
                      style={{
                        position: "absolute",
                        backgroundColor: "rgba(0,0,0,0.6)",
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 20,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Video size={14} color="#fff" />
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: "600",
                        }}
                      >
                        Video
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ flex: 1 }}>
                    <Image
                      source={{ uri: currentMedia }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                    {/* Tap canvas to open Skia editor */}
                    <Pressable
                      onPress={() => handleOpenSkiaEditor(currentIndex)}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 0,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: "rgba(0,0,0,0.35)",
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 20,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                        pointerEvents="none"
                      >
                        <Pencil size={14} color="rgba(255,255,255,0.8)" />
                        <Text
                          style={{
                            color: "rgba(255,255,255,0.8)",
                            fontSize: 13,
                            fontWeight: "600",
                          }}
                        >
                          Tap to edit
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                )}

                {/* ── Progress bars (multi-slide) ─────────────────────── */}
                {selectedMedia.length > 1 && (
                  <View
                    style={{
                      position: "absolute",
                      top: insets.top + 48,
                      left: 16,
                      right: 16,
                      flexDirection: "row",
                      gap: 4,
                    }}
                  >
                    {selectedMedia.map((_, idx) => (
                      <View
                        key={idx}
                        style={{
                          flex: 1,
                          height: 2.5,
                          borderRadius: 2,
                          backgroundColor:
                            idx === currentIndex
                              ? "#fff"
                              : "rgba(255,255,255,0.3)",
                        }}
                      />
                    ))}
                  </View>
                )}

                {/* ── Nav arrows ──────────────────────────────────────── */}
                {selectedMedia.length > 1 && currentIndex > 0 && (
                  <Pressable
                    onPress={() => {
                      prevSlide();
                      Haptics.selectionAsync();
                    }}
                    style={{
                      position: "absolute",
                      left: 8,
                      top: "50%",
                      marginTop: -18,
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: "rgba(0,0,0,0.4)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ChevronLeft size={20} color="#fff" />
                  </Pressable>
                )}
                {selectedMedia.length > 1 &&
                  currentIndex < selectedMedia.length - 1 && (
                    <Pressable
                      onPress={() => {
                        nextSlide();
                        Haptics.selectionAsync();
                      }}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        marginTop: -18,
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: "rgba(0,0,0,0.4)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ChevronRight size={20} color="#fff" />
                    </Pressable>
                  )}

                {/* ── Multi-slide thumbnail strip ─────────────────────── */}
                {mediaAssets.length > 1 && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: BOTTOM_BAR_H + 8,
                      left: 12,
                      right: 12,
                    }}
                  >
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      {mediaAssets.map((asset, idx) => (
                        <Pressable
                          key={asset.id}
                          onPress={() => {
                            setCurrentIndex(idx);
                            Haptics.selectionAsync();
                          }}
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 10,
                            borderCurve: "continuous",
                            overflow: "hidden",
                            borderWidth: idx === currentIndex ? 2 : 1,
                            borderColor:
                              idx === currentIndex
                                ? "#3EA4E5"
                                : "rgba(255,255,255,0.2)",
                          }}
                        >
                          <Image
                            source={{
                              uri:
                                asset.type === "video" &&
                                videoThumbnails[asset.uri]
                                  ? videoThumbnails[asset.uri]
                                  : asset.uri,
                            }}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="cover"
                          />
                          <Pressable
                            onPress={() => handleRemoveMedia(idx)}
                            hitSlop={12}
                            style={{
                              position: "absolute",
                              top: 2,
                              right: 2,
                              width: 16,
                              height: 16,
                              borderRadius: 8,
                              backgroundColor: "rgba(240,82,82,0.9)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <X size={9} color="#fff" strokeWidth={3} />
                          </Pressable>
                          {asset.type === "video" && (
                            <View
                              style={{
                                position: "absolute",
                                bottom: 2,
                                left: 3,
                              }}
                            >
                              <Video size={10} color="#fff" />
                            </View>
                          )}
                        </Pressable>
                      ))}
                      {mediaAssets.length < MAX_STORY_ITEMS && (
                        <Pressable
                          onPress={handlePickLibrary}
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 10,
                            borderCurve: "continuous",
                            backgroundColor: "rgba(255,255,255,0.08)",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.15)",
                            borderStyle: "dashed",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Plus size={20} color="rgba(255,255,255,0.5)" />
                        </Pressable>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>
            ) : (
              /* ── Empty state (fullscreen) ────────────────────────────── */
              <LinearGradient
                colors={["#111", "#0a0a0a", "#111"]}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 24,
                }}
              >
                <View
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 24,
                    borderWidth: 2,
                    borderColor: "rgba(62,164,229,0.3)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <LinearGradient
                    colors={["#3EA4E5", "#FF6DC1"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Plus size={32} color="#fff" strokeWidth={2.5} />
                  </LinearGradient>
                </View>
                <View style={{ alignItems: "center", gap: 6 }}>
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 20,
                      fontWeight: "700",
                      letterSpacing: -0.3,
                    }}
                  >
                    Create Your Story
                  </Text>
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.45)",
                      fontSize: 14,
                      fontWeight: "500",
                    }}
                  >
                    Add a photo, video, or text to get started
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                  <Pressable
                    onPress={handlePickLibrary}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: "rgba(255,255,255,0.08)",
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      borderRadius: 28,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <ImageIcon size={18} color="#fff" />
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      Gallery
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleOpenCamera}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: "rgba(255,255,255,0.08)",
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      borderRadius: 28,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <Camera size={18} color="#fff" />
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      Camera
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleCreateTextStory}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: "rgba(138,64,207,0.2)",
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      borderRadius: 28,
                      borderWidth: 1,
                      borderColor: "rgba(138,64,207,0.4)",
                    }}
                  >
                    <Type size={18} color="#fff" />
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      Text
                    </Text>
                  </Pressable>
                </View>
              </LinearGradient>
            )}
          </View>
        </View>

        {/* ── Floating top bar ────────────────────────────────────────── */}
        <View
          style={{
            position: "absolute",
            top: insets.top + 8,
            left: isWideScreen ? (width - maxCanvasW) / 2 + 16 : 16,
            right: isWideScreen ? (width - maxCanvasW) / 2 + 16 : 16,
            zIndex: 50,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={handleClose}
            hitSlop={16}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "rgba(0,0,0,0.5)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} color="#fff" strokeWidth={2.5} />
          </Pressable>
          {/* Right side: creative tools when media is present (horizontal on top) */}
          {hasMedia && currentMediaType !== "video" && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {CREATIVE_TOOLS.filter((t) => t.id !== "save").map((tool) => (
                <Pressable
                  key={tool.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const modeMap: Record<string, string> = {
                      text: "text",
                      stickers: "sticker",
                      draw: "drawing",
                      effects: "filter",
                    };
                    handleOpenSkiaEditor(currentIndex, modeMap[tool.id]);
                  }}
                  hitSlop={8}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <tool.icon size={18} color="#fff" strokeWidth={2} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ── Upload progress overlay ─────────────────────────────────── */}
        {isSharing && (
          <View
            style={{
              position: "absolute",
              top: insets.top + 56,
              left: isWideScreen ? (width - maxCanvasW) / 2 + 24 : 24,
              right: isWideScreen ? (width - maxCanvasW) / 2 + 24 : 24,
              zIndex: 60,
              backgroundColor: "rgba(0,0,0,0.85)",
              borderRadius: 16,
              borderCurve: "continuous",
              padding: 16,
            }}
          >
            <View
              style={{
                height: 4,
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <Motion.View
                initial={{ width: "0%" }}
                animate={{ width: `${uploadProgress}%` }}
                style={{ height: "100%", borderRadius: 2 }}
              >
                <LinearGradient
                  colors={["#3EA4E5", "#FF6DC1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1 }}
                />
              </Motion.View>
            </View>
            <Text
              style={{
                color: "#fff",
                fontSize: 13,
                fontWeight: "600",
                textAlign: "center",
                marginTop: 10,
              }}
            >
              {uploadStatus ||
                (uploadProgress < 100
                  ? `Uploading... ${uploadProgress}%`
                  : "Processing...")}
            </Text>
          </View>
        )}

        {/* ── Bottom bar: Facebook-style horizontal toolbar ───────────── */}
        {hasMedia && (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: isWideScreen ? (width - maxCanvasW) / 2 : 0,
              right: isWideScreen ? (width - maxCanvasW) / 2 : 0,
              paddingBottom: insets.bottom + 8,
              paddingTop: 12,
              paddingHorizontal: 16,
              zIndex: 40,
            }}
          >
            {/* Row 1: Facebook-style horizontal tool icons */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: isWideScreen ? 20 : 4,
                paddingHorizontal: 4,
                justifyContent: "center",
                flexGrow: 1,
              }}
              style={{ marginBottom: 14 }}
            >
              <Pressable
                onPress={handlePickLibrary}
                disabled={mediaAssets.length >= MAX_STORY_ITEMS || isSharing}
                style={{
                  alignItems: "center",
                  gap: 4,
                  opacity:
                    mediaAssets.length >= MAX_STORY_ITEMS || isSharing
                      ? 0.35
                      : 1,
                  minWidth: 56,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ImageIcon size={20} color="#fff" />
                </View>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 11,
                    fontWeight: "600",
                  }}
                >
                  Gallery
                </Text>
              </Pressable>

              <Pressable
                onPress={handleOpenCamera}
                disabled={mediaAssets.length >= MAX_STORY_ITEMS || isSharing}
                style={{
                  alignItems: "center",
                  gap: 4,
                  opacity:
                    mediaAssets.length >= MAX_STORY_ITEMS || isSharing
                      ? 0.35
                      : 1,
                  minWidth: 56,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Camera size={20} color="#fff" />
                </View>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 11,
                    fontWeight: "600",
                  }}
                >
                  Camera
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowTagPicker(true);
                }}
                style={{ alignItems: "center", gap: 4, minWidth: 56 }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor:
                      taggedUsers.length > 0
                        ? "rgba(62,164,229,0.2)"
                        : "rgba(255,255,255,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <UserPlus
                    size={20}
                    color={taggedUsers.length > 0 ? "#3EA4E5" : "#fff"}
                  />
                </View>
                <Text
                  style={{
                    color:
                      taggedUsers.length > 0
                        ? "#3EA4E5"
                        : "rgba(255,255,255,0.7)",
                    fontSize: 11,
                    fontWeight: "600",
                  }}
                >
                  {taggedUsers.length > 0
                    ? `${taggedUsers.length} Tag`
                    : "Mention"}
                </Text>
              </Pressable>

              {/* Save to gallery */}
              <Pressable
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const asset = mediaAssets[currentIndex];
                  if (!asset) return;
                  try {
                    const MediaLibrary = require("expo-media-library");
                    const { status } =
                      await MediaLibrary.requestPermissionsAsync();
                    if (status !== "granted") {
                      showToast(
                        "warning",
                        "Permission",
                        "Media library permission is required to save.",
                      );
                      return;
                    }
                    await MediaLibrary.saveToLibraryAsync(asset.uri);
                    showToast("success", "Saved", "Image saved to gallery");
                  } catch (err) {
                    console.error("[Story] Save to gallery failed:", err);
                    showToast("error", "Error", "Failed to save image.");
                  }
                }}
                style={{ alignItems: "center", gap: 4, minWidth: 56 }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Download size={20} color="#fff" />
                </View>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 11,
                    fontWeight: "600",
                  }}
                >
                  Save
                </Text>
              </Pressable>
            </ScrollView>

            {/* Row 2: Visibility + Share */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              {/* Visibility toggle pill */}
              <Pressable
                onPress={() => {
                  setVisibility(
                    visibility === "public" ? "close_friends" : "public",
                  );
                  Haptics.selectionAsync();
                }}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor:
                    visibility === "close_friends"
                      ? "rgba(252,37,58,0.15)"
                      : "rgba(255,255,255,0.08)",
                  borderWidth: 1,
                  borderColor:
                    visibility === "close_friends"
                      ? "rgba(252,37,58,0.4)"
                      : "rgba(255,255,255,0.1)",
                }}
              >
                {visibility === "public" ? (
                  <Globe size={16} color="rgba(255,255,255,0.7)" />
                ) : (
                  <Star size={16} color="#FC253A" fill="#FC253A" />
                )}
                <Text
                  style={{
                    color:
                      visibility === "close_friends"
                        ? "#FC253A"
                        : "rgba(255,255,255,0.7)",
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  {visibility === "public" ? "Friends" : "Close Friends"}
                </Text>
              </Pressable>

              {/* Share button */}
              <Pressable
                onPress={handleShare}
                disabled={isSharing}
                style={{
                  opacity: isSharing ? 0.5 : 1,
                }}
              >
                <LinearGradient
                  colors={["#3EA4E5", "#6C63FF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingHorizontal: 32,
                    paddingVertical: 12,
                    borderRadius: 14,
                    minWidth: 120,
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 15,
                      fontWeight: "800",
                    }}
                  >
                    {isSharing ? "Sharing..." : "Share"}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Tag People Picker */}
      <StoryTagPicker
        visible={showTagPicker}
        onClose={() => setShowTagPicker(false)}
        selectedUsers={taggedUsers}
        onUsersChanged={setTaggedUsers}
      />
    </>
  );
}
