/**
 * Crop & Preview Screen
 *
 * Mandatory step after image selection, before the create screen accepts images.
 * Shows each image in a 4:5 crop frame with pinch/zoom/drag.
 * Generates deterministic cropped bitmaps on "Done".
 *
 * Navigation:
 *   - Back (left arrow) = cancel, images are NOT added to post
 *   - Done (right button) = generate crops, add to post, pop back
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Check, RotateCcw } from "lucide-react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme } from "@/lib/hooks";
import { ImageCropView } from "@/src/crop/ImageCropView";
import {
  CROP_ASPECT_RATIO,
  consumePendingCrop,
  generateCroppedBitmap,
  getCropRect,
  getImageDimensions,
  type CropState,
} from "@/src/crop/crop-utils";
import { useCreatePostStore } from "@/lib/stores/create-post-store";
import type { MediaAsset } from "@/lib/hooks/use-media-picker";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const FRAME_WIDTH = SCREEN_WIDTH;
const THUMB_SIZE = 64;

export default function CropPreviewScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useColorScheme();

  // Read pending media (set by create screen before navigation)
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [dimensions, setDimensions] = useState<
    Map<string, { width: number; height: number }>
  >(new Map());
  const [activeIndex, setActiveIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Store crop state per image
  const cropStates = useRef<Map<string, CropState>>(new Map());

  // Dynamic aspect ratio (default: feed 4:5, stories pass 9:16)
  const [aspectRatio, setAspectRatio] = useState(CROP_ASPECT_RATIO);
  const onCompleteRef = useRef<((cropped: MediaAsset[]) => void) | undefined>(
    undefined,
  );

  const { selectedMedia, setSelectedMedia } = useCreatePostStore();

  const frameHeight = Math.round(FRAME_WIDTH * aspectRatio);

  // Consume pending crop data on mount
  useEffect(() => {
    const pending = consumePendingCrop();
    if (!pending.media || pending.media.length === 0) {
      // No pending media — go back
      router.back();
      return;
    }

    const images = pending.media.filter((m) => m.type === "image");
    if (images.length === 0) {
      router.back();
      return;
    }

    if (pending.aspectRatio) setAspectRatio(pending.aspectRatio);
    onCompleteRef.current = pending.onComplete;

    setMedia(images);
    if (pending.editIndex !== undefined) {
      setActiveIndex(pending.editIndex);
    }

    // Restore crop states from MediaAsset.cropState if re-editing
    images.forEach((img) => {
      if (img.cropState) {
        cropStates.current.set(img.id, img.cropState);
      }
    });

    // Resolve dimensions for all images
    const resolveDimensions = async () => {
      const dimMap = new Map<string, { width: number; height: number }>();
      for (const img of images) {
        if (img.width && img.height) {
          dimMap.set(img.id, { width: img.width, height: img.height });
        } else {
          try {
            const sourceUri = img.originalUri || img.uri;
            const dims = await getImageDimensions(sourceUri);
            dimMap.set(img.id, dims);
          } catch {
            // Fallback: assume square
            dimMap.set(img.id, { width: 1080, height: 1080 });
          }
        }
      }
      setDimensions(dimMap);
      setIsLoading(false);
    };

    resolveDimensions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Configure header
  useEffect(() => {
    navigation.setOptions({
      headerShown: false, // We render our own header for full control
    });
  }, [navigation]);

  const activeMedia = media[activeIndex];
  const activeDims = activeMedia ? dimensions.get(activeMedia.id) : null;
  const activeSourceUri = activeMedia
    ? activeMedia.originalUri || activeMedia.uri
    : "";

  const handleCropChange = useCallback(
    (state: CropState) => {
      if (activeMedia) {
        cropStates.current.set(activeMedia.id, state);
      }
    },
    [activeMedia],
  );

  const handleDone = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setError(null);

    try {
      const croppedResults: MediaAsset[] = [];

      for (const img of media) {
        const dims = dimensions.get(img.id);
        if (!dims) continue;

        const sourceUri = img.originalUri || img.uri;
        const state = cropStates.current.get(img.id) || {
          scale: Math.max(FRAME_WIDTH / dims.width, frameHeight / dims.height),
          translateX: 0,
          translateY: 0,
        };

        // Calculate crop rectangle in original image coordinates
        const rect = getCropRect(
          dims.width,
          dims.height,
          FRAME_WIDTH,
          frameHeight,
          state.scale,
          state.translateX,
          state.translateY,
        );

        // Generate deterministic cropped bitmap
        const cropped = await generateCroppedBitmap(sourceUri, rect);

        croppedResults.push({
          ...img,
          uri: cropped.uri,
          originalUri: sourceUri,
          width: cropped.width,
          height: cropped.height,
          cropState: state,
        });
      }

      // If an onComplete callback was provided (story mode), use it
      // Otherwise update the create post store (feed post mode)
      if (onCompleteRef.current) {
        onCompleteRef.current(croppedResults);
      } else {
        const existingNonImage = selectedMedia.filter(
          (m) => m.type !== "image",
        );
        const existingCropped = selectedMedia.filter(
          (m) =>
            m.type === "image" && !croppedResults.some((cr) => cr.id === m.id),
        );
        setSelectedMedia([
          ...existingNonImage,
          ...existingCropped,
          ...croppedResults,
        ]);
      }

      router.back();
    } catch (err: any) {
      console.error("[CropPreview] Failed to generate crops:", err);
      setError(err?.message || "Failed to crop images. Please try again.");
      setIsProcessing(false);
    }
  }, [
    isProcessing,
    media,
    dimensions,
    selectedMedia,
    setSelectedMedia,
    router,
  ]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleReset = useCallback(() => {
    if (activeMedia) {
      cropStates.current.delete(activeMedia.id);
      // Force re-render by toggling active index
      const idx = activeIndex;
      setActiveIndex(-1);
      requestAnimationFrame(() => setActiveIndex(idx));
    }
  }, [activeMedia, activeIndex]);

  // Skeleton while loading dimensions
  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: "#000" }]}>
        <View
          style={[
            styles.skeletonFrame,
            {
              width: FRAME_WIDTH,
              height: frameHeight,
              marginTop: insets.top + 56,
            },
          ]}
        >
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Preparing images...</Text>
        </View>
      </View>
    );
  }

  if (media.length === 0) return null;

  return (
    <GestureHandlerRootView
      style={[styles.screen, { backgroundColor: "#000" }]}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleBack} hitSlop={16} style={styles.headerBtn}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>
          Crop{media.length > 1 ? ` (${activeIndex + 1}/${media.length})` : ""}
        </Text>
        <View style={styles.headerRight}>
          <Pressable
            onPress={handleReset}
            hitSlop={12}
            style={[styles.headerBtn, { marginRight: 8 }]}
          >
            <RotateCcw size={20} color="#999" />
          </Pressable>
          <Pressable
            onPress={handleDone}
            disabled={isProcessing}
            hitSlop={12}
            style={styles.headerBtn}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#3EA4E5" />
            ) : (
              <Text style={styles.doneText}>Done</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Darkened area above crop frame */}
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }} />

      {/* Crop view */}
      {activeDims && activeSourceUri ? (
        <ImageCropView
          key={`${activeMedia!.id}-${activeIndex}`}
          uri={activeSourceUri}
          imageWidth={activeDims.width}
          imageHeight={activeDims.height}
          frameWidth={FRAME_WIDTH}
          aspectRatio={aspectRatio}
          initialState={cropStates.current.get(activeMedia!.id)}
          onCropChange={handleCropChange}
        />
      ) : (
        <View
          style={{
            width: FRAME_WIDTH,
            height: frameHeight,
            backgroundColor: "#111",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#666" }}>Image not available</Text>
        </View>
      )}

      {/* Darkened area below crop frame */}
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}>
        {/* Hint text */}
        <Text style={styles.hintText}>Pinch to zoom, drag to reposition</Text>

        {/* Multi-image thumbnails */}
        {media.length > 1 && (
          <View style={styles.thumbRow}>
            {media.map((img, idx) => (
              <Pressable
                key={img.id}
                onPress={() => setActiveIndex(idx)}
                style={[
                  styles.thumb,
                  idx === activeIndex && styles.thumbActive,
                ]}
              >
                <Image
                  source={{ uri: img.originalUri || img.uri }}
                  style={styles.thumbImage}
                  contentFit="cover"
                />
                <View style={styles.thumbBadge}>
                  <Text style={styles.thumbBadgeText}>{idx + 1}</Text>
                </View>
                {cropStates.current.has(img.id) && (
                  <View style={styles.thumbCheck}>
                    <Check size={10} color="#fff" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => setError(null)}>
              <Text style={styles.retryText}>Dismiss</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Processing overlay */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color="#3EA4E5" />
            <Text style={styles.processingText}>Generating crops...</Text>
          </View>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#000",
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  doneText: {
    color: "#3EA4E5",
    fontSize: 16,
    fontWeight: "700",
  },
  skeletonFrame: {
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#888",
    fontSize: 14,
  },
  hintText: {
    color: "#666",
    fontSize: 13,
    textAlign: "center",
    marginTop: 16,
  },
  thumbRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 20,
    paddingHorizontal: 16,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbActive: {
    borderColor: "#3EA4E5",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  thumbCheck: {
    position: "absolute",
    bottom: 4,
    left: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: "rgba(239,68,68,0.15)",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    flex: 1,
  },
  retryText: {
    color: "#3EA4E5",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 12,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  processingCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 16,
  },
  processingText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
});
