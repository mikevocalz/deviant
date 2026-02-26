// ============================================================
// Instagram Stories Editor - Main Editor Screen
// ============================================================
//
// Orchestrates all editor components: canvas, toolbars, panels.
// Receives mediaUri + mediaType as props and manages the full
// editing workflow.
// ============================================================

import React, { useCallback, useRef, useMemo, useEffect } from "react";
import { View, StatusBar, Alert } from "react-native";
import { useUIStore } from "@/lib/stores/ui-store";
import { useCanvasRef } from "@shopify/react-native-skia";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Haptics from "expo-haptics";
import { ImageFormat } from "@shopify/react-native-skia";
import {
  useEditorStore,
  useSelectedElement,
  useCanUndo,
  useCanRedo,
  useHasElements,
} from "../stores/editor-store";
import {
  EffectFilter,
  DRAWING_TOOL_CONFIG,
  STORY_BACKGROUNDS,
} from "../constants";
import { ElementGestureOverlay } from "../components/gestures/ElementGestureOverlay";
import {
  EditorCanvas,
  RightIslandMenu,
  BottomActionBar,
  TopNavBar,
  DrawingToolbar,
  TextEditor,
  StickerPicker,
  FilterSelector,
  AdjustmentPanel,
  BackgroundPicker,
} from "../components";
import { ToolPanelContainer } from "../components/panels/ToolPanelContainer";
import { PerfHUD } from "../components/canvas/PerfHUD";
import {
  DrawingPath,
  Position,
  TextElement,
  FilterAdjustment,
  EditorMode,
} from "../types";
import { generateId } from "../utils/helpers";
import { useRenderSurface, screenToCanvas } from "../utils/geometry";

// ---- Props ----

interface EditorScreenProps {
  mediaUri: string;
  mediaType: "image" | "video";
  onClose: () => void;
  onSave?: (editedUri: string) => void;
  initialMode?: EditorMode;
}

// ---- Component ----

export const EditorScreen: React.FC<EditorScreenProps> = ({
  mediaUri,
  mediaType,
  onClose,
  onSave,
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

  // All UI state from Zustand store (no useState)
  const selectedEffectId = useEditorStore((s) => s.selectedEffectId);
  const setSelectedEffectId = useEditorStore((s) => s.setSelectedEffectId);
  const canvasBackgroundId = useEditorStore((s) => s.canvasBackground);
  const setCanvasBackgroundId = useEditorStore((s) => s.setCanvasBackground);
  const showPerfHUD = useEditorStore((s) => s.showPerfHUD);

  // ---- Geometry: single source of truth (reactive to screen changes) ----
  const surface = useRenderSurface();

  const drawingTool = useEditorStore((s) => s.drawingTool);
  const setDrawingTool = useEditorStore((s) => s.setDrawingTool);
  const drawingColor = useEditorStore((s) => s.drawingColor);
  const setDrawingColor = useEditorStore((s) => s.setDrawingColor);
  const strokeWidth = useEditorStore((s) => s.strokeWidth);
  const setStrokeWidth = useEditorStore((s) => s.setStrokeWidth);

  // Resolve background object from ID
  const canvasBackground = useMemo(
    () =>
      STORY_BACKGROUNDS.find((b) => b.id === canvasBackgroundId) ??
      STORY_BACKGROUNDS[0],
    [canvasBackgroundId],
  );

  const handleSelectEffect = useCallback(
    (effect: EffectFilter) => {
      if (selectedEffectId === effect.id) {
        setSelectedEffectId(null);
        setFilter(null);
      } else {
        setSelectedEffectId(effect.id);
        setFilter({
          id: effect.id,
          name: effect.name,
          matrix: effect.matrix,
          intensity: effect.intensity,
        });
      }
    },
    [selectedEffectId, setFilter, setSelectedEffectId],
  );

  // Canvas ref for snapshot export
  const canvasRef = useCanvasRef();

  // Live stroke points — ref-based to avoid per-point React re-renders
  const currentPathPoints = useRef<Position[]>([]);
  const liveStrokePointsRef = useRef<Position[]>([]);
  // We need a render trigger for the canvas to pick up live stroke changes
  const liveStrokeVersion = useRef(0);
  const [, forceRender] = React.useReducer((x: number) => x + 1, 0);

  // Set initial media
  React.useEffect(() => {
    setMedia(mediaUri, mediaType);
  }, [mediaUri, mediaType, setMedia]);

  // [REGRESSION LOCK] Apply initialMode immediately after first layout frame.
  // rAF ensures layout is committed before mode change triggers panel mount.
  const initialModeApplied = useRef(false);
  React.useEffect(() => {
    if (initialMode && !initialModeApplied.current) {
      initialModeApplied.current = true;
      requestAnimationFrame(() => {
        useEditorStore.getState().setMode(initialMode);
      });
    }
  }, [initialMode]);

  // ---- Drawing Handlers ----

  const handlePathStart = useCallback((point: Position) => {
    currentPathPoints.current = [point];
    liveStrokePointsRef.current = [point];
    forceRender();
  }, []);

  const handlePathUpdate = useCallback((point: Position) => {
    currentPathPoints.current.push(point);
    liveStrokePointsRef.current = currentPathPoints.current;
    // Trigger canvas update every few points
    if (currentPathPoints.current.length % 3 === 0) {
      forceRender();
    }
  }, []);

  const handlePathEnd = useCallback(() => {
    liveStrokePointsRef.current = [];
    forceRender();
    if (currentPathPoints.current.length < 2) return;

    const {
      drawingTool: tool,
      drawingColor: color,
      strokeWidth: sw,
    } = useEditorStore.getState();
    const toolConfig = DRAWING_TOOL_CONFIG[tool];
    const path: DrawingPath = {
      id: generateId(),
      points: [...currentPathPoints.current],
      color: color,
      strokeWidth: sw,
      tool: tool,
      opacity: toolConfig.opacity,
    };

    addDrawingPath(path);
    currentPathPoints.current = [];
  }, [addDrawingPath]);

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

  const setExportStatus = useEditorStore((s) => s.setExportStatus);
  const setExportArtifact = useEditorStore((s) => s.setExportArtifact);
  const setExportError = useEditorStore((s) => s.setExportError);

  /**
   * Capture the Skia canvas as a PNG file.
   * makeImageSnapshot() captures the FULL scene graph (media + filters +
   * adjustments + drawing + stickers + text) — it's WYSIWYG by definition
   * because it snapshots exactly what the Canvas component renders.
   */
  const captureCanvas = useCallback(async (): Promise<string | null> => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn("[Editor] Canvas ref not mounted");
      return null;
    }

    // Deselect so selection border doesn't appear in snapshot
    useEditorStore.getState().selectElement(null);

    // Double-flush: rAF then short delay to ensure Skia scene graph is committed
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => setTimeout(r, 80));

    const trySnapshot = () => {
      try {
        const image = canvas.makeImageSnapshot();
        if (!image) {
          console.warn("[Editor] makeImageSnapshot returned null");
          return null;
        }
        const w = image.width();
        const h = image.height();
        if (w === 0 || h === 0) {
          console.warn(`[Editor] Snapshot has zero dimensions: ${w}x${h}`);
          return null;
        }
        if (__DEV__) console.log(`[Editor] Snapshot OK: ${w}x${h}`);
        return image;
      } catch (e) {
        console.warn("[Editor] makeImageSnapshot threw:", e);
        return null;
      }
    };

    try {
      let image = trySnapshot();
      if (!image) {
        await new Promise<void>((r) => setTimeout(r, 200));
        image = trySnapshot();
      }
      if (!image) {
        console.warn("[Editor] makeImageSnapshot returned null after retry");
        return null;
      }

      let base64: string | null = null;
      try {
        base64 = image.encodeToBase64(ImageFormat.PNG, 100);
      } catch {
        try {
          base64 = image.encodeToBase64();
        } catch (e2) {
          console.warn("[Editor] encodeToBase64 threw:", e2);
        }
      }
      if (!base64 || base64.length === 0) {
        console.warn("[Editor] encodeToBase64 returned empty");
        return null;
      }

      const file = new FileSystem.File(
        FileSystem.Paths.cache,
        `story_${Date.now()}.png`,
      );
      file.write(base64, { encoding: "base64" });
      if (__DEV__) {
        console.log(
          "[Editor] Canvas captured to",
          file.uri,
          `(${image.width()}x${image.height()}, ${(base64.length / 1024).toFixed(0)}KB b64)`,
        );
      }
      return file.uri;
    } catch (err) {
      console.error("[Editor] Capture failed:", err);
      return null;
    }
  }, [canvasRef]);

  /**
   * Render the final artifact and store it in the export session.
   * Used by both "Done" (navigate to review) and "Save" (direct save).
   */
  const renderFinalArtifact = useCallback(async () => {
    const currentStatus = useEditorStore.getState().exportSession.status;
    if (currentStatus === "rendering") return; // idempotent
    setExportStatus("rendering");
    try {
      const uri = await captureCanvas();
      if (!uri) {
        setExportError("Failed to capture canvas snapshot");
        return null;
      }
      const artifact = {
        uri,
        type: "image" as const,
        width: surface.displayW,
        height: surface.displayH,
      };
      setExportArtifact(artifact);
      return artifact;
    } catch (err) {
      setExportError((err as Error).message);
      return null;
    }
  }, [
    captureCanvas,
    surface,
    setExportStatus,
    setExportArtifact,
    setExportError,
  ]);

  /**
   * Save the current export artifact (or render one first) to the photo library.
   */
  const showToast = useUIStore((s) => s.showToast);

  const handleSaveToLibrary = useCallback(async () => {
    let artifact = useEditorStore.getState().exportSession.artifact;
    if (!artifact) {
      const rendered = await renderFinalArtifact();
      if (!rendered) {
        showToast("error", "Error", "Failed to render story.");
        return;
      }
      artifact = rendered;
    }
    setExportStatus("saving");
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        showToast(
          "warning",
          "Permission",
          "Media library permission is required to save.",
        );
        setExportStatus("ready");
        return;
      }
      await MediaLibrary.saveToLibraryAsync(artifact.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setExportStatus("saved");
      showToast("success", "Saved", "Image saved to your gallery.");
    } catch (err) {
      console.error("[Editor] Save to gallery failed:", err);
      setExportError("Failed to save to gallery");
      showToast("error", "Error", "Failed to save image.");
    }
  }, [renderFinalArtifact, setExportStatus, setExportError, showToast]);

  /**
   * "Done" / navigate back — renders artifact, passes URI to parent.
   */
  const handleSave = useCallback(async () => {
    const rendered = await renderFinalArtifact();
    if (!rendered) {
      showToast(
        "error",
        "Export Failed",
        "Could not render your story. Try again.",
      );
      return; // Stay in editor — don't navigate away and lose work
    }
    onSave?.(rendered.uri);
  }, [onSave, renderFinalArtifact, showToast]);

  // ---- Close ----

  const hasAnyEdits =
    hasElements ||
    currentFilter !== null ||
    Object.values(adjustments).some((v) => v !== 0);

  const handleClose = useCallback(() => {
    if (hasAnyEdits) {
      Alert.alert("Discard Changes?", "You have unsaved edits.", [
        { text: "Keep Editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: onClose },
      ]);
    } else {
      onClose();
    }
  }, [hasAnyEdits, onClose]);

  // ---- Drawing-only gesture (canvas-wide pan for freehand drawing) ----

  // Wrappers that convert screen→canvas coords on JS thread
  const onDrawStart = useCallback(
    (sx: number, sy: number) => {
      handlePathStart(screenToCanvas(sx, sy, surface));
    },
    [handlePathStart, surface],
  );
  const onDrawUpdate = useCallback(
    (sx: number, sy: number) => {
      handlePathUpdate(screenToCanvas(sx, sy, surface));
    },
    [handlePathUpdate, surface],
  );

  const drawingPanGesture = Gesture.Pan()
    .enabled(mode === "drawing")
    .minDistance(0)
    .onStart((e) => {
      "worklet";
      runOnJS(onDrawStart)(e.x, e.y);
    })
    .onUpdate((e) => {
      "worklet";
      runOnJS(onDrawUpdate)(e.x, e.y);
    })
    .onEnd(() => {
      "worklet";
      runOnJS(handlePathEnd)();
    });

  // Tap on canvas background deselects any selected element
  const deselectIfIdle = useCallback(() => {
    if (useEditorStore.getState().mode === "idle") {
      selectElement(null);
    }
  }, [selectElement]);

  const deselectTap = Gesture.Tap().onEnd(() => {
    "worklet";
    runOnJS(deselectIfIdle)();
  });

  const canvasGesture = Gesture.Race(drawingPanGesture, deselectTap);

  // ---- Per-element gesture overlay handlers ----
  const handleElementTransformEnd = useCallback(
    (
      id: string,
      transform: {
        translateX: number;
        translateY: number;
        scale: number;
        rotation: number;
      },
    ) => {
      updateElement(id, { transform } as any);
    },
    [updateElement],
  );

  const handleElementDoubleTap = useCallback(
    (id: string) => {
      const el = elements.find((e) => e.id === id);
      if (el?.type === "text") {
        selectElement(id);
        setMode("text");
      }
    },
    [elements, selectElement, setMode],
  );

  // Compute element sizes for gesture overlay hit areas
  // CRITICAL: Enforce minimum so pinch/rotate is always possible
  const MIN_HIT = 200; // canvas-px — ~72px on screen, comfortable for 2-finger gestures
  const getElementSize = useCallback((el: (typeof elements)[0]) => {
    if (el.type === "sticker") {
      const size = Math.max((el as any).size || 250, MIN_HIT);
      return { width: size, height: size };
    }
    if (el.type === "text") {
      const maxW = (el as any).maxWidth || 400;
      const fontSize = (el as any).fontSize || 48;
      return {
        width: Math.max(maxW, MIN_HIT),
        height: Math.max(fontSize * 2, MIN_HIT),
      };
    }
    return { width: MIN_HIT, height: MIN_HIT };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar hidden />

      {/* ---- Main Canvas ---- */}
      <GestureDetector gesture={canvasGesture}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <EditorCanvas
            canvasRef={canvasRef}
            mediaUri={storeMediaUri}
            mediaType={storeMediaType}
            elements={elements}
            drawingPaths={drawingPaths}
            currentFilter={currentFilter}
            adjustments={adjustments}
            selectedElementId={selectedElementId}
            videoCurrentTime={videoCurrentTime}
            isPlaying={isPlaying}
            canvasBackground={canvasBackground}
            liveStrokePoints={liveStrokePointsRef.current}
            liveStrokeColor={drawingColor}
            liveStrokeWidth={strokeWidth}
            showDebugOverlay={showPerfHUD}
          />
        </View>
      </GestureDetector>

      {/* ---- Per-element gesture overlays (wcandillon pattern) ---- */}
      {/* Active in all modes except drawing (so you can move stickers while panels are open) */}
      {mode !== "drawing" &&
        mode !== "text" &&
        elements.map((el) => {
          const size = getElementSize(el);
          return (
            <ElementGestureOverlay
              key={el.id}
              elementId={el.id}
              elementType={el.type}
              elementWidth={size.width}
              elementHeight={size.height}
              surface={surface}
              isSelected={el.id === selectedElementId}
              initialTransform={el.transform}
              onSelect={selectElement}
              onTransformEnd={handleElementTransformEnd}
              onDoubleTap={handleElementDoubleTap}
            />
          );
        })}

      {/* ---- Top Navigation ---- */}
      <TopNavBar
        onClose={handleClose}
        mode={mode}
        onDone={mode === "drawing" ? () => setMode("idle") : undefined}
      />

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

      {/* ---- Right Island Menu — ALWAYS visible (not just idle) ---- */}
      <RightIslandMenu
        mode={mode}
        onModeChange={setMode}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      {/* ---- Drawing Toolbar (overlay at bottom — thin bar) ---- */}
      {mode === "drawing" && (
        <DrawingToolbar
          selectedTool={drawingTool}
          selectedColor={drawingColor}
          strokeWidth={strokeWidth}
          onToolChange={(tool: string) => {
            setDrawingTool(tool as any);
          }}
          onColorChange={setDrawingColor}
          onStrokeWidthChange={setStrokeWidth}
          onUndo={undoLastPath}
          onClear={clearDrawing}
          onDone={() => setMode("idle")}
        />
      )}

      {/* ---- Text Editor (fullscreen overlay) ---- */}
      {mode === "text" && (
        <TextEditor
          element={
            selectedElement?.type === "text"
              ? (selectedElement as TextElement)
              : null
          }
          onAdd={handleAddText}
          onUpdate={handleUpdateText}
          onRemove={removeElement}
          onDone={() => setMode("idle")}
          onCancel={() => setMode("idle")}
        />
      )}

      {/* ---- Sticker Panel (overlay, not modal sheet) ---- */}
      <ToolPanelContainer
        visible={mode === "sticker"}
        onDismiss={() => setMode("idle")}
        heightRatio={0.45}
      >
        <StickerPicker
          onSelectSticker={handleSelectSticker}
          onSelectImageSticker={handleSelectImageSticker}
          onClose={() => setMode("idle")}
        />
      </ToolPanelContainer>

      {/* ---- Filter Panel (overlay) ---- */}
      <ToolPanelContainer
        visible={mode === "filter"}
        onDismiss={() => setMode("idle")}
        heightRatio={0.42}
      >
        <FilterSelector
          currentFilter={currentFilter}
          onSelectFilter={(f) => {
            setSelectedEffectId(null);
            setFilter(f);
          }}
          onSelectEffect={handleSelectEffect}
          selectedEffectId={selectedEffectId}
          mediaUri={storeMediaUri}
          onDone={() => setMode("idle")}
        />
      </ToolPanelContainer>

      {/* ---- Adjustment Panel (overlay) ---- */}
      <ToolPanelContainer
        visible={mode === "adjust"}
        onDismiss={() => setMode("idle")}
        heightRatio={0.55}
      >
        <AdjustmentPanel
          adjustments={adjustments}
          onAdjustmentChange={handleAdjustmentChange}
          onReset={resetAdjustments}
          onDone={() => setMode("idle")}
        />
      </ToolPanelContainer>

      {/* ---- Background Picker (shown in idle when no media — text-only stories) ---- */}
      {mode === "idle" && !storeMediaUri && (
        <BackgroundPicker
          selectedId={canvasBackground.id}
          onSelect={(bg: any) => setCanvasBackgroundId(bg.id)}
        />
      )}

      {/* ---- Bottom Action Bar ---- */}
      <BottomActionBar
        mode={mode}
        onDone={handleSave}
        onPickMedia={handlePickMedia}
        onSaveToLibrary={handleSaveToLibrary}
        hasMedia={!!storeMediaUri}
        hasElements={hasElements}
      />
    </View>
  );
};
