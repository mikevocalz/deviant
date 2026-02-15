// ============================================================
// Instagram Stories Editor - Main Editor State Hook
// ============================================================

import { useCallback, useReducer, useRef } from "react";
import {
  EditorState,
  EditorMode,
  CanvasElement,
  TextElement,
  StickerElement,
  DrawingPath,
  LUTFilter,
  FilterAdjustment,
  Position,
  TextStylePreset,
} from "../types";
import {
  DEFAULT_ADJUSTMENTS,
  LUT_FILTERS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from "../constants";
import { generateId, defaultTransform, getNextZIndex } from "../utils/helpers";

// ---- Action Types ----

type EditorAction =
  | { type: "SET_MODE"; payload: EditorMode }
  | {
      type: "SET_MEDIA";
      payload: { uri: string; mediaType: "image" | "video" };
    }
  | { type: "ADD_ELEMENT"; payload: CanvasElement }
  | {
      type: "UPDATE_ELEMENT";
      payload: { id: string; updates: Partial<CanvasElement> };
    }
  | { type: "REMOVE_ELEMENT"; payload: string }
  | { type: "SELECT_ELEMENT"; payload: string | null }
  | {
      type: "REORDER_ELEMENT";
      payload: { id: string; direction: "up" | "down" };
    }
  | { type: "ADD_DRAWING_PATH"; payload: DrawingPath }
  | { type: "REMOVE_LAST_PATH" }
  | { type: "CLEAR_DRAWING" }
  | { type: "SET_FILTER"; payload: LUTFilter | null }
  | { type: "SET_ADJUSTMENTS"; payload: Partial<FilterAdjustment> }
  | { type: "RESET_ADJUSTMENTS" }
  | { type: "SET_VIDEO_TIME"; payload: number }
  | { type: "SET_VIDEO_DURATION"; payload: number }
  | { type: "TOGGLE_PLAY" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "CLEAR_ALL" };

// ---- Initial State ----

const initialState: EditorState = {
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

// ---- Reducer ----

const editorReducer = (
  state: EditorState,
  action: EditorAction,
): EditorState => {
  switch (action.type) {
    case "SET_MODE":
      return {
        ...state,
        mode: action.payload,
        selectedElementId:
          action.payload === "drawing" ? null : state.selectedElementId,
      };

    case "SET_MEDIA":
      return {
        ...state,
        mediaUri: action.payload.uri,
        mediaType: action.payload.mediaType,
      };

    case "ADD_ELEMENT":
      return {
        ...state,
        elements: [...state.elements, action.payload],
        selectedElementId: action.payload.id,
        undoStack: [...state.undoStack, state.elements],
        redoStack: [],
      };

    case "UPDATE_ELEMENT":
      return {
        ...state,
        elements: state.elements.map((el) =>
          el.id === action.payload.id
            ? ({ ...el, ...action.payload.updates } as CanvasElement)
            : el,
        ),
      };

    case "REMOVE_ELEMENT":
      return {
        ...state,
        elements: state.elements.filter((el) => el.id !== action.payload),
        selectedElementId:
          state.selectedElementId === action.payload
            ? null
            : state.selectedElementId,
        undoStack: [...state.undoStack, state.elements],
        redoStack: [],
      };

    case "SELECT_ELEMENT":
      return {
        ...state,
        selectedElementId: action.payload,
      };

    case "REORDER_ELEMENT": {
      const { id, direction } = action.payload;
      const elements = [...state.elements];
      const index = elements.findIndex((el) => el.id === id);
      if (index === -1) return state;

      const newIndex = direction === "up" ? index + 1 : index - 1;
      if (newIndex < 0 || newIndex >= elements.length) return state;

      [elements[index], elements[newIndex]] = [
        elements[newIndex],
        elements[index],
      ];
      // Update z-indices
      elements.forEach((el, i) => {
        el.zIndex = i + 1;
      });

      return { ...state, elements };
    }

    case "ADD_DRAWING_PATH":
      return {
        ...state,
        drawingPaths: [...state.drawingPaths, action.payload],
        undoStack: [...state.undoStack, state.elements],
        redoStack: [],
      };

    case "REMOVE_LAST_PATH":
      return {
        ...state,
        drawingPaths: state.drawingPaths.slice(0, -1),
      };

    case "CLEAR_DRAWING":
      return {
        ...state,
        drawingPaths: [],
      };

    case "SET_FILTER":
      return {
        ...state,
        currentFilter: action.payload,
      };

    case "SET_ADJUSTMENTS":
      return {
        ...state,
        adjustments: { ...state.adjustments, ...action.payload },
      };

    case "RESET_ADJUSTMENTS":
      return {
        ...state,
        adjustments: DEFAULT_ADJUSTMENTS,
      };

    case "SET_VIDEO_TIME":
      return {
        ...state,
        videoCurrentTime: action.payload,
      };

    case "SET_VIDEO_DURATION":
      return {
        ...state,
        videoDuration: action.payload,
      };

    case "TOGGLE_PLAY":
      return {
        ...state,
        isPlaying: !state.isPlaying,
      };

    case "UNDO": {
      if (state.undoStack.length === 0) return state;
      const previousElements = state.undoStack[state.undoStack.length - 1];
      return {
        ...state,
        elements: previousElements,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, state.elements],
      };
    }

    case "REDO": {
      if (state.redoStack.length === 0) return state;
      const nextElements = state.redoStack[state.redoStack.length - 1];
      return {
        ...state,
        elements: nextElements,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, state.elements],
      };
    }

    case "CLEAR_ALL":
      return {
        ...initialState,
        mediaUri: state.mediaUri,
        mediaType: state.mediaType,
      };

    default:
      return state;
  }
};

// ---- Hook ----

export const useEditorState = () => {
  const [state, dispatch] = useReducer(editorReducer, initialState);

  // ---- Mode ----
  const setMode = useCallback((mode: EditorMode) => {
    dispatch({ type: "SET_MODE", payload: mode });
  }, []);

  // ---- Media ----
  const setMedia = useCallback((uri: string, mediaType: "image" | "video") => {
    dispatch({ type: "SET_MEDIA", payload: { uri, mediaType } });
  }, []);

  // ---- Elements ----
  const addTextElement = useCallback(
    (options?: Partial<TextElement>) => {
      const id = generateId();
      // All positions in canvas coordinates (1080×1920)
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
        zIndex: getNextZIndex(state.elements),
        transform: {
          translateX: CANVAS_WIDTH / 2,
          translateY: CANVAS_HEIGHT / 2,
          scale: 1,
          rotation: 0,
        },
        ...options,
      };
      dispatch({ type: "ADD_ELEMENT", payload: element });
      return id;
    },
    [state.elements],
  );

  const addStickerElement = useCallback(
    (source: string | number, size: number = 120) => {
      const id = generateId();
      // All positions in canvas coordinates (1080×1920)
      const element: StickerElement = {
        id,
        type: "sticker",
        source,
        category: "emoji",
        size,
        opacity: 1,
        zIndex: getNextZIndex(state.elements),
        transform: {
          translateX: CANVAS_WIDTH / 2,
          translateY: CANVAS_HEIGHT / 2,
          scale: 1,
          rotation: 0,
        },
      };
      dispatch({ type: "ADD_ELEMENT", payload: element });
      return id;
    },
    [state.elements],
  );

  const updateElement = useCallback(
    (id: string, updates: Partial<CanvasElement>) => {
      dispatch({ type: "UPDATE_ELEMENT", payload: { id, updates } });
    },
    [],
  );

  const removeElement = useCallback((id: string) => {
    dispatch({ type: "REMOVE_ELEMENT", payload: id });
  }, []);

  const selectElement = useCallback((id: string | null) => {
    dispatch({ type: "SELECT_ELEMENT", payload: id });
  }, []);

  // ---- Drawing ----
  const addDrawingPath = useCallback((path: DrawingPath) => {
    dispatch({ type: "ADD_DRAWING_PATH", payload: path });
  }, []);

  const undoLastPath = useCallback(() => {
    dispatch({ type: "REMOVE_LAST_PATH" });
  }, []);

  const clearDrawing = useCallback(() => {
    dispatch({ type: "CLEAR_DRAWING" });
  }, []);

  // ---- Filters ----
  const setFilter = useCallback((filter: LUTFilter | null) => {
    dispatch({ type: "SET_FILTER", payload: filter });
  }, []);

  const setAdjustments = useCallback(
    (adjustments: Partial<FilterAdjustment>) => {
      dispatch({ type: "SET_ADJUSTMENTS", payload: adjustments });
    },
    [],
  );

  const resetAdjustments = useCallback(() => {
    dispatch({ type: "RESET_ADJUSTMENTS" });
  }, []);

  // ---- Video ----
  const setVideoTime = useCallback((time: number) => {
    dispatch({ type: "SET_VIDEO_TIME", payload: time });
  }, []);

  const setVideoDuration = useCallback((duration: number) => {
    dispatch({ type: "SET_VIDEO_DURATION", payload: duration });
  }, []);

  const togglePlay = useCallback(() => {
    dispatch({ type: "TOGGLE_PLAY" });
  }, []);

  // ---- History ----
  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "REDO" });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: "CLEAR_ALL" });
  }, []);

  // ---- Derived State ----
  const selectedElement =
    state.elements.find((el) => el.id === state.selectedElementId) || null;

  const canUndo = state.undoStack.length > 0;
  const canRedo = state.redoStack.length > 0;
  const hasElements =
    state.elements.length > 0 || state.drawingPaths.length > 0;

  return {
    state,
    // Mode
    setMode,
    // Media
    setMedia,
    // Elements
    addTextElement,
    addStickerElement,
    updateElement,
    removeElement,
    selectElement,
    selectedElement,
    // Drawing
    addDrawingPath,
    undoLastPath,
    clearDrawing,
    // Filters
    setFilter,
    setAdjustments,
    resetAdjustments,
    // Video
    setVideoTime,
    setVideoDuration,
    togglePlay,
    // History
    undo,
    redo,
    clearAll,
    // Derived
    canUndo,
    canRedo,
    hasElements,
  };
};
