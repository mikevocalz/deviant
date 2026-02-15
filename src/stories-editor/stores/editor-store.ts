// ============================================================
// Stories Editor - Zustand Store
// ============================================================
// Replaces useReducer-based state. Persists across navigations
// so stickers/drawings/text survive going back and re-entering.
// ============================================================

import { create } from "zustand";
import {
  EditorState,
  EditorMode,
  CanvasElement,
  TextElement,
  StickerElement,
  DrawingPath,
  LUTFilter,
  FilterAdjustment,
  TextStylePreset,
} from "../types";
import { DEFAULT_ADJUSTMENTS, CANVAS_WIDTH, CANVAS_HEIGHT } from "../constants";
import { generateId, getNextZIndex } from "../utils/helpers";

// ---- Store Interface ----

interface EditorStore extends EditorState {
  // Mode
  setMode: (mode: EditorMode) => void;
  // Media
  setMedia: (uri: string, mediaType: "image" | "video") => void;
  // Elements
  addTextElement: (options?: Partial<TextElement>) => string;
  addStickerElement: (source: string | number, size?: number) => string;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  removeElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  // Drawing
  addDrawingPath: (path: DrawingPath) => void;
  undoLastPath: () => void;
  clearDrawing: () => void;
  // Filters
  setFilter: (filter: LUTFilter | null) => void;
  setAdjustments: (adjustments: Partial<FilterAdjustment>) => void;
  resetAdjustments: () => void;
  // Video
  setVideoTime: (time: number) => void;
  setVideoDuration: (duration: number) => void;
  togglePlay: () => void;
  // History
  undo: () => void;
  redo: () => void;
  clearAll: () => void;
  // Reset (for new editing sessions)
  resetEditor: () => void;
}

// All element positions are in canvas coordinates (1080×1920).
// The Skia Canvas scales them to display size via a root Group transform.

// ---- Initial State (data only) ----

const initialEditorData: EditorState = {
  mode: "idle",
  elements: [],
  selectedElementId: null,
  drawingPaths: [],
  currentFilter: null,
  adjustments: DEFAULT_ADJUSTMENTS,
  mediaUri: null,
  mediaType: "image",
  videoDuration: 0,
  videoCurrentTime: 0,
  isPlaying: false,
  canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
  undoStack: [],
  redoStack: [],
};

// ---- Store ----

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...initialEditorData,

  // ---- Mode ----
  setMode: (mode) =>
    set({
      mode,
      selectedElementId: mode === "drawing" ? null : get().selectedElementId,
    }),

  // ---- Media ----
  setMedia: (uri, mediaType) => set({ mediaUri: uri, mediaType }),

  // ---- Elements ----
  addTextElement: (options) => {
    const id = generateId();
    const element: TextElement = {
      id,
      type: "text",
      content: "Tap to edit",
      fontFamily: "System",
      fontSize: 48,
      color: "#FFFFFF",
      textAlign: "center",
      style: "classic" as TextStylePreset,
      maxWidth: CANVAS_WIDTH * 0.8,
      opacity: 1,
      zIndex: getNextZIndex(get().elements),
      transform: {
        translateX: CANVAS_WIDTH / 2,
        translateY: CANVAS_HEIGHT / 2,
        scale: 1,
        rotation: 0,
      },
      ...options,
    };
    set((s) => ({
      elements: [...s.elements, element],
      selectedElementId: id,
      undoStack: [...s.undoStack, s.elements],
      redoStack: [],
    }));
    return id;
  },

  addStickerElement: (source, size = 120) => {
    const id = generateId();
    const element: StickerElement = {
      id,
      type: "sticker",
      source,
      category: "emoji",
      size,
      opacity: 1,
      zIndex: getNextZIndex(get().elements),
      transform: {
        translateX: CANVAS_WIDTH / 2,
        translateY: CANVAS_HEIGHT / 2,
        scale: 1,
        rotation: 0,
      },
    };
    set((s) => ({
      elements: [...s.elements, element],
      selectedElementId: id,
      undoStack: [...s.undoStack, s.elements],
      redoStack: [],
    }));
    return id;
  },

  updateElement: (id, updates) =>
    set((s) => ({
      elements: s.elements.map((el) =>
        el.id === id ? ({ ...el, ...updates } as CanvasElement) : el,
      ),
    })),

  removeElement: (id) =>
    set((s) => ({
      elements: s.elements.filter((el) => el.id !== id),
      selectedElementId:
        s.selectedElementId === id ? null : s.selectedElementId,
      undoStack: [...s.undoStack, s.elements],
      redoStack: [],
    })),

  selectElement: (id) => set({ selectedElementId: id }),

  // ---- Drawing ----
  addDrawingPath: (path) =>
    set((s) => ({
      drawingPaths: [...s.drawingPaths, path],
      undoStack: [...s.undoStack, s.elements],
      redoStack: [],
    })),

  undoLastPath: () =>
    set((s) => ({
      drawingPaths: s.drawingPaths.slice(0, -1),
    })),

  clearDrawing: () => set({ drawingPaths: [] }),

  // ---- Filters ----
  setFilter: (filter) => set({ currentFilter: filter }),

  setAdjustments: (adj) =>
    set((s) => ({
      adjustments: { ...s.adjustments, ...adj },
    })),

  resetAdjustments: () => set({ adjustments: DEFAULT_ADJUSTMENTS }),

  // ---- Video ----
  setVideoTime: (time) => set({ videoCurrentTime: time }),
  setVideoDuration: (duration) => set({ videoDuration: duration }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  // ---- History ----
  undo: () =>
    set((s) => {
      if (s.undoStack.length === 0) return s;
      const prev = s.undoStack[s.undoStack.length - 1];
      return {
        elements: prev,
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, s.elements],
      };
    }),

  redo: () =>
    set((s) => {
      if (s.redoStack.length === 0) return s;
      const next = s.redoStack[s.redoStack.length - 1];
      return {
        elements: next,
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, s.elements],
      };
    }),

  clearAll: () =>
    set((s) => ({
      ...initialEditorData,
      mediaUri: s.mediaUri,
      mediaType: s.mediaType,
    })),

  // ---- Full Reset (new session) ----
  resetEditor: () => set(initialEditorData),
}));

// ---- Derived selectors (use outside component or with useEditorStore) ----

export const useSelectedElement = () =>
  useEditorStore(
    (s) => s.elements.find((el) => el.id === s.selectedElementId) ?? null,
  );

export const useCanUndo = () => useEditorStore((s) => s.undoStack.length > 0);

export const useCanRedo = () => useEditorStore((s) => s.redoStack.length > 0);

export const useHasElements = () =>
  useEditorStore((s) => s.elements.length > 0 || s.drawingPaths.length > 0);
