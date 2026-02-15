// ============================================================
// Instagram Stories Editor - Main Editor Screen
// ============================================================
//
// Orchestrates all editor components: canvas, toolbars, panels.
// Receives mediaUri + mediaType as props and manages the full
// editing workflow.
// ============================================================

import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import { View, StyleSheet, StatusBar, Alert } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetModalProvider,
} from "@gorhom/bottom-sheet";
import * as ImagePicker from "expo-image-picker";
// Simple ref-based throttle (no external deps)
function createThrottle<T extends (...args: any[]) => void>(
  fn: T,
  wait: number,
) {
  let lastTime = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastTime >= wait) {
      lastTime = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(
        () => {
          lastTime = Date.now();
          timer = null;
          fn(...args);
        },
        wait - (now - lastTime),
      );
    }
  };
  throttled.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return throttled;
}

import {
  useEditorStore,
  useSelectedElement,
  useCanUndo,
  useCanRedo,
  useHasElements,
} from "../stores/editor-store";
import { useCubeLUT } from "../hooks/useCubeLUT";
// useDrawingGestures removed — drawing handled by unified pan gesture
import {
  EditorCanvas,
  MainToolbar,
  BottomActionBar,
  TopNavBar,
  DrawingToolbar,
  TextEditor,
  StickerPicker,
  FilterSelector,
  AdjustmentPanel,
  BackgroundPicker,
} from "../components";
import { PerfHUD } from "../components/canvas/PerfHUD";
import {
  DrawingTool,
  DrawingPath,
  Position,
  TextElement,
  FilterAdjustment,
  EditorMode,
} from "../types";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DRAWING_TOOL_CONFIG,
  DRAWING_COLORS,
  STORY_BACKGROUNDS,
  StoryBackground,
} from "../constants";
import { generateId } from "../utils/helpers";
import {
  computeRenderSurface,
  screenToCanvas,
  deltaToCanvas,
} from "../utils/geometry";

// ---- Props ----

interface EditorScreenProps {
  mediaUri: string;
  mediaType: "image" | "video";
  onClose: () => void;
  onSave?: (editedUri: string) => void;
  onShare?: () => void;
  initialMode?: EditorMode;
}

// ---- Component ----

export const EditorScreen: React.FC<EditorScreenProps> = ({
  mediaUri,
  mediaType,
  onClose,
  onSave,
  onShare,
  initialMode,
}) => {
  // Zustand store — persists across navigations
  const setMode = useEditorStore((s) => s.setMode);
  const setMedia = useEditorStore((s) => s.setMedia);
  const addTextElement = useEditorStore((s) => s.addTextElement);
  const addStickerElement = useEditorStore((s) => s.addStickerElement);
  const updateElement = useEditorStore((s) => s.updateElement);
  const removeElement = useEditorStore((s) => s.removeElement);
  const selectElement = useEditorStore((s) => s.selectElement);
  const addDrawingPath = useEditorStore((s) => s.addDrawingPath);
  const undoLastPath = useEditorStore((s) => s.undoLastPath);
  const clearDrawing = useEditorStore((s) => s.clearDrawing);
  const setFilter = useEditorStore((s) => s.setFilter);
  const setAdjustments = useEditorStore((s) => s.setAdjustments);
  const resetAdjustments = useEditorStore((s) => s.resetAdjustments);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const mode = useEditorStore((s) => s.mode);
  const elements = useEditorStore((s) => s.elements);
  const drawingPaths = useEditorStore((s) => s.drawingPaths);
  const currentFilter = useEditorStore((s) => s.currentFilter);
  const adjustments = useEditorStore((s) => s.adjustments);
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
  const videoCurrentTime = useEditorStore((s) => s.videoCurrentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const storeMediaUri = useEditorStore((s) => s.mediaUri);
  const storeMediaType = useEditorStore((s) => s.mediaType);

  const selectedElement = useSelectedElement();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const hasElements = useHasElements();

  // Cube LUT state
  const {
    lutImage,
    lutSize,
    runtimeEffect,
    isLoading: lutLoading,
    loadLUT,
    clearLUT,
    selectedId: selectedCubeLUTId,
  } = useCubeLUT();

  // Background state (for text-only stories)
  const [canvasBackground, setCanvasBackground] = useState<StoryBackground>(
    STORY_BACKGROUNDS[0],
  );

  // PerfHUD toggle (dev only)
  const [showPerfHUD, setShowPerfHUD] = useState(__DEV__ ? false : false);

  // Canvas ref for snapshot export
  const canvasExportRef = useRef<{ snapshot: () => any }>(null);

  // Drawing state
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("pen");
  const [drawingColor, setDrawingColor] = useState(DRAWING_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(
    DRAWING_TOOL_CONFIG.pen.defaultWidth,
  );
  const currentPathPoints = useRef<Position[]>([]);
  const [liveStrokePoints, setLiveStrokePoints] = useState<Position[]>([]);

  // Set initial media
  React.useEffect(() => {
    setMedia(mediaUri, mediaType);
  }, [mediaUri, mediaType, setMedia]);

  // Apply initialMode after sheets are mounted (needs delay so BottomSheetModal refs exist)
  const initialModeApplied = useRef(false);
  React.useEffect(() => {
    if (initialMode && !initialModeApplied.current) {
      initialModeApplied.current = true;
      const timer = setTimeout(() => {
        setMode(initialMode);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [initialMode, setMode]);

  // ---- Drawing Handlers ----

  const handlePathStart = useCallback((point: Position) => {
    console.log("[Drawing] Path start", point);
    currentPathPoints.current = [point];
    setLiveStrokePoints([point]);
  }, []);

  const handlePathUpdate = useCallback((point: Position) => {
    currentPathPoints.current.push(point);
    // Update live preview every few points to avoid excessive re-renders
    if (currentPathPoints.current.length % 2 === 0) {
      setLiveStrokePoints([...currentPathPoints.current]);
    }
  }, []);

  const handlePathEnd = useCallback(() => {
    console.log(
      "[Drawing] Path end, points:",
      currentPathPoints.current.length,
    );
    setLiveStrokePoints([]);
    if (currentPathPoints.current.length < 2) return;

    const toolConfig = DRAWING_TOOL_CONFIG[drawingTool];
    const path: DrawingPath = {
      id: generateId(),
      points: [...currentPathPoints.current],
      color: drawingColor,
      strokeWidth,
      tool: drawingTool,
      opacity: toolConfig.opacity,
    };

    addDrawingPath(path);
    currentPathPoints.current = [];
  }, [drawingTool, drawingColor, strokeWidth, addDrawingPath]);

  // ---- Text Handlers ----

  const handleAddText = useCallback(
    (options: Partial<TextElement>) => {
      return addTextElement(options);
    },
    [addTextElement],
  );

  const handleUpdateText = useCallback(
    (id: string, updates: Partial<TextElement>) => {
      updateElement(id, updates);
    },
    [updateElement],
  );

  // ---- Sticker Handlers ----

  const handleSelectSticker = useCallback(
    (source: string | number) => {
      console.log(
        "[Editor] Adding sticker:",
        typeof source === "string" ? source.substring(0, 60) : source,
      );
      addStickerElement(source);
      setMode("idle");
    },
    [addStickerElement, setMode],
  );

  const handleSelectImageSticker = useCallback(
    (source: number, _id: string) => {
      console.log("[Editor] Adding image sticker (require ID):", source);
      addStickerElement(source);
      setMode("idle");
    },
    [addStickerElement, setMode],
  );

  // ---- Filter Handlers ----

  const handleAdjustmentChange = useCallback(
    (key: keyof FilterAdjustment, value: number) => {
      setAdjustments({ [key]: value });
    },
    [setAdjustments],
  );

  // ---- Media Picker ----

  const handlePickMedia = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 1,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const type = asset.type === "video" ? "video" : "image";
      setMedia(asset.uri, type as "image" | "video");
    }
  }, [setMedia]);

  // ---- Export / Save ----

  const captureCanvas = useCallback(async (): Promise<string | null> => {
    try {
      // Snapshot captures the Skia Canvas at its rendered pixel size.
      // The scene graph is identical to preview — same filters, layers,
      // transforms — so export content matches preview exactly.
      const image = canvasExportRef.current?.snapshot();
      if (!image) {
        console.warn("[Editor] No snapshot available");
        return null;
      }
      const base64 = image.encodeToBase64();
      const FileSystem = require("expo-file-system");
      const filePath = `${FileSystem.cacheDirectory}story_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(filePath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log(
        "[Editor] Canvas captured to",
        filePath,
        `(${image.width()}x${image.height()})`,
      );
      return filePath;
    } catch (err) {
      console.error("[Editor] Capture failed:", err);
      return null;
    }
  }, []);

  const handleExport = useCallback(async () => {
    const uri = await captureCanvas();
    if (!uri) {
      Alert.alert("Error", "Failed to capture canvas.");
      return;
    }
    try {
      const MediaLibrary = require("expo-media-library");
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission",
          "Media library permission is required to save.",
        );
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Saved!", "Image saved to your gallery.");
    } catch (err) {
      console.error("[Editor] Save to gallery failed:", err);
      Alert.alert("Error", "Failed to save image.");
    }
  }, [captureCanvas]);

  const handleSave = useCallback(async () => {
    if (!hasElements) {
      // No edits — return original
      onSave?.(mediaUri);
      return;
    }
    const uri = await captureCanvas();
    onSave?.(uri || mediaUri);
  }, [mediaUri, onSave, hasElements, captureCanvas]);

  const handleShareToStory = useCallback(async () => {
    onShare?.();
  }, [onShare]);

  // ---- Close ----

  const handleClose = useCallback(() => {
    if (hasElements) {
      Alert.alert("Discard Changes?", "You have unsaved edits.", [
        { text: "Keep Editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: onClose },
      ]);
    } else {
      onClose();
    }
  }, [hasElements, onClose]);

  // ---- Bottom Sheet Refs ----
  const stickerSheetRef = useRef<BottomSheetModal>(null);
  const filterSheetRef = useRef<BottomSheetModal>(null);
  const adjustSheetRef = useRef<BottomSheetModal>(null);

  const stickerSnaps = useMemo(() => ["60%"], []);
  const filterSnaps = useMemo(() => ["42%"], []);
  const adjustSnaps = useMemo(() => ["55%"], []);

  // Present / dismiss sheets based on mode
  useEffect(() => {
    if (mode === "sticker") {
      stickerSheetRef.current?.present();
    } else {
      stickerSheetRef.current?.dismiss();
    }
    if (mode === "filter") {
      filterSheetRef.current?.present();
    } else {
      filterSheetRef.current?.dismiss();
    }
    if (mode === "adjust") {
      adjustSheetRef.current?.present();
    } else {
      adjustSheetRef.current?.dismiss();
    }
  }, [mode]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  // ---- Geometry: single source of truth ----
  const surface = useMemo(() => computeRenderSurface(), []);

  // ---- Unified gesture state ----
  const draggedElementRef = useRef<string | null>(null);
  const dragStartTransform = useRef({ x: 0, y: 0 });
  const pinchStartScale = useRef(1);
  const rotationStartAngle = useRef(0);
  const latestDragTranslation = useRef({ x: 0, y: 0 });
  const latestPinchScale = useRef(1);
  const latestRotation = useRef(0);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const selectedIdRef = useRef(selectedElementId);
  selectedIdRef.current = selectedElementId;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Throttled updaters — commit to store at ~20fps, not 60fps
  const dragThrottled = useRef(
    createThrottle((tx: number, ty: number) => {
      const id = draggedElementRef.current;
      if (!id) return;
      const el = elementsRef.current.find((e) => e.id === id);
      if (!el) return;
      updateElement(id, {
        transform: {
          ...el.transform,
          translateX: dragStartTransform.current.x + tx,
          translateY: dragStartTransform.current.y + ty,
        },
      } as any);
    }, 48),
  ).current;

  const pinchThrottled = useRef(
    createThrottle((scale: number) => {
      const id = selectedIdRef.current;
      if (!id) return;
      const el = elementsRef.current.find((e) => e.id === id);
      if (!el) return;
      const newScale = Math.max(
        0.2,
        Math.min(5, pinchStartScale.current * scale),
      );
      updateElement(id, {
        transform: { ...el.transform, scale: newScale },
      } as any);
    }, 16),
  ).current;

  // ---- Unified Pan start (drawing OR element drag) ----
  const handleUnifiedPanStart = useCallback(
    (x: number, y: number) => {
      if (modeRef.current === "drawing") {
        const canvasPoint = screenToCanvas(x, y, surface);
        handlePathStart(canvasPoint);
        return;
      }
      if (modeRef.current !== "idle") return;

      // Element hit-test in canvas coords
      const cp = screenToCanvas(x, y, surface);
      const sorted = [...elementsRef.current].sort(
        (a, b) => b.zIndex - a.zIndex,
      );
      let foundId: string | null = null;
      for (const el of sorted) {
        const t = el.transform;
        const halfW = el.type === "sticker" ? (el as any).size / 2 : 120;
        const halfH = el.type === "text" ? 60 : halfW;
        if (
          cp.x >= t.translateX - halfW &&
          cp.x <= t.translateX + halfW &&
          cp.y >= t.translateY - halfH &&
          cp.y <= t.translateY + halfH
        ) {
          foundId = el.id;
          break;
        }
      }
      draggedElementRef.current = foundId;
      latestDragTranslation.current = { x: 0, y: 0 };
      if (foundId) {
        const el = elementsRef.current.find((e) => e.id === foundId);
        if (el) {
          dragStartTransform.current = {
            x: el.transform.translateX,
            y: el.transform.translateY,
          };
          selectElement(foundId);
        }
      }
    },
    [handlePathStart, selectElement, surface],
  );

  // ---- Unified Pan update ----
  const handleUnifiedPanUpdate = useCallback(
    (x: number, y: number, translationX: number, translationY: number) => {
      if (modeRef.current === "drawing") {
        const canvasPoint = screenToCanvas(x, y, surface);
        handlePathUpdate(canvasPoint);
        return;
      }
      if (!draggedElementRef.current) return;
      // Convert screen translation → canvas translation
      const delta = deltaToCanvas(translationX, translationY, surface.scale);
      latestDragTranslation.current = { x: delta.dx, y: delta.dy };
      dragThrottled(delta.dx, delta.dy);
    },
    [handlePathUpdate, dragThrottled, surface],
  );

  // ---- Unified Pan end ----
  const handleUnifiedPanEnd = useCallback(() => {
    if (modeRef.current === "drawing") {
      handlePathEnd();
      return;
    }
    const id = draggedElementRef.current;
    if (id) {
      dragThrottled.cancel();
      const el = elementsRef.current.find((e) => e.id === id);
      if (el) {
        const { x, y } = latestDragTranslation.current;
        updateElement(id, {
          transform: {
            ...el.transform,
            translateX: dragStartTransform.current.x + x,
            translateY: dragStartTransform.current.y + y,
          },
        } as any);
      }
    }
    draggedElementRef.current = null;
  }, [handlePathEnd, dragThrottled, updateElement]);

  // ---- Pinch (element resize, idle mode) ----
  const handlePinchStart = useCallback(() => {
    const id = selectedIdRef.current;
    if (id) {
      const el = elementsRef.current.find((e) => e.id === id);
      if (el) pinchStartScale.current = el.transform.scale;
    }
    latestPinchScale.current = 1;
  }, []);

  const handlePinchUpdate = useCallback(
    (scale: number) => {
      if (!selectedIdRef.current) return;
      latestPinchScale.current = scale;
      pinchThrottled(scale);
    },
    [pinchThrottled],
  );

  const handlePinchEnd = useCallback(() => {
    const id = selectedIdRef.current;
    if (id) {
      pinchThrottled.cancel();
      const el = elementsRef.current.find((e) => e.id === id);
      if (el) {
        const newScale = Math.max(
          0.2,
          Math.min(5, pinchStartScale.current * latestPinchScale.current),
        );
        updateElement(id, {
          transform: { ...el.transform, scale: newScale },
        } as any);
      }
    }
  }, [pinchThrottled, updateElement]);

  // ---- Rotation gesture (two-finger twist, idle mode) ----
  const handleRotationStart = useCallback(() => {
    const id = selectedIdRef.current;
    if (id) {
      const el = elementsRef.current.find((e) => e.id === id);
      if (el) rotationStartAngle.current = el.transform.rotation;
    }
    latestRotation.current = 0;
  }, []);

  const handleRotationUpdate = useCallback(
    (radians: number) => {
      if (!selectedIdRef.current) return;
      latestRotation.current = radians;
      const id = selectedIdRef.current;
      const el = elementsRef.current.find((e) => e.id === id);
      if (!el) return;
      const degrees = (radians * 180) / Math.PI;
      updateElement(id, {
        transform: {
          ...el.transform,
          rotation: rotationStartAngle.current + degrees,
        },
      } as any);
    },
    [updateElement],
  );

  const handleRotationEnd = useCallback(() => {
    const id = selectedIdRef.current;
    if (id) {
      const el = elementsRef.current.find((e) => e.id === id);
      if (el) {
        const degrees = (latestRotation.current * 180) / Math.PI;
        updateElement(id, {
          transform: {
            ...el.transform,
            rotation: rotationStartAngle.current + degrees,
          },
        } as any);
      }
    }
  }, [updateElement]);

  // ---- Gesture Composition ----
  const unifiedPanGesture = Gesture.Pan()
    .minDistance(0)
    .onStart((e) => {
      "worklet";
      runOnJS(handleUnifiedPanStart)(e.x, e.y);
    })
    .onUpdate((e) => {
      "worklet";
      runOnJS(handleUnifiedPanUpdate)(e.x, e.y, e.translationX, e.translationY);
    })
    .onEnd(() => {
      "worklet";
      runOnJS(handleUnifiedPanEnd)();
    });

  const elementPinchGesture = Gesture.Pinch()
    .enabled(mode === "idle")
    .onStart(() => {
      "worklet";
      runOnJS(handlePinchStart)();
    })
    .onUpdate((e) => {
      "worklet";
      runOnJS(handlePinchUpdate)(e.scale);
    })
    .onEnd(() => {
      "worklet";
      runOnJS(handlePinchEnd)();
    });

  const elementRotationGesture = Gesture.Rotation()
    .enabled(mode === "idle")
    .onStart(() => {
      "worklet";
      runOnJS(handleRotationStart)();
    })
    .onUpdate((e) => {
      "worklet";
      runOnJS(handleRotationUpdate)(e.rotation);
    })
    .onEnd(() => {
      "worklet";
      runOnJS(handleRotationEnd)();
    });

  // Pan (always) + Pinch + Rotation (idle only)
  const canvasGesture = Gesture.Simultaneous(
    unifiedPanGesture,
    elementPinchGesture,
    elementRotationGesture,
  );

  return (
    <BottomSheetModalProvider>
      <View style={styles.container}>
        <StatusBar hidden />

        {/* ---- Main Canvas ---- */}
        <GestureDetector gesture={canvasGesture}>
          <View style={styles.canvasContainer}>
            <EditorCanvas
              ref={canvasExportRef}
              mediaUri={storeMediaUri}
              mediaType={storeMediaType}
              elements={elements}
              drawingPaths={drawingPaths}
              currentFilter={currentFilter}
              adjustments={adjustments}
              selectedElementId={selectedElementId}
              videoCurrentTime={videoCurrentTime}
              isPlaying={isPlaying}
              cubeLutImage={lutImage}
              cubeLutSize={lutSize}
              cubeLutEffect={runtimeEffect}
              canvasBackground={canvasBackground}
              liveStrokePoints={liveStrokePoints}
              liveStrokeColor={drawingColor}
              liveStrokeWidth={strokeWidth}
            />
          </View>
        </GestureDetector>

        {/* ---- Top Navigation ---- */}
        <TopNavBar onClose={handleClose} mode={mode} />

        {/* ---- Perf HUD (dev only) ---- */}
        <PerfHUD
          visible={showPerfHUD}
          elementCount={elements.length}
          drawingPathCount={drawingPaths.length}
          drawingPointCount={drawingPaths.reduce(
            (sum, p) => sum + p.points.length,
            0,
          )}
        />

        {/* ---- Main Toolbar (right side) ---- */}
        {mode === "idle" && (
          <MainToolbar
            mode={mode}
            onModeChange={setMode}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        )}

        {/* ---- Drawing Toolbar (stays as overlay — thin bar) ---- */}
        {mode === "drawing" && (
          <DrawingToolbar
            selectedTool={drawingTool}
            selectedColor={drawingColor}
            strokeWidth={strokeWidth}
            onToolChange={(tool: DrawingTool) => {
              setDrawingTool(tool);
              setStrokeWidth(DRAWING_TOOL_CONFIG[tool].defaultWidth);
            }}
            onColorChange={setDrawingColor}
            onStrokeWidthChange={setStrokeWidth}
            onUndo={undoLastPath}
            onClear={clearDrawing}
            onDone={() => setMode("idle")}
          />
        )}

        {/* ---- Text Editor (stays as overlay — needs keyboard) ---- */}
        {mode === "text" && (
          <TextEditor
            element={
              selectedElement?.type === "text"
                ? (selectedElement as TextElement)
                : null
            }
            onAdd={handleAddText}
            onUpdate={handleUpdateText}
            onDone={() => setMode("idle")}
            onCancel={() => setMode("idle")}
          />
        )}

        {/* ---- Sticker Picker Sheet ---- */}
        <BottomSheetModal
          ref={stickerSheetRef}
          snapPoints={stickerSnaps}
          onDismiss={() => {
            if (mode === "sticker") setMode("idle");
          }}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={styles.sheetIndicator}
          backgroundStyle={styles.sheetBackground}
          enablePanDownToClose
        >
          <StickerPicker
            onSelectSticker={handleSelectSticker}
            onSelectImageSticker={handleSelectImageSticker}
            onClose={() => setMode("idle")}
          />
        </BottomSheetModal>

        {/* ---- Filter Selector Sheet ---- */}
        <BottomSheetModal
          ref={filterSheetRef}
          snapPoints={filterSnaps}
          onDismiss={() => {
            if (mode === "filter") setMode("idle");
          }}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={styles.sheetIndicator}
          backgroundStyle={styles.sheetBackground}
          enablePanDownToClose
        >
          <FilterSelector
            currentFilter={currentFilter}
            onSelectFilter={setFilter}
            onSelectCubeLUT={loadLUT}
            selectedCubeLUTId={selectedCubeLUTId}
            onDone={() => setMode("idle")}
          />
        </BottomSheetModal>

        {/* ---- Adjustment Panel Sheet ---- */}
        <BottomSheetModal
          ref={adjustSheetRef}
          snapPoints={adjustSnaps}
          onDismiss={() => {
            if (mode === "adjust") setMode("idle");
          }}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={styles.sheetIndicator}
          backgroundStyle={styles.sheetBackground}
          enablePanDownToClose
        >
          <AdjustmentPanel
            adjustments={adjustments}
            onAdjustmentChange={handleAdjustmentChange}
            onReset={resetAdjustments}
            onDone={() => setMode("idle")}
          />
        </BottomSheetModal>

        {/* ---- Background Picker (shown in idle when no media — text-only stories) ---- */}
        {mode === "idle" && !storeMediaUri && (
          <BackgroundPicker
            selectedId={canvasBackground.id}
            onSelect={setCanvasBackground}
          />
        )}

        {/* ---- Bottom Action Bar ---- */}
        <BottomActionBar
          mode={mode}
          onSave={handleSave}
          onShare={handleShareToStory}
          onPickMedia={handlePickMedia}
          hasMedia={!!storeMediaUri}
        />
      </View>
    </BottomSheetModalProvider>
  );
};

// ---- Styles ----

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  canvasContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetBackground: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetIndicator: {
    backgroundColor: "#555",
    width: 36,
    height: 4,
  },
});
