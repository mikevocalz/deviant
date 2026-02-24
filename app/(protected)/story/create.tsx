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
  const CANVAS_WIDTH = width - 32;
  const CANVAS_HEIGHT = Math.min(height * 0.55, CANVAS_WIDTH * (16 / 9));

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
    cancelUpload,
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
  const isValid = selectedMedia.length > 0;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: "New Story",
      headerTitleAlign: "left" as const,
      headerStyle: { backgroundColor: colors.background },
      headerTitleStyle: {
        color: colors.foreground,
        fontWeight: "600",
        fontSize: 18,
      },
      headerLeft: () => (
        <Pressable
          onPress={handleClose}
          hitSlop={12}
          className="ml-2 w-11 h-11 items-center justify-center"
        >
          <X size={24} color={colors.foreground} strokeWidth={2.5} />
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          onPress={handleShare}
          disabled={isSharing || !isValid}
          hitSlop={12}
          className="mr-2"
        >
          <Text
            className={`text-sm font-semibold ${isValid && !isSharing ? "text-primary" : "text-muted-foreground"}`}
          >
            {isSharing ? "Sharing..." : "Share"}
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, colors, isValid, isSharing, handleClose, handleShare]);

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ flexGrow: 1 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Upload Progress Overlay */}
        {isSharing && (
          <Motion.View
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-20 left-4 right-4 bg-black/90 rounded-xl p-4 z-50"
            style={{ borderCurve: "continuous" }}
          >
            <View className="h-1.5 bg-muted rounded-full overflow-hidden">
              <Motion.View
                className="h-full bg-primary rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${uploadProgress}%` }}
              />
            </View>
            <Text className="text-white text-sm font-medium text-center mt-3">
              {uploadStatus ||
                (uploadProgress < 100
                  ? `Uploading... ${uploadProgress}%`
                  : "Processing...")}
            </Text>
            <Pressable
              onPress={() => {
                cancelUpload();
                setIsSharing(false);
              }}
              hitSlop={12}
              style={{
                marginTop: 12,
                alignSelf: "center",
                paddingHorizontal: 20,
                paddingVertical: 8,
                borderRadius: 16,
                backgroundColor: "rgba(255,255,255,0.08)",
              }}
            >
              <Text style={{ color: "#999", fontSize: 13, fontWeight: "600" }}>
                Cancel
              </Text>
            </Pressable>
          </Motion.View>
        )}

        {/* Canvas Area */}
        <View className="flex-1 items-center justify-center px-4 py-6">
          <View
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              borderCurve: "continuous",
            }}
            className="rounded-2xl overflow-hidden bg-card"
          >
            {currentMedia ? (
              <View className="flex-1 bg-black">
                {currentMediaType === "video" ? (
                  <View className="flex-1 items-center justify-center bg-black">
                    {videoThumbnails[currentMedia] ? (
                      <Image
                        source={{ uri: videoThumbnails[currentMedia] }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    ) : (
                      <Video size={48} color="#666" />
                    )}
                    <View className="absolute bg-black/60 px-3 py-1.5 rounded-full flex-row items-center gap-1.5">
                      <Video size={16} color="#fff" />
                      <Text className="text-white text-sm">Video</Text>
                    </View>
                  </View>
                ) : (
                  <View className="flex-1">
                    <Image
                      source={{ uri: currentMedia }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                    {/* Tap anywhere to open Skia editor */}
                    <Pressable
                      onPress={() => handleOpenSkiaEditor(currentIndex)}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 0,
                      }}
                    />
                    {/* Creative tools — vertical toolbar on right */}
                    <View
                      className="absolute right-3 top-10 gap-3"
                      style={{ zIndex: 10, elevation: 10 }}
                      pointerEvents="box-none"
                    >
                      {CREATIVE_TOOLS.map((tool) => (
                        <Pressable
                          key={tool.id}
                          onPress={() => {
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Light,
                            );
                            if (tool.id === "save") {
                              (async () => {
                                try {
                                  const MediaLibrary = require("expo-media-library");
                                  const { status } =
                                    await MediaLibrary.requestPermissionsAsync();
                                  if (status !== "granted") {
                                    showToast(
                                      "warning",
                                      "Permission",
                                      "Media library permission required.",
                                    );
                                    return;
                                  }
                                  const asset = mediaAssets[currentIndex];
                                  if (asset) {
                                    await MediaLibrary.saveToLibraryAsync(
                                      asset.uri,
                                    );
                                    showToast(
                                      "success",
                                      "Saved",
                                      "Image saved to gallery",
                                    );
                                  }
                                } catch {
                                  showToast(
                                    "error",
                                    "Error",
                                    "Failed to save image.",
                                  );
                                }
                              })();
                            } else {
                              const modeMap: Record<string, string> = {
                                text: "text",
                                stickers: "sticker",
                                draw: "drawing",
                                effects: "filter",
                              };
                              handleOpenSkiaEditor(
                                currentIndex,
                                modeMap[tool.id],
                              );
                            }
                          }}
                          className="items-center"
                        >
                          <View
                            className="w-10 h-10 rounded-xl bg-black/60 items-center justify-center"
                            style={{ borderCurve: "continuous" }}
                          >
                            <tool.icon size={20} color="#fff" strokeWidth={2} />
                          </View>
                          <Text
                            className="text-white text-[10px] font-medium mt-0.5"
                            style={{
                              textShadowColor: "rgba(0,0,0,0.8)",
                              textShadowOffset: { width: 0, height: 1 },
                              textShadowRadius: 2,
                            }}
                          >
                            {tool.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View className="flex-1 bg-card items-center justify-center">
                <ImageIcon size={48} color="#666" />
                <Text className="text-muted-foreground mt-3 text-base">
                  Add media to get started
                </Text>
              </View>
            )}

            {/* Progress indicators */}
            {selectedMedia.length > 1 && (
              <>
                <View className="absolute top-3 left-3 right-3 flex-row gap-1">
                  {selectedMedia.map((_, idx) => (
                    <View
                      key={idx}
                      className={`flex-1 h-0.5 rounded-full ${idx === currentIndex ? "bg-white" : "bg-white/30"}`}
                    />
                  ))}
                </View>

                {currentIndex > 0 && (
                  <Pressable
                    onPress={() => {
                      prevSlide();
                      Haptics.selectionAsync();
                    }}
                    className="absolute left-2 top-1/2 -mt-5 w-10 h-10 rounded-xl bg-black/50 items-center justify-center"
                  >
                    <ChevronLeft size={24} color="#fff" />
                  </Pressable>
                )}

                {currentIndex < selectedMedia.length - 1 && (
                  <Pressable
                    onPress={() => {
                      nextSlide();
                      Haptics.selectionAsync();
                    }}
                    className="absolute right-2 top-1/2 -mt-5 w-10 h-10 rounded-xl bg-black/50 items-center justify-center"
                  >
                    <ChevronRight size={24} color="#fff" />
                  </Pressable>
                )}
              </>
            )}
          </View>

          {/* Media thumbnails */}
          {mediaAssets.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-4 max-h-16"
              contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
            >
              {mediaAssets.map((asset, idx) => (
                <Pressable
                  key={asset.id}
                  onPress={() => {
                    setCurrentIndex(idx);
                    Haptics.selectionAsync();
                  }}
                  className={`w-14 h-14 rounded-lg overflow-hidden ${idx === currentIndex ? "border-2 border-primary" : ""}`}
                  style={{ borderCurve: "continuous" }}
                >
                  <Image
                    source={{
                      uri:
                        asset.type === "video" && videoThumbnails[asset.uri]
                          ? videoThumbnails[asset.uri]
                          : asset.uri,
                    }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                  <Pressable
                    onPress={() => handleRemoveMedia(idx)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-destructive items-center justify-center"
                    hitSlop={8}
                  >
                    <X size={10} color="#fff" />
                  </Pressable>
                  {asset.type === "video" && (
                    <View className="absolute bottom-0.5 left-0.5">
                      <Video size={12} color="#fff" />
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Action buttons */}
        <View className="px-4 pb-6">
          {/* Visibility toggle */}
          <View className="flex-row justify-center mb-4">
            <Pressable
              onPress={() => {
                setVisibility(
                  visibility === "public" ? "close_friends" : "public",
                );
                Haptics.selectionAsync();
              }}
              className="flex-row items-center gap-2 px-4 py-2 rounded-full"
              style={{
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
                <Globe size={14} color="rgba(255,255,255,0.7)" />
              ) : (
                <Star size={14} color="#FC253A" fill="#FC253A" />
              )}
              <Text
                style={{
                  color:
                    visibility === "close_friends"
                      ? "#FC253A"
                      : "rgba(255,255,255,0.7)",
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                {visibility === "public" ? "Friends" : "Close Friends"}
              </Text>
            </Pressable>
          </View>

          <View className="flex-row justify-center gap-6">
            <Pressable
              onPress={handlePickLibrary}
              disabled={mediaAssets.length >= MAX_STORY_ITEMS || isSharing}
              className={`items-center gap-1 ${mediaAssets.length >= MAX_STORY_ITEMS || isSharing ? "opacity-40" : ""}`}
            >
              <View
                className="w-14 h-14 rounded-xl bg-card items-center justify-center"
                style={{ borderCurve: "continuous" }}
              >
                <ImageIcon size={24} color="#fff" />
              </View>
              <Text className="text-muted-foreground text-xs">
                Gallery{" "}
                {mediaAssets.length > 0
                  ? `(${mediaAssets.length}/${MAX_STORY_ITEMS})`
                  : ""}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleOpenCamera}
              disabled={mediaAssets.length >= MAX_STORY_ITEMS || isSharing}
              className={`items-center gap-1 ${mediaAssets.length >= MAX_STORY_ITEMS || isSharing ? "opacity-40" : ""}`}
            >
              <View
                className="w-14 h-14 rounded-xl bg-card items-center justify-center"
                style={{ borderCurve: "continuous" }}
              >
                <Camera size={24} color="#fff" />
              </View>
              <Text className="text-muted-foreground text-xs">Camera</Text>
            </Pressable>

            <Pressable
              onPress={handleCreateTextStory}
              className="items-center gap-1"
            >
              <View
                className="w-14 h-14 rounded-xl bg-card items-center justify-center"
                style={{ borderCurve: "continuous" }}
              >
                <Type size={24} color="#fff" />
              </View>
              <Text className="text-muted-foreground text-xs">Text</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowTagPicker(true);
              }}
              className="items-center gap-1"
            >
              <View
                className="w-14 h-14 rounded-xl items-center justify-center"
                style={{
                  borderCurve: "continuous",
                  backgroundColor:
                    taggedUsers.length > 0
                      ? "rgba(62,164,229,0.2)"
                      : colors.card,
                }}
              >
                <UserPlus
                  size={24}
                  color={taggedUsers.length > 0 ? "#3EA4E5" : "#fff"}
                />
              </View>
              <Text
                style={{
                  color:
                    taggedUsers.length > 0
                      ? "#3EA4E5"
                      : "rgba(255,255,255,0.5)",
                  fontSize: 12,
                }}
              >
                {taggedUsers.length > 0
                  ? `${taggedUsers.length} Tag`
                  : "Mention"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

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
