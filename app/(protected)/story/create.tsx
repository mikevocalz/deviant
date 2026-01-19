
import {
  View,
  Text,
  Pressable,
  TextInput,
  Dimensions,
  ScrollView,
  Alert,
  Animated,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  X,
  Image as ImageIcon,
  Video,
  Type,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react-native";
import { Stack, useRouter } from "expo-router";
import { Motion } from "@legendapp/motion";
import { Progress } from "@/components/ui/progress";
import { useColorScheme } from "@/lib/hooks";
import { LinearGradient } from "expo-linear-gradient";
import { useCreateStoryStore } from "@/lib/stores/create-story-store";
import type { MediaAsset } from "@/lib/hooks/use-media-picker";
import { useMediaPicker } from "@/lib/hooks";
import { useState, useRef, useEffect, useCallback } from "react";
import { useCreateStory } from "@/lib/hooks/use-stories";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CANVAS_WIDTH = SCREEN_WIDTH - 32;
const CANVAS_HEIGHT = Math.min(SCREEN_HEIGHT * 0.6, CANVAS_WIDTH * (16 / 9));

const MAX_STORY_ITEMS = 4;
const MAX_VIDEO_DURATION = 30;
const MAX_FILE_SIZE_MB = 50;

const bgGradients = [
  { colors: ["#1a1a2e", "#16213e"] as [string, string], label: "Midnight" },
  { colors: ["#34A2DF", "#8A40CF"] as [string, string], label: "Ocean" },
  { colors: ["#8A40CF", "#FF5BFC"] as [string, string], label: "Purple" },
  { colors: ["#FF5BFC", "#FF6B6B"] as [string, string], label: "Sunset" },
  { colors: ["#11998e", "#38ef7d"] as [string, string], label: "Forest" },
  { colors: ["#fc4a1a", "#f7b733"] as [string, string], label: "Fire" },
];

const textColors = [
  "#ffffff",
  "#000000",
  "#FF5BFC",
  "#3EA4E5",
  "#38ef7d",
  "#f7b733",
];

export default function CreateStoryScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const {
    selectedMedia,
    mediaTypes,
    text,
    textColor,
    setSelectedMedia,
    setText,
    setTextColor,
    setBackgroundColor,
    reset,
    currentIndex,
    setCurrentIndex,
    mediaAssets,
    setMediaAssets,
    nextSlide,
    prevSlide,
  } = useCreateStoryStore();

  const { pickStoryMedia, recordStoryVideo, requestPermissions } =
    useMediaPicker();
  const createStory = useCreateStory();
  const {
    uploadMultiple,
    isUploading: isUploadingMedia,
    progress: mediaUploadProgress,
  } = useMediaUpload({ folder: "stories" });
  const [isSharing, setIsSharing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [showTextInput, setShowTextInput] = useState(false);
  const [activeGradientIndex, setActiveGradientIndex] = useState(0);
  const [activeTextColorIndex, setActiveTextColorIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  const animateTransition = useCallback(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.5,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim]);

  const handleMediaSelected = useCallback(
    (media: MediaAsset[]) => {
      const currentCount = mediaAssets.length;
      const newItems = media.slice(0, MAX_STORY_ITEMS - currentCount);

      if (media.length > MAX_STORY_ITEMS - currentCount) {
        Alert.alert(
          "Story Limit",
          `You can add up to ${MAX_STORY_ITEMS} items per story. ${newItems.length} items added.`,
          [{ text: "Got it" }],
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
        Alert.alert("Some videos couldn't be added", errors.join("\n"), [
          { text: "Got it" },
        ]);
      }

      if (validMedia.length > 0) {
        const updatedAssets = [...mediaAssets, ...validMedia];
        setMediaAssets(updatedAssets);
        setSelectedMedia(
          updatedAssets.map((m) => m.uri),
          updatedAssets.map((m) => m.type),
        );
        animateTransition();
      }
    },
    [mediaAssets, setMediaAssets, setSelectedMedia, animateTransition],
  );

  const handlePickLibrary = async () => {
    if (mediaAssets.length >= MAX_STORY_ITEMS) {
      Alert.alert("Story Limit", `Maximum ${MAX_STORY_ITEMS} items per story.`);
      return;
    }

    const media = await pickStoryMedia({
      maxDuration: MAX_VIDEO_DURATION,
      maxFileSizeMB: MAX_FILE_SIZE_MB,
    });

    if (media && media.length > 0) {
      handleMediaSelected(media);
    }
  };

  const handleRecordVideo = async () => {
    if (mediaAssets.length >= MAX_STORY_ITEMS) {
      Alert.alert("Story Limit", `Maximum ${MAX_STORY_ITEMS} items per story.`);
      return;
    }

    const media = await recordStoryVideo({
      maxDuration: MAX_VIDEO_DURATION,
      maxFileSizeMB: MAX_FILE_SIZE_MB,
    });
    if (media) {
      handleMediaSelected([media]);
    }
  };

  const handleRemoveMedia = (index: number) => {
    const updated = mediaAssets.filter((_, i) => i !== index);
    setMediaAssets(updated);
    setSelectedMedia(
      updated.map((m) => m.uri),
      updated.map((m) => m.type),
    );
    if (currentIndex >= updated.length && updated.length > 0) {
      setCurrentIndex(updated.length - 1);
    }
    animateTransition();
  };

  const simulateUploadProgress = useCallback(() => {
    setUploadProgress(0);
    progressAnim.setValue(0);

    const stages = [
      { progress: 15, delay: 200 },
      { progress: 35, delay: 400 },
      { progress: 55, delay: 300 },
      { progress: 75, delay: 350 },
      { progress: 90, delay: 400 },
      { progress: 100, delay: 300 },
    ];

    let totalDelay = 0;
    stages.forEach(({ progress, delay }) => {
      totalDelay += delay;
      setTimeout(() => {
        setUploadProgress(progress);
        Animated.timing(progressAnim, {
          toValue: progress / 100,
          duration: delay * 0.8,
          useNativeDriver: false,
        }).start();
      }, totalDelay);
    });

    return totalDelay + 200;
  }, [progressAnim]);

  const handleShare = async () => {
    if (selectedMedia.length === 0 && !text) {
      Alert.alert("Empty Story", "Please add media or text to your story");
      return;
    }

    setIsSharing(true);
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Upload media to Bunny.net CDN
    if (mediaAssets.length > 0) {
      const mediaFiles = mediaAssets.map((m) => ({
        uri: m.uri,
        type: m.type as "image" | "video",
      }));

      const uploadResults = await uploadMultiple(mediaFiles);
      const failedUploads = uploadResults.filter((r) => !r.success);

      if (failedUploads.length > 0) {
        setIsSharing(false);
        setUploadProgress(0);
        progressAnim.setValue(0);
        Alert.alert(
          "Upload Error",
          "Failed to upload media. Please try again.",
        );
        return;
      }

      const storyItems = uploadResults.map((r) => ({
        type: r.type,
        url: r.url,
      }));

      createStory.mutate(
        { items: storyItems },
        {
          onSuccess: () => {
            setUploadProgress(100);
            setTimeout(() => {
              setIsSharing(false);
              setUploadProgress(0);
              progressAnim.setValue(0);
              Alert.alert("Success", "Story shared successfully!");
              reset();
              setMediaAssets([]);
              router.back();
            }, 300);
          },
          onError: (error) => {
            setIsSharing(false);
            setUploadProgress(0);
            progressAnim.setValue(0);
            console.error("[Story] Error creating story:", error);
            Alert.alert("Error", "Failed to share story. Please try again.");
          },
        },
      );
    } else {
      setIsSharing(false);
      Alert.alert("No Media", "Please add media to your story");
    }
  };

  const handleClose = () => {
    if (selectedMedia.length > 0 || text.length > 0) {
      Alert.alert(
        "Discard Story?",
        "You have unsaved changes. Are you sure you want to discard?",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              reset();
              setMediaAssets([]);
              router.back();
            },
          },
        ],
      );
    } else {
      router.back();
    }
  };

  const handleGradientSelect = (index: number) => {
    setActiveGradientIndex(index);
    setBackgroundColor(bgGradients[index].colors.join(","));
    animateTransition();
  };

  const handleTextColorSelect = (index: number) => {
    setActiveTextColorIndex(index);
    setTextColor(textColors[index]);
  };

  const currentMedia = selectedMedia[currentIndex];
  const currentMediaType = mediaTypes[currentIndex];
  const currentGradient = bgGradients[activeGradientIndex].colors;

  const isValid = selectedMedia.length > 0 || text;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          presentation: "modal",
          headerShown: true,
          title: "New Story",
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
                onPress={handleShare}
                disabled={isSharing || !isValid}
                className={`px-4 py-2 rounded-2xl ${isValid ? "bg-primary" : "bg-muted"}`}
              >
                <Text
                  className={`text-sm font-semibold ${isValid ? "text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {isSharing ? "Sharing..." : "Share"}
                </Text>
              </Pressable>
            </Motion.View>
          ),
        }}
      />
      <SafeAreaView
        edges={[]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        {isSharing && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBackground}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {uploadProgress < 100
                ? `Uploading... ${uploadProgress}%`
                : "Processing..."}
            </Text>
          </View>
        )}

        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 16,
          }}
        >
          <Animated.View
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              borderRadius: 20,
              overflow: "hidden",
              opacity: fadeAnim,
            }}
          >
            {!currentMedia ? (
              <LinearGradient
                colors={currentGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1 }}
              >
                {showTextInput ? (
                  <View
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 24,
                    }}
                  >
                    <TextInput
                      value={text}
                      onChangeText={setText}
                      placeholder="Type something..."
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      multiline
                      maxLength={300}
                      autoFocus
                      style={{
                        width: "100%",
                        textAlign: "center",
                        fontSize: 28,
                        fontWeight: "700",
                        color: textColor,
                      }}
                    />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setShowTextInput(true)}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {text ? (
                      <Text
                        style={{
                          fontSize: 28,
                          fontWeight: "700",
                          color: textColor,
                          textAlign: "center",
                          paddingHorizontal: 24,
                        }}
                      >
                        {text}
                      </Text>
                    ) : (
                      <View style={{ alignItems: "center" }}>
                        <Sparkles size={48} color="rgba(255,255,255,0.3)" />
                        <Text
                          style={{
                            color: "rgba(255,255,255,0.5)",
                            marginTop: 12,
                            fontSize: 16,
                          }}
                        >
                          Tap to add text
                        </Text>
                      </View>
                    )}
                  </Pressable>
                )}
              </LinearGradient>
            ) : (
              <View style={{ flex: 1, backgroundColor: "#000" }}>
                {currentMediaType === "video" ? (
                  <View
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Image
                      source={{ uri: currentMedia }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                    <View
                      style={{
                        position: "absolute",
                        backgroundColor: "rgba(0,0,0,0.6)",
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Video size={16} color="#fff" />
                      <Text style={{ color: "#fff", fontSize: 14 }}>Video</Text>
                    </View>
                  </View>
                ) : (
                  <Image
                    source={{ uri: currentMedia }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                )}

                {text && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 40,
                      left: 0,
                      right: 0,
                      paddingHorizontal: 24,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 22,
                        fontWeight: "700",
                        color: textColor,
                        textAlign: "center",
                        textShadowColor: "rgba(0,0,0,0.5)",
                        textShadowOffset: { width: 1, height: 1 },
                        textShadowRadius: 4,
                      }}
                    >
                      {text}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {selectedMedia.length > 1 && (
              <>
                <View
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    right: 12,
                    flexDirection: "row",
                    gap: 4,
                  }}
                >
                  {selectedMedia.map((_, idx) => (
                    <View
                      key={idx}
                      style={{
                        flex: 1,
                        height: 3,
                        borderRadius: 2,
                        backgroundColor:
                          idx === currentIndex
                            ? "#fff"
                            : "rgba(255,255,255,0.3)",
                      }}
                    />
                  ))}
                </View>

                {currentIndex > 0 && (
                  <Pressable
                    onPress={() => {
                      prevSlide();
                      animateTransition();
                    }}
                    style={{
                      position: "absolute",
                      left: 8,
                      top: "50%",
                      marginTop: -20,
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: "rgba(0,0,0,0.5)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ChevronLeft size={24} color="#fff" />
                  </Pressable>
                )}

                {currentIndex < selectedMedia.length - 1 && (
                  <Pressable
                    onPress={() => {
                      nextSlide();
                      animateTransition();
                    }}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      marginTop: -20,
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: "rgba(0,0,0,0.5)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ChevronRight size={24} color="#fff" />
                  </Pressable>
                )}
              </>
            )}
          </Animated.View>

          {mediaAssets.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 16, maxHeight: 72 }}
              contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
            >
              {mediaAssets.map((asset, idx) => (
                <Pressable
                  key={asset.id}
                  onPress={() => {
                    setCurrentIndex(idx);
                    animateTransition();
                  }}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 8,
                    overflow: "hidden",
                    borderWidth: idx === currentIndex ? 2 : 0,
                    borderColor: "#3EA4E5",
                  }}
                >
                  <Image
                    source={{ uri: asset.uri }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                  <Pressable
                    onPress={() => handleRemoveMedia(idx)}
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: "rgba(240,82,82,0.9)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    hitSlop={8}
                  >
                    <X size={10} color="#fff" />
                  </Pressable>
                  {asset.type === "video" && (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 2,
                        left: 2,
                      }}
                    >
                      <Video size={12} color="#fff" />
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: 24,
              marginBottom: 16,
            }}
          >
            <Pressable
              onPress={handlePickLibrary}
              disabled={mediaAssets.length >= MAX_STORY_ITEMS}
              style={{
                alignItems: "center",
                gap: 4,
                opacity: mediaAssets.length >= MAX_STORY_ITEMS ? 0.4 : 1,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: "#1a1a1a",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ImageIcon size={24} color="#fff" />
              </View>
              <Text style={{ color: "#999", fontSize: 12 }}>
                Photo{" "}
                {mediaAssets.length > 0
                  ? `(${mediaAssets.length}/${MAX_STORY_ITEMS})`
                  : ""}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleRecordVideo}
              disabled={mediaAssets.length >= MAX_STORY_ITEMS}
              style={{
                alignItems: "center",
                gap: 4,
                opacity: mediaAssets.length >= MAX_STORY_ITEMS ? 0.4 : 1,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: "#1a1a1a",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Video size={24} color="#fff" />
              </View>
              <Text style={{ color: "#999", fontSize: 12 }}>Video (30s)</Text>
            </Pressable>

            <Pressable
              onPress={() => setShowTextInput(!showTextInput)}
              style={{ alignItems: "center", gap: 4 }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: showTextInput ? "#3EA4E5" : "#1a1a1a",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Type size={24} color="#fff" />
              </View>
              <Text style={{ color: "#999", fontSize: 12 }}>Text</Text>
            </Pressable>
          </View>

          {selectedMedia.length === 0 && (
            <>
              <Text
                style={{
                  color: "#666",
                  fontSize: 12,
                  marginBottom: 8,
                  marginLeft: 4,
                }}
              >
                Background
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {bgGradients.map((gradient, index) => (
                    <Pressable
                      key={index}
                      onPress={() => handleGradientSelect(index)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        overflow: "hidden",
                        borderWidth: index === activeGradientIndex ? 2 : 0,
                        borderColor: "#fff",
                      }}
                    >
                      <LinearGradient
                        colors={gradient.colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ flex: 1 }}
                      />
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {(showTextInput || text) && (
                <>
                  <Text
                    style={{
                      color: "#666",
                      fontSize: 12,
                      marginTop: 16,
                      marginBottom: 8,
                      marginLeft: 4,
                    }}
                  >
                    Text Color
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      {textColors.map((color, index) => (
                        <Pressable
                          key={index}
                          onPress={() => handleTextColorSelect(index)}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: color,
                            borderWidth: index === activeTextColorIndex ? 2 : 1,
                            borderColor:
                              index === activeTextColorIndex
                                ? "#3EA4E5"
                                : "#333",
                          }}
                        />
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  progressContainer: {
    position: "absolute",
    top: 70,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderRadius: 12,
    padding: 16,
    zIndex: 100,
  },
  progressBackground: {
    height: 6,
    backgroundColor: "#333",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#3EA4E5",
    borderRadius: 3,
  },
  progressText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 10,
  },
});
