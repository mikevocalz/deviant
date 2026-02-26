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

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useReducer,
} from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Check, RotateCcw } from "lucide-react-native";
// NOTE: Do NOT use GestureHandlerRootView here — the root _layout.tsx already provides it.
// Nesting GestureHandlerRootView causes native crashes on iOS.
import { useColorScheme } from "@/lib/hooks";
import { ImageCropView, type ViewRefs } from "@/src/crop/ImageCropView";
import {
  CROP_ASPECT_RATIO,
  consumePendingCrop,
  getImageDimensions,
  type CropState,
} from "@/src/crop/crop-utils";
import { useCreatePostStore } from "@/lib/stores/create-post-store";
import type { MediaAsset } from "@/lib/hooks/use-media-picker";
import {
  createInitialEditState,
  editReducer,
  getAspectRatioValue,
  type EditState,
} from "@/src/crop/edit-state";
import { EditToolbar } from "@/src/crop/EditToolbar";
import { exportImage } from "@/src/crop/export-pipeline";

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

  // Store crop state per image (legacy compat — still used for basic pan/zoom)
  const cropStates = useRef<Map<string, CropState>>(new Map());

  // Non-destructive EditState per image (rotate, straighten, flip, aspect, output)
  const editStatesRef = useRef<Map<string, EditState>>(new Map());
  // Active image's EditState managed via reducer for reactive UI
  const [editState, editDispatch] = useReducer(
    editReducer,
    createInitialEditState("", 1080, 1080),
  );

  // ViewRefs from ImageCropView for export-time readback of shared values
  const viewRefsRef = useRef<ViewRefs | null>(null);
  const handleViewRef = useCallback((refs: ViewRefs) => {
    viewRefsRef.current = refs;
  }, []);

  // Dynamic aspect ratio (default: feed 4:5, stories pass 9:16)
  const [baseAspectRatio, setBaseAspectRatio] = useState(CROP_ASPECT_RATIO);
  const onCompleteRef = useRef<((cropped: MediaAsset[]) => void) | undefined>(
    undefined,
  );

  const { selectedMedia, setSelectedMedia } = useCreatePostStore();

  // Compute effective aspect ratio from EditState aspect preset
  const activeMedia = media[activeIndex];
  const activeDims = activeMedia ? dimensions.get(activeMedia.id) : null;
  const effectiveAspectRatio = (() => {
    if (!activeDims) return baseAspectRatio;
    const val = getAspectRatioValue(
      editState.aspect,
      activeDims.width,
      activeDims.height,
    );
    return val ?? baseAspectRatio;
  })();
  const frameHeight = Math.round(FRAME_WIDTH * effectiveAspectRatio);

  // Consume pending crop data on mount
  useEffect(() => {
    const pending = consumePendingCrop();
    if (!pending.media || pending.media.length === 0) {
      router.back();
      return;
    }

    const images = pending.media.filter((m) => m.type === "image");
    if (images.length === 0) {
      router.back();
      return;
    }

    if (pending.aspectRatio) setBaseAspectRatio(pending.aspectRatio);
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
            dimMap.set(img.id, { width: 1080, height: 1080 });
          }
        }
      }
      setDimensions(dimMap);
      setIsLoading(false);

      // Initialize EditState for first image
      if (images.length > 0) {
        const first = images[0];
        const firstDims = dimMap.get(first.id) || { width: 1080, height: 1080 };
        const sourceUri = first.originalUri || first.uri;
        const initial = createInitialEditState(
          sourceUri,
          firstDims.width,
          firstDims.height,
        );
        editStatesRef.current.set(first.id, initial);
        editDispatch({ type: "RESET" }); // sync reducer
      }
    };

    resolveDimensions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync EditState when switching active image
  useEffect(() => {
    if (!activeMedia || !activeDims) return;
    // Save current edit state for previous image
    // (editState is always the latest for the current active image)
    // Load or create edit state for new active image
    const existing = editStatesRef.current.get(activeMedia.id);
    if (existing) {
      // Restore — reset reducer to this state
      editDispatch({ type: "RESET" });
      // Apply stored values
      editDispatch({ type: "SET_ASPECT", aspect: existing.aspect });
      if (existing.rotate90 !== 0) {
        for (let i = 0; i < existing.rotate90 / 90; i++) {
          editDispatch({ type: "ROTATE_CW" });
        }
      }
      if (existing.straighten !== 0) {
        editDispatch({ type: "SET_STRAIGHTEN", degrees: existing.straighten });
      }
      if (existing.flipX) editDispatch({ type: "FLIP_X" });
    } else {
      const sourceUri = activeMedia.originalUri || activeMedia.uri;
      const initial = createInitialEditState(
        sourceUri,
        activeDims.width,
        activeDims.height,
      );
      editStatesRef.current.set(activeMedia.id, initial);
      editDispatch({ type: "RESET" });
    }
  }, [activeIndex, activeMedia?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist edit state changes back to ref map
  useEffect(() => {
    if (activeMedia) {
      editStatesRef.current.set(activeMedia.id, {
        ...editState,
        sourceUri: activeMedia.originalUri || activeMedia.uri,
        sourceSize: activeDims
          ? { w: activeDims.width, h: activeDims.height }
          : editState.sourceSize,
      });
    }
  }, [editState, activeMedia, activeDims]);

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
        const imgEditState = editStatesRef.current.get(img.id);
        const cropState = cropStates.current.get(img.id);

        // Build a complete EditState for this image
        const state: EditState =
          imgEditState ||
          createInitialEditState(sourceUri, dims.width, dims.height);
        // Override sourceUri to use original
        state.sourceUri = sourceUri;
        state.sourceSize = { w: dims.width, h: dims.height };

        // Compute the effective aspect for this image's frame height
        const imgAspectVal = getAspectRatioValue(
          state.aspect,
          dims.width,
          dims.height,
        );
        const imgFrameH = Math.round(
          FRAME_WIDTH * (imgAspectVal ?? baseAspectRatio),
        );

        // Read view transform from cropState or viewRefs
        const vs =
          cropState?.scale ??
          Math.max(FRAME_WIDTH / dims.width, imgFrameH / dims.height);
        const vtx = cropState?.translateX ?? 0;
        const vty = cropState?.translateY ?? 0;

        // Export through the pipeline
        const result = await exportImage(
          state,
          FRAME_WIDTH,
          imgFrameH,
          vs,
          vtx,
          vty,
        );

        croppedResults.push({
          ...img,
          uri: result.uri,
          originalUri: sourceUri,
          width: result.width,
          height: result.height,
          cropState: { scale: vs, translateX: vtx, translateY: vty },
        });
      }

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
    baseAspectRatio,
  ]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleReset = useCallback(() => {
    if (activeMedia) {
      cropStates.current.delete(activeMedia.id);
      editDispatch({ type: "RESET" });
      // Force re-render by toggling active index
      const idx = activeIndex;
      setActiveIndex(-1);
      requestAnimationFrame(() => setActiveIndex(idx));
    }
  }, [activeMedia, activeIndex]);

  // Configure native header — matches app-wide pattern
  const headerTitle =
    media.length > 1 ? `Crop (${activeIndex + 1}/${media.length})` : "Crop";

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: headerTitle,
      headerTitleAlign: "center" as const,
      headerStyle: { backgroundColor: "#000" },
      headerTitleStyle: {
        color: "#fff",
        fontWeight: "600" as const,
        fontSize: 17,
      },
      headerShadowVisible: false,
      headerLeft: () => (
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={{
            marginLeft: 4,
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
      ),
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={handleReset}
            hitSlop={12}
            style={{
              width: 40,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RotateCcw size={20} color="#999" />
          </Pressable>
          <Pressable
            onPress={handleDone}
            disabled={isProcessing}
            hitSlop={12}
            style={{
              height: 44,
              paddingHorizontal: 8,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#3EA4E5" />
            ) : (
              <Text
                style={{ color: "#3EA4E5", fontSize: 16, fontWeight: "700" }}
              >
                Done
              </Text>
            )}
          </Pressable>
        </View>
      ),
    });
  }, [
    navigation,
    headerTitle,
    handleBack,
    handleReset,
    handleDone,
    isProcessing,
  ]);

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
              marginTop: 16,
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
    <View style={[styles.screen, { backgroundColor: "#000" }]}>
      {/* Crop view */}
      {activeDims && activeSourceUri ? (
        <ImageCropView
          key={`${activeMedia!.id}-${activeIndex}-${editState.rotate90}`}
          uri={activeSourceUri}
          imageWidth={activeDims.width}
          imageHeight={activeDims.height}
          frameWidth={FRAME_WIDTH}
          aspectRatio={effectiveAspectRatio}
          initialState={cropStates.current.get(activeMedia!.id)}
          onCropChange={handleCropChange}
          rotate90={editState.rotate90}
          straighten={editState.straighten}
          flipX={editState.flipX}
          onViewRef={handleViewRef}
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

      {/* Controls below crop frame */}
      <ScrollView
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
        contentContainerStyle={{ paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Edit toolbar: aspect chips, rotate, flip, straighten, resize, undo/redo */}
        <EditToolbar state={editState} dispatch={editDispatch} />

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
      </ScrollView>

      {/* Processing overlay */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color="#3EA4E5" />
            <Text style={styles.processingText}>Generating crops...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
