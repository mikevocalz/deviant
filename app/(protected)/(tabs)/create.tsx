
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import {
  X,
  Image as ImageIcon,
  Video,
  Camera,
  Trash2,
  Plus,
} from "lucide-react-native";
import { Stack, useRouter } from "expo-router";
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
import { useCallback, useEffect, useState } from "react";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MEDIA_PREVIEW_SIZE = (SCREEN_WIDTH - 48) / 2;
const ASPECT_RATIO = 5 / 4;

const MAX_PHOTOS = 4;
const MAX_VIDEO_DURATION = 60;
const MIN_CAPTION_LENGTH = 100;

export default function CreateScreen() {
  const router = useRouter();
  const { caption, location, setCaption, setLocationData, reset } =
    useCreatePostStore();
  const { selectedMedia, setSelectedMedia } = useCreatePostStore();
  const { pickFromLibrary, takePhoto, recordVideo, requestPermissions } =
    useMediaPicker();
  const { mutate: createPost, isPending: isCreating } = useCreatePost();
  const { user } = useAuthStore();
  const showToast = useUIStore((s) => s.showToast);
  const { colors } = useColorScheme();
  const {
    uploadMultiple,
    isUploading,
    progress: uploadProgress,
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
            Alert.alert(
              "Media Limit",
              "You can either add up to 4 photos OR 1 video per post. Please remove existing media first.",
              [{ text: "Got it" }],
            );
            continue;
          }

          if (item.duration && item.duration > MAX_VIDEO_DURATION) {
            Alert.alert(
              "Video Too Long",
              `Videos must be ${MAX_VIDEO_DURATION} seconds or less. Your video is ${Math.round(item.duration)} seconds.`,
              [{ text: "Got it" }],
            );
            continue;
          }

          validMedia.push(item);
          break;
        } else {
          if (hasVideo) {
            Alert.alert(
              "Media Limit",
              "You already have a video. Posts can have either photos OR video, not both.",
              [{ text: "Got it" }],
            );
            continue;
          }

          if (selectedMedia.length + validMedia.length >= MAX_PHOTOS) {
            Alert.alert(
              "Photo Limit Reached",
              `You can add up to ${MAX_PHOTOS} photos per post.`,
              [{ text: "Got it" }],
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
      Alert.alert("Photo Limit", `Maximum ${MAX_PHOTOS} photos per post.`);
      return;
    }

    const remaining = hasVideo ? 0 : MAX_PHOTOS - selectedMedia.length;
    if (remaining === 0) {
      Alert.alert("Media Limit", "Remove existing media to add new ones.");
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

  const handleTakePhoto = async () => {
    if (hasVideo) {
      Alert.alert("Media Limit", "Remove the video to add photos.");
      return;
    }
    if (selectedMedia.length >= MAX_PHOTOS) {
      Alert.alert("Photo Limit", `Maximum ${MAX_PHOTOS} photos per post.`);
      return;
    }

    const media = await takePhoto();
    if (media) {
      setSelectedMedia([...selectedMedia, media]);
    }
  };

  const handleRecordVideo = async () => {
    if (selectedMedia.length > 0) {
      Alert.alert(
        "Clear Media?",
        "Adding a video will replace all current photos. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue",
            onPress: async () => {
              setSelectedMedia([]);
              const media = await recordVideo();
              if (media) {
                if (media.duration && media.duration > MAX_VIDEO_DURATION) {
                  Alert.alert(
                    "Video Too Long",
                    `Videos must be ${MAX_VIDEO_DURATION} seconds or less.`,
                  );
                  return;
                }
                setSelectedMedia([media]);
              }
            },
          },
        ],
      );
      return;
    }

    const media = await recordVideo();
    if (media) {
      if (media.duration && media.duration > MAX_VIDEO_DURATION) {
        Alert.alert(
          "Video Too Long",
          `Videos must be ${MAX_VIDEO_DURATION} seconds or less.`,
        );
        return;
      }
      setSelectedMedia([media]);
    }
  };

  const handleRemoveMedia = (id: string) => {
    setSelectedMedia(selectedMedia.filter((m) => m.id !== id));
  };

  const handlePost = async () => {
    if (selectedMedia.length === 0) {
      Alert.alert("No Media", "Please select at least one photo or video");
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

    console.log("[Create] Uploading media to CDN...");

    // Upload media to Bunny.net CDN
    const mediaFiles = selectedMedia.map((m) => ({
      uri: m.uri,
      type: m.type as "image" | "video",
    }));

    const uploadResults = await uploadMultiple(mediaFiles);

    // Check if all uploads succeeded
    const failedUploads = uploadResults.filter((r) => !r.success);
    if (failedUploads.length > 0) {
      Alert.alert(
        "Upload Error",
        `${failedUploads.length} file(s) failed to upload. Please try again.`,
      );
      return;
    }

    // Create post with CDN URLs
    const postMedia = uploadResults.map((r) => ({
      type: r.type,
      url: r.url,
    }));

    console.log("[Create] Creating post with CDN URLs:", postMedia);

    createPost(
      {
        caption,
        location,
        media: postMedia,
        author: user
          ? {
              username: user.username || "you",
              avatar: user.avatar || "https://i.pravatar.cc/150?img=12",
              verified: false,
            }
          : undefined,
      },
      {
        onSuccess: (newPost) => {
          console.log("[Create] Post created successfully:", newPost.id);
          reset();
          router.replace("/(protected)/(tabs)");
        },
        onError: (error) => {
          console.error("[Create] Failed to create post:", error);
          Alert.alert("Error", "Failed to create post. Please try again.");
        },
      },
    );
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

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          presentation: "modal",
          headerShown: true,
          title: "New Post",
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontWeight: "700" },
          headerLeft: () => (
            <Pressable onPress={handleClose} hitSlop={8}>
              <X size={24} color={colors.foreground} />
            </Pressable>
          ),
          headerRight: () => (
            <Motion.View whileTap={{ scale: 0.95 }}>
              <Pressable
                onPress={handlePost}
                disabled={isUploading || !isValid}
                className={`px-4 py-2 rounded-2xl ${isValid ? "bg-primary" : "bg-muted"}`}
              >
                <Text
                  className={`text-sm font-semibold ${isValid ? "text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {isUploading ? "Posting..." : "Share"}
                </Text>
              </Pressable>
            </Motion.View>
          ),
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ padding: 16 }}>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Write a caption..."
            placeholderTextColor="#666"
            multiline
            maxLength={2200}
            style={{
              fontSize: 16,
              color: "#fff",
              minHeight: 80,
              textAlignVertical: "top",
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
            onPress={handleTakePhoto}
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
            onPress={handleRecordVideo}
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
      </ScrollView>

      {/* Progress Overlay */}
      {isUploading && (
        <View className="absolute inset-0 bg-black/80 items-center justify-center z-50">
          <Motion.View
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="bg-card rounded-3xl p-8 items-center gap-4"
          >
            <View className="w-48 mb-2">
              <Progress value={uploadProgress} />
            </View>
            <Text className="text-lg font-semibold text-foreground">
              Posting...
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              Sharing your post with the world
            </Text>
          </Motion.View>
        </View>
      )}
    </View>
  );
}
