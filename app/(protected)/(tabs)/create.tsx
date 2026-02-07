import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  Dimensions,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Image } from "expo-image";
import {
  X,
  Image as ImageIcon,
  Video,
  Camera,
  Trash2,
  Plus,
  Hash,
} from "lucide-react-native";
import { useRouter, useNavigation, useFocusEffect } from "expo-router";
import { Motion } from "@legendapp/motion";
import { Progress } from "@/components/ui/progress";
import {
  LocationAutocomplete,
  type LocationData,
} from "@/components/ui/location-autocomplete";
import { useColorScheme } from "@/lib/hooks";
import { useMediaPicker } from "@/lib/hooks";
import type { MediaAsset } from "@/lib/hooks/use-media-picker";
import { useCreatePostStore } from "@/lib/stores/create-post-store";
import { useCreatePost } from "@/lib/hooks/use-posts";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { useCallback, useEffect, useState, useLayoutEffect } from "react";
import { UserMentionAutocomplete } from "@/components/ui/user-mention-autocomplete";
import { Switch } from "react-native";
import { useCameraResultStore } from "@/lib/stores/camera-result-store";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MEDIA_PREVIEW_SIZE = (SCREEN_WIDTH - 48) / 2;
const ASPECT_RATIO = 5 / 4;

const MAX_PHOTOS = 4;
const MAX_VIDEO_DURATION = 60;
const MIN_CAPTION_LENGTH = 20;

export default function CreateScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const {
    caption,
    location,
    isNSFW,
    tags,
    setCaption,
    setLocationData,
    setIsNSFW,
    addTag,
    removeTag,
    reset,
  } = useCreatePostStore();
  const { selectedMedia, setSelectedMedia } = useCreatePostStore();
  const [tagInput, setTagInput] = useState("");
  const { pickFromLibrary, takePhoto, recordVideo, requestPermissions } =
    useMediaPicker();
  const { mutate: createPost, isPending: isCreating } = useCreatePost();
  const { user } = useAuthStore();
  const showToast = useUIStore((s) => s.showToast);
  const { colors } = useColorScheme();
  const consumeCameraResult = useCameraResultStore((s) => s.consumeResult);
  const {
    uploadMultiple,
    isUploading,
    isCompressing,
    progress: uploadProgress,
    compressionProgress,
    statusMessage,
  } = useMediaUpload({ folder: "posts" });

  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  const hasVideo = selectedMedia.some((m) => m.type === "video");
  const hasPhotos = selectedMedia.some((m) => m.type === "image");
  const canAddMore = !hasVideo && selectedMedia.length < MAX_PHOTOS;

  const isValid =
    selectedMedia.length > 0 && caption.trim().length >= MIN_CAPTION_LENGTH;

  const validateMedia = useCallback(
    (media: MediaAsset[]): MediaAsset[] => {
      const validMedia: MediaAsset[] = [];

      for (const item of media) {
        if (item.type === "video") {
          if (hasPhotos || selectedMedia.length > 0) {
            showToast(
              "warning",
              "Media Limit",
              "You can either add up to 4 photos OR 1 video per post. Please remove existing media first.",
            );
            continue;
          }

          if (item.duration && item.duration > MAX_VIDEO_DURATION) {
            showToast(
              "warning",
              "Video Too Long",
              `Videos must be ${MAX_VIDEO_DURATION} seconds or less. Your video is ${Math.round(item.duration)} seconds.`,
            );
            continue;
          }

          validMedia.push(item);
          break;
        } else {
          if (hasVideo) {
            showToast(
              "warning",
              "Media Limit",
              "You already have a video. Posts can have either photos OR video, not both.",
            );
            continue;
          }

          if (selectedMedia.length + validMedia.length >= MAX_PHOTOS) {
            showToast(
              "warning",
              "Photo Limit Reached",
              `You can add up to ${MAX_PHOTOS} photos per post.`,
            );
            break;
          }

          validMedia.push(item);
        }
      }

      return validMedia;
    },
    [hasVideo, hasPhotos, selectedMedia.length],
  );

  const handlePickLibrary = async () => {
    if (!canAddMore && !hasVideo) {
      showToast(
        "warning",
        "Photo Limit",
        `Maximum ${MAX_PHOTOS} photos per post.`,
      );
      return;
    }

    const remaining = hasVideo ? 0 : MAX_PHOTOS - selectedMedia.length;
    if (remaining === 0) {
      showToast(
        "warning",
        "Media Limit",
        "Remove existing media to add new ones.",
      );
      return;
    }

    const media = await pickFromLibrary({
      maxSelection: remaining,
      allowsMultipleSelection: true,
    });

    if (media && media.length > 0) {
      const validMedia = validateMedia(media);
      if (validMedia.length > 0) {
        setSelectedMedia([...selectedMedia, ...validMedia]);
      }
    }
  };

  // Consume camera result when returning from camera screen
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
        const validMedia = validateMedia([media]);
        if (validMedia.length > 0) {
          if (media.type === "video") {
            setSelectedMedia(validMedia);
          } else {
            setSelectedMedia([...selectedMedia, ...validMedia]);
          }
        }
      }
    }, [consumeCameraResult, validateMedia, selectedMedia, setSelectedMedia]),
  );

  const handleOpenCamera = (mode: "photo" | "video" | "both" = "both") => {
    if (mode === "photo" && hasVideo) {
      showToast("warning", "Media Limit", "Remove the video to add photos.");
      return;
    }
    if (mode === "photo" && selectedMedia.length >= MAX_PHOTOS) {
      showToast(
        "warning",
        "Photo Limit",
        `Maximum ${MAX_PHOTOS} photos per post.`,
      );
      return;
    }
    router.push({
      pathname: "/(protected)/camera",
      params: { mode, source: "post", maxDuration: String(MAX_VIDEO_DURATION) },
    });
  };

  const handleRemoveMedia = (id: string) => {
    setSelectedMedia(selectedMedia.filter((m) => m.id !== id));
  };

  const handlePost = async () => {
    console.log("[Create] handlePost called!");
    console.log("[Create] isValid:", isValid);
    console.log("[Create] isUploading:", isUploading);
    console.log("[Create] isCreating:", isCreating);
    console.log("[Create] selectedMedia:", selectedMedia.length);
    console.log("[Create] caption length:", caption.trim().length);

    // Prevent double submission
    if (isCreating || isUploading) {
      console.log("[Create] Already creating or uploading, ignoring");
      return;
    }

    // Check Bunny CDN configuration
    const bunnyZone = process.env.EXPO_PUBLIC_BUNNY_STORAGE_ZONE;
    const bunnyKey = process.env.EXPO_PUBLIC_BUNNY_STORAGE_API_KEY;
    console.log("[Create] Bunny config:", {
      zone: bunnyZone ? "set" : "MISSING",
      key: bunnyKey ? "set" : "MISSING",
    });

    if (!bunnyZone || !bunnyKey) {
      showToast(
        "error",
        "Config Error",
        "Media storage not configured. Please update the app.",
      );
      return;
    }

    if (selectedMedia.length === 0) {
      showToast(
        "error",
        "No Media",
        "Please select at least one photo or video",
      );
      return;
    }

    if (caption.trim().length < MIN_CAPTION_LENGTH) {
      showToast(
        "error",
        "Caption Too Short",
        `Please write at least ${MIN_CAPTION_LENGTH} characters. Currently: ${caption.trim().length}`,
      );
      return;
    }

    try {
      console.log("[Create] Starting post creation...");
      console.log("[Create] Selected media count:", selectedMedia.length);

      // Upload media to Bunny.net CDN
      const mediaFiles = selectedMedia.map((m) => ({
        uri: m.uri,
        type: m.type as "image" | "video",
      }));

      console.log("[Create] Uploading media to CDN...");
      let uploadResults;
      try {
        uploadResults = await uploadMultiple(mediaFiles);
        console.log("[Create] Upload results:", JSON.stringify(uploadResults));
      } catch (uploadError) {
        console.error("[Create] Upload threw error:", uploadError);
        showToast(
          "error",
          "Upload Failed",
          "Could not upload media. Please try again.",
        );
        return;
      }

      // Check if all uploads succeeded
      const failedUploads = uploadResults.filter((r) => !r.success);
      if (failedUploads.length > 0) {
        console.error("[Create] Upload failures:", failedUploads);
        showToast(
          "error",
          "Upload Error",
          `${failedUploads.length} file(s) failed to upload. Please try again.`,
        );
        return;
      }

      // Create post with CDN URLs (include thumbnail for videos)
      const postMedia = uploadResults.map((r) => ({
        type: r.type,
        url: r.url,
        ...(r.thumbnail && { thumbnail: r.thumbnail }),
      }));

      console.log("[Create] Creating post with CDN URLs:", postMedia);
      console.log("[Create] Author ID:", user?.id, "Username:", user?.username);

      // Append tags as hashtags to the caption content
      const tagsString =
        tags.length > 0 ? "\n" + tags.map((t) => `#${t}`).join(" ") : "";
      const fullContent = caption + tagsString;

      createPost(
        {
          content: fullContent,
          location,
          media: postMedia,
          isNSFW,
        },
        {
          onSuccess: (newPost) => {
            console.log("[Create] Post created successfully:", newPost?.id);
            showToast("success", "Posted!", "Your post is now live");
            reset();
            router.back();
          },
          onError: (error: any) => {
            console.error("[Create] Failed to create post:", error);
            console.error(
              "[Create] Error details:",
              JSON.stringify(error, null, 2),
            );
            const errorMessage =
              error?.message ||
              error?.error?.message ||
              "Failed to create post. Please try again.";
            showToast("error", "Error", errorMessage);
          },
        },
      );
    } catch (error) {
      console.error("[Create] Unexpected error:", error);
      showToast("error", "Error", "Something went wrong. Please try again.");
    }
  };

  const handleClose = () => {
    if (selectedMedia.length > 0 || caption.length > 0) {
      Alert.alert(
        "Discard Post?",
        "You have unsaved changes. Are you sure you want to discard this post?",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              reset();
              router.back();
            },
          },
        ],
      );
    } else {
      router.back();
    }
  };

  // Set up header with useLayoutEffect
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: "New Post",
      headerTitleAlign: "left" as const,
      headerStyle: {
        backgroundColor: colors.background,
      },
      headerTitleStyle: {
        color: colors.foreground,
        fontWeight: "600" as const,
        fontSize: 18,
      },
      headerLeft: () => (
        <Pressable
          onPress={handleClose}
          hitSlop={12}
          style={{
            marginLeft: 8,
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={24} color={colors.foreground} strokeWidth={2.5} />
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          onPress={() => {
            console.log("[Create] Share button pressed!");
            console.log(
              "[Create] isValid:",
              isValid,
              "isUploading:",
              isUploading,
            );
            if (isUploading) {
              showToast("info", "Please wait", "Upload in progress...");
              return;
            }
            if (selectedMedia.length === 0) {
              showToast(
                "error",
                "No Media",
                "Please select at least one photo or video",
              );
              return;
            }
            if (caption.trim().length < MIN_CAPTION_LENGTH) {
              showToast(
                "error",
                "Caption Too Short",
                `Please write at least ${MIN_CAPTION_LENGTH} characters`,
              );
              return;
            }
            handlePost();
          }}
          disabled={isUploading || isCreating || !isValid}
          hitSlop={12}
          style={{ marginRight: 8 }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color:
                isValid && !isUploading && !isCreating
                  ? colors.primary
                  : colors.mutedForeground,
            }}
          >
            {isUploading ? "Uploading..." : isCreating ? "Posting..." : "Share"}
          </Text>
        </Pressable>
      ),
    });
  }, [
    navigation,
    colors,
    isValid,
    isUploading,
    isCreating,
    selectedMedia.length,
    caption,
    handlePost,
    showToast,
    handleClose,
  ]);

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={100}
        enabled={true}
      >
        <View style={{ padding: 16 }}>
          <UserMentionAutocomplete
            value={caption}
            onChangeText={setCaption}
            placeholder="Write a caption... (use @ to mention users)"
            multiline
            maxLength={2200}
            style={{
              fontSize: 16,
              minHeight: 80,
            }}
          />
          <Text
            style={{
              fontSize: 12,
              color: "#666",
              marginTop: 8,
              textAlign: "right",
            }}
          >
            {caption.length}/2200
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <LocationAutocomplete
            value={location}
            placeholder="Add location"
            onLocationSelect={(data: LocationData) => setLocationData(data)}
            onClear={() => setLocationData(null)}
          />
        </View>

        {/* Tags Input */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <View
            style={{
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
                backgroundColor: "#111",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#333",
                paddingHorizontal: 12,
                height: 44,
              }}
            >
              <Hash size={16} color="#8A40CF" strokeWidth={2.5} />
              <TextInput
                value={tagInput}
                onChangeText={(t) => setTagInput(t.replace(/\s/g, ""))}
                placeholder="Add tag"
                placeholderTextColor="#666"
                style={{
                  flex: 1,
                  color: "#fff",
                  fontSize: 15,
                  marginLeft: 6,
                }}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (tagInput.trim()) {
                    addTag(tagInput);
                    setTagInput("");
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Pressable
              onPress={() => {
                if (tagInput.trim()) {
                  addTag(tagInput);
                  setTagInput("");
                }
              }}
              style={{
                backgroundColor: tagInput.trim() ? "#8A40CF" : "#333",
                height: 44,
                paddingHorizontal: 16,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                Add
              </Text>
            </Pressable>
          </View>
          {tags.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 10,
              }}
            >
              {tags.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => removeTag(tag)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: "rgba(138, 64, 207, 0.12)",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 100,
                    borderWidth: 1,
                    borderColor: "rgba(138, 64, 207, 0.25)",
                  }}
                >
                  <Hash size={11} color="#8A40CF" strokeWidth={2.5} />
                  <Text
                    style={{
                      color: "#8A40CF",
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    {tag}
                  </Text>
                  <X size={12} color="#8A40CF" style={{ marginLeft: 2 }} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Content Rating Toggle - only show when media is selected */}
        {selectedMedia.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
              marginBottom: 16,
              backgroundColor: isNSFW
                ? "rgba(239, 68, 68, 0.1)"
                : "transparent",
              borderRadius: 12,
              marginHorizontal: 16,
              borderWidth: 1,
              borderColor: isNSFW ? "rgba(239, 68, 68, 0.3)" : "#333",
            }}
          >
            <View
              style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
            >
              <Text style={{ fontSize: 20, marginRight: 8 }}>
                {isNSFW ? "😈" : "😇"}
              </Text>
              <View>
                <Text
                  style={{
                    color: isNSFW ? "#ef4444" : "#fff",
                    fontWeight: "600",
                    fontSize: 15,
                  }}
                >
                  {isNSFW ? "Spicy" : "Sweet"}
                </Text>
                <Text style={{ color: "#666", fontSize: 12, marginTop: 2 }}>
                  {isNSFW ? "Mature content warning" : "All audiences"}
                </Text>
              </View>
            </View>
            <Switch
              value={isNSFW}
              onValueChange={setIsNSFW}
              trackColor={{ false: "#333", true: "#ef4444" }}
              thumbColor={isNSFW ? "#fff" : "#888"}
            />
          </View>
        )}

        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 16,
            gap: 8,
            marginBottom: 20,
          }}
        >
          <Pressable
            onPress={handlePickLibrary}
            disabled={!canAddMore && selectedMedia.length > 0}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor:
                canAddMore || selectedMedia.length === 0
                  ? "#3EA4E5"
                  : "#1a1a1a",
              paddingVertical: 14,
              borderRadius: 12,
              opacity: canAddMore || selectedMedia.length === 0 ? 1 : 0.5,
            }}
          >
            <ImageIcon size={20} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600" }}>Library</Text>
          </Pressable>

          <Pressable
            onPress={() => handleOpenCamera("photo")}
            disabled={hasVideo || selectedMedia.length >= MAX_PHOTOS}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: "#1a1a1a",
              paddingVertical: 14,
              borderRadius: 12,
              opacity: !hasVideo && selectedMedia.length < MAX_PHOTOS ? 1 : 0.5,
            }}
          >
            <Camera size={20} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600" }}>Photo</Text>
          </Pressable>

          <Pressable
            onPress={() => handleOpenCamera("video")}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: "#1a1a1a",
              paddingVertical: 14,
              borderRadius: 12,
            }}
          >
            <Video size={20} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600" }}>Video</Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Text style={{ color: "#666", fontSize: 13 }}>
            {hasVideo
              ? `Video (max ${MAX_VIDEO_DURATION}s)`
              : `Photos ${selectedMedia.length}/${MAX_PHOTOS} (5:4 aspect ratio)`}
          </Text>
        </View>

        {selectedMedia.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {selectedMedia.map((media, index) => (
                <View
                  key={media.id}
                  style={{
                    width: hasVideo ? SCREEN_WIDTH - 32 : MEDIA_PREVIEW_SIZE,
                    aspectRatio: hasVideo ? 16 / 9 : ASPECT_RATIO,
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: "#111",
                  }}
                >
                  <Image
                    source={{ uri: media.uri }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />

                  {media.type === "video" && (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 8,
                        left: 8,
                        backgroundColor: "rgba(0,0,0,0.7)",
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 4,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Video size={12} color="#fff" />
                      <Text style={{ color: "#fff", fontSize: 12 }}>
                        {media.duration
                          ? `${Math.round(media.duration)}s`
                          : "Video"}
                      </Text>
                    </View>
                  )}

                  <View
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      backgroundColor: "rgba(0,0,0,0.7)",
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}
                    >
                      {index + 1}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleRemoveMedia(media.id)}
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      backgroundColor: "rgba(240,82,82,0.9)",
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    hitSlop={8}
                  >
                    <Trash2 size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}

              {canAddMore && (
                <Pressable
                  onPress={handlePickLibrary}
                  style={{
                    width: MEDIA_PREVIEW_SIZE,
                    aspectRatio: ASPECT_RATIO,
                    borderRadius: 12,
                    backgroundColor: "#111",
                    borderWidth: 2,
                    borderColor: "#333",
                    borderStyle: "dashed",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Plus size={32} color="#666" />
                  <Text style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
                    Add More
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {selectedMedia.length === 0 && (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 60,
              paddingHorizontal: 32,
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: "#111",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <ImageIcon size={36} color="#666" />
            </View>
            <Text
              style={{
                color: "#fff",
                fontSize: 18,
                fontWeight: "600",
                marginBottom: 8,
              }}
            >
              Add Photos or Video
            </Text>
            <Text
              style={{
                color: "#666",
                fontSize: 14,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              Select up to {MAX_PHOTOS} photos or 1 video{"\n"}(max{" "}
              {MAX_VIDEO_DURATION} seconds)
            </Text>
          </View>
        )}
      </KeyboardAwareScrollView>

      {/* Progress Overlay */}
      {isUploading && (
        <View className="absolute inset-0 bg-black/80 items-center justify-center z-50">
          <Motion.View
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="bg-card rounded-3xl p-8 items-center gap-4 min-w-[280px]"
          >
            {/* Show compression progress when compressing */}
            {isCompressing && (
              <>
                <View className="w-48 mb-2">
                  <Progress value={compressionProgress} />
                </View>
                <Text className="text-lg font-semibold text-foreground">
                  Compressing Video...
                </Text>
                <Text className="text-sm text-muted-foreground text-center">
                  {compressionProgress}% complete
                </Text>
              </>
            )}
            {/* Show upload progress when not compressing */}
            {!isCompressing && (
              <>
                <View className="w-48 mb-2">
                  <Progress value={uploadProgress} />
                </View>
                <Text className="text-lg font-semibold text-foreground">
                  {statusMessage || "Posting..."}
                </Text>
                <Text className="text-sm text-muted-foreground text-center">
                  {uploadProgress}% complete
                </Text>
              </>
            )}
          </Motion.View>
        </View>
      )}
    </View>
  );
}
