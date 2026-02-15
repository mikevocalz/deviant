// ============================================================
// Instagram Stories Editor - Constants & Presets
// ============================================================

import {
  LUTFilter,
  FilterAdjustment,
  ColorPalette,
  TextStylePreset,
} from "../types";

// ---- Screen Dimensions ----
// Story aspect ratio: 9:16
export const STORY_ASPECT_RATIO = 9 / 16;
export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;

// ---- Color Palettes ----

export const EDITOR_COLORS = {
  background: "#000000",
  surface: "#1a1a1a",
  surfaceLight: "#2a2a2a",
  primary: "#0095F6",
  accent: "#FF3366",
  text: "#FFFFFF",
  textSecondary: "#8E8E93",
  border: "#333333",
  danger: "#FF3B30",
  success: "#34C759",
  overlay: "rgba(0,0,0,0.6)",
  gradient: {
    instagram: ["#F58529", "#DD2A7B", "#8134AF", "#515BD4"],
    sunset: ["#FF512F", "#DD2476"],
    ocean: ["#2193B0", "#6DD5ED"],
    forest: ["#134E5E", "#71B280"],
  },
};

export const DRAWING_COLORS: string[] = [
  "#FFFFFF",
  "#000000",
  "#FF3B30",
  "#FF9500",
  "#FFCC00",
  "#34C759",
  "#007AFF",
  "#5856D6",
  "#AF52DE",
  "#FF2D55",
  "#A2845E",
  "#8E8E93",
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
  "#F1948A",
  "#82E0AA",
  "#F8C471",
  "#AED6F1",
  "#D7BDE2",
  "#A3E4D7",
];

export const COLOR_PALETTES: ColorPalette[] = [
  {
    id: "vibrant",
    name: "Vibrant",
    colors: ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#5856D6"],
  },
  {
    id: "pastel",
    name: "Pastel",
    colors: ["#FFB5B5", "#FFDAB5", "#FFFFB5", "#B5FFB5", "#B5D4FF", "#D4B5FF"],
  },
  {
    id: "earth",
    name: "Earth",
    colors: ["#8B4513", "#CD853F", "#DEB887", "#556B2F", "#2F4F4F", "#708090"],
  },
  {
    id: "neon",
    name: "Neon",
    colors: ["#FF073A", "#39FF14", "#00F0FF", "#FF61F6", "#FFE700", "#7B00FF"],
  },
  {
    id: "monochrome",
    name: "Mono",
    colors: ["#FFFFFF", "#D4D4D4", "#A0A0A0", "#6B6B6B", "#3A3A3A", "#000000"],
  },
];

// ---- Text Presets ----

export const TEXT_FONTS = [
  { id: "system", name: "Classic", fontFamily: "System" },
  { id: "serif", name: "Serif", fontFamily: "Georgia" },
  { id: "mono", name: "Typewriter", fontFamily: "Courier" },
  {
    id: "condensed",
    name: "Condensed",
    fontFamily: "AvenirNextCondensed-Bold",
  },
  { id: "rounded", name: "Rounded", fontFamily: "ArialRoundedMTBold" },
  { id: "handwritten", name: "Handwritten", fontFamily: "MarkerFelt-Wide" },
  { id: "bold", name: "Impact", fontFamily: "Impact" },
  { id: "elegant", name: "Elegant", fontFamily: "Didot" },
  { id: "comic", name: "Playful", fontFamily: "ChalkboardSE-Bold" },
];

export interface TextStyleConfig {
  id: TextStylePreset;
  name: string;
  hasBackground: boolean;
  hasStroke: boolean;
  hasShadow: boolean;
  hasGradient: boolean;
  defaultBackgroundColor?: string;
  defaultStrokeColor?: string;
  defaultStrokeWidth?: number;
  defaultShadowColor?: string;
  defaultShadowBlur?: number;
}

export const TEXT_STYLE_PRESETS: TextStyleConfig[] = [
  {
    id: "classic",
    name: "Classic",
    hasBackground: false,
    hasStroke: false,
    hasShadow: true,
    hasGradient: false,
    defaultShadowColor: "rgba(0,0,0,0.5)",
    defaultShadowBlur: 4,
  },
  {
    id: "modern",
    name: "Modern",
    hasBackground: true,
    hasStroke: false,
    hasShadow: false,
    hasGradient: false,
    defaultBackgroundColor: "rgba(0,0,0,0.7)",
  },
  {
    id: "neon",
    name: "Neon",
    hasBackground: false,
    hasStroke: false,
    hasShadow: true,
    hasGradient: false,
    defaultShadowColor: "#FF00FF",
    defaultShadowBlur: 20,
  },
  {
    id: "typewriter",
    name: "Typewriter",
    hasBackground: true,
    hasStroke: false,
    hasShadow: false,
    hasGradient: false,
    defaultBackgroundColor: "#FFFFFF",
  },
  {
    id: "strong",
    name: "Strong",
    hasBackground: true,
    hasStroke: true,
    hasShadow: false,
    hasGradient: false,
    defaultBackgroundColor: "#FF3B30",
    defaultStrokeColor: "#FFFFFF",
    defaultStrokeWidth: 2,
  },
  {
    id: "outline",
    name: "Outline",
    hasBackground: false,
    hasStroke: true,
    hasShadow: false,
    hasGradient: false,
    defaultStrokeColor: "#FFFFFF",
    defaultStrokeWidth: 3,
  },
  {
    id: "shadow",
    name: "Shadow",
    hasBackground: false,
    hasStroke: false,
    hasShadow: true,
    hasGradient: false,
    defaultShadowColor: "#000000",
    defaultShadowBlur: 10,
  },
  {
    id: "gradient",
    name: "Gradient",
    hasBackground: false,
    hasStroke: false,
    hasShadow: false,
    hasGradient: true,
  },
];

// ---- LUT Filters (Color Matrices) ----
// 4x5 color matrices for Skia's ColorFilter.MakeMatrix

export const IDENTITY_MATRIX: number[] = [
  1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
];

export const LUT_FILTERS: LUTFilter[] = [
  {
    id: "normal",
    name: "Normal",
    matrix: IDENTITY_MATRIX,
    intensity: 1.0,
  },
  {
    id: "clarendon",
    name: "Clarendon",
    matrix: [
      1.2, 0, 0, 0, 10, 0, 1.2, 0, 0, 10, 0, 0, 1.3, 0, 20, 0, 0, 0, 1, 0,
    ],
    intensity: 1.0,
  },
  {
    id: "gingham",
    name: "Gingham",
    matrix: [
      1.05, 0.1, 0.05, 0, 10, 0.05, 1.05, 0.05, 0, 10, 0.05, 0.1, 1.0, 0, 15, 0,
      0, 0, 1, 0,
    ],
    intensity: 1.0,
  },
  {
    id: "moon",
    name: "Moon",
    matrix: [
      0.33, 0.33, 0.33, 0, 20, 0.33, 0.33, 0.33, 0, 20, 0.33, 0.33, 0.33, 0, 20,
      0, 0, 0, 1, 0,
    ],
    intensity: 1.0,
  },
  {
    id: "lark",
    name: "Lark",
    matrix: [
      1.2, 0.1, 0, 0, 15, 0, 1.1, 0.05, 0, 10, 0, 0.05, 0.9, 0, 5, 0, 0, 0, 1,
      0,
    ],
    intensity: 1.0,
  },
  {
    id: "reyes",
    name: "Reyes",
    matrix: [
      1.1, 0, 0, 0, 30, 0, 1.05, 0, 0, 25, 0, 0, 0.95, 0, 20, 0, 0, 0, 0.85, 0,
    ],
    intensity: 1.0,
  },
  {
    id: "juno",
    name: "Juno",
    matrix: [1.3, 0, 0, 0, 0, 0, 1.1, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 1, 0],
    intensity: 1.0,
  },
  {
    id: "slumber",
    name: "Slumber",
    matrix: [
      0.9, 0.1, 0.1, 0, 10, 0.1, 0.85, 0.1, 0, 10, 0.1, 0.1, 0.9, 0, 20, 0, 0,
      0, 0.9, 0,
    ],
    intensity: 1.0,
  },
  {
    id: "crema",
    name: "Crema",
    matrix: [
      1.1, 0.05, 0, 0, 15, 0, 1.05, 0.05, 0, 10, 0, 0, 0.95, 0, 5, 0, 0, 0, 1,
      0,
    ],
    intensity: 1.0,
  },
  {
    id: "ludwig",
    name: "Ludwig",
    matrix: [
      1.15, 0, 0, 0, -10, 0, 1.05, 0, 0, -5, 0, 0, 0.9, 0, 0, 0, 0, 0, 1, 0,
    ],
    intensity: 1.0,
  },
  {
    id: "aden",
    name: "Aden",
    matrix: [
      0.95, 0.1, 0.05, 0, 20, 0.05, 0.95, 0.1, 0, 15, 0, 0, 0.85, 0, 10, 0, 0,
      0, 0.9, 0,
    ],
    intensity: 1.0,
  },
  {
    id: "perpetua",
    name: "Perpetua",
    matrix: [
      1.05, 0, 0.15, 0, 10, 0, 1.1, 0.05, 0, 10, 0, 0.1, 1.0, 0, 20, 0, 0, 0, 1,
      0,
    ],
    intensity: 1.0,
  },
  {
    id: "valencia",
    name: "Valencia",
    matrix: [
      1.2, 0.1, 0, 0, 10, 0, 1.0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 1, 0,
    ],
    intensity: 1.0,
  },
  {
    id: "xpro2",
    name: "X-Pro II",
    matrix: [
      1.3, 0, 0.1, 0, -10, 0, 1.0, 0.1, 0, 0, -0.1, 0, 1.2, 0, 10, 0, 0, 0, 1,
      0,
    ],
    intensity: 1.0,
  },
  {
    id: "lofi",
    name: "Lo-Fi",
    matrix: [
      1.4, 0, 0, 0, -20, 0, 1.4, 0, 0, -20, 0, 0, 1.4, 0, -20, 0, 0, 0, 1, 0,
    ],
    intensity: 1.0,
  },
  {
    id: "inkwell",
    name: "Inkwell",
    matrix: [
      0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114,
      0, 0, 0, 0, 0, 1, 0,
    ],
    intensity: 1.0,
  },
  {
    id: "earlybird",
    name: "Earlybird",
    matrix: [
      1.2, 0.15, 0, 0, 20, 0, 1.0, 0.1, 0, 10, 0, 0, 0.7, 0, 0, 0, 0, 0, 0.9, 0,
    ],
    intensity: 1.0,
  },
  {
    id: "nashville",
    name: "Nashville",
    matrix: [
      1.2, 0.15, 0, 0, 25, 0, 1.05, 0, 0, 15, -0.1, 0, 0.8, 0, 30, 0, 0, 0, 1,
      0,
    ],
    intensity: 1.0,
  },
];

// ---- Default Adjustments ----

export const DEFAULT_ADJUSTMENTS: FilterAdjustment = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  vignette: 0,
  sharpen: 0,
  fade: 0,
  grain: 0,
};

// ---- Drawing Tool Configs ----

export const DRAWING_TOOL_CONFIG = {
  pen: {
    minWidth: 2,
    maxWidth: 20,
    defaultWidth: 4,
    opacity: 1,
    blendMode: "srcOver" as const,
  },
  marker: {
    minWidth: 8,
    maxWidth: 40,
    defaultWidth: 15,
    opacity: 0.6,
    blendMode: "srcOver" as const,
  },
  neon: {
    minWidth: 4,
    maxWidth: 25,
    defaultWidth: 8,
    opacity: 1,
    blendMode: "screen" as const,
  },
  eraser: {
    minWidth: 10,
    maxWidth: 60,
    defaultWidth: 25,
    opacity: 1,
    blendMode: "clear" as const,
  },
  arrow: {
    minWidth: 2,
    maxWidth: 10,
    defaultWidth: 4,
    opacity: 1,
    blendMode: "srcOver" as const,
  },
  highlighter: {
    minWidth: 15,
    maxWidth: 50,
    defaultWidth: 25,
    opacity: 0.4,
    blendMode: "srcOver" as const,
  },
};

// ---- Sticker Categories ----

export const EMOJI_STICKERS = [
  "😀",
  "😂",
  "🥰",
  "😎",
  "🤩",
  "😍",
  "🥳",
  "😱",
  "🔥",
  "❤️",
  "💕",
  "✨",
  "🌟",
  "⭐",
  "💫",
  "🎉",
  "🎊",
  "🎈",
  "🎁",
  "🏆",
  "👑",
  "💎",
  "🦋",
  "🌈",
  "☀️",
  "🌙",
  "⚡",
  "💥",
  "💯",
  "🎵",
  "🎶",
  "🎭",
  "🍕",
  "🍔",
  "🍦",
  "🍩",
  "☕",
  "🍷",
  "🥂",
  "🍾",
  "📸",
  "🎬",
  "🎤",
  "🎧",
  "💻",
  "📱",
  "🚀",
  "✈️",
  "🌍",
  "🏖️",
  "🏔️",
  "🌸",
  "🌺",
  "🌻",
  "🍀",
  "🌴",
  "🐶",
  "🐱",
  "🦁",
  "🦄",
  "🐝",
  "🦋",
  "🐙",
  "🦊",
  "👍",
  "👎",
  "✌️",
  "🤞",
  "👏",
  "🙌",
  "💪",
  "🤝",
  "💋",
  "💌",
  "💝",
  "💘",
  "🏳️‍🌈",
  "🎯",
  "🧿",
  "🪬",
];

export const INTERACTIVE_STICKERS = [
  { id: "poll", icon: "📊", name: "Poll" },
  { id: "question", icon: "❓", name: "Question" },
  { id: "quiz", icon: "🧠", name: "Quiz" },
  { id: "countdown", icon: "⏰", name: "Countdown" },
  { id: "slider", icon: "🎚️", name: "Emoji Slider" },
  { id: "location", icon: "📍", name: "Location" },
  { id: "mention", icon: "@", name: "Mention" },
  { id: "hashtag", icon: "#", name: "Hashtag" },
  { id: "music", icon: "🎵", name: "Music" },
  { id: "link", icon: "🔗", name: "Link" },
  { id: "gif", icon: "🎞️", name: "GIF" },
  { id: "time", icon: "🕐", name: "Time" },
  { id: "weather", icon: "🌤️", name: "Weather" },
  { id: "selfie", icon: "🤳", name: "Selfie" },
];

// ---- Custom Image Sticker Packs (bundled local assets) ----

export interface ImageStickerPack {
  id: string;
  name: string;
  icon: string;
  stickers: { id: string; label: string; source: number }[];
}

export const IMAGE_STICKER_PACKS: ImageStickerPack[] = [
  {
    id: "dvnt",
    name: "DVNT",
    icon: "🖤",
    stickers: [
      {
        id: "dvnt-app",
        label: "App",
        source: require("@/assets/images/stickers/dvnt/DVNT-stickers_APP.png"),
      },
      {
        id: "dvnt-afterhours",
        label: "After Hours",
        source: require("@/assets/images/stickers/dvnt/DVNT-stickers_AfterHours.png"),
      },
      {
        id: "dvnt-counterculture",
        label: "Counter Culture",
        source: require("@/assets/images/stickers/dvnt/DVNT-stickers_CounterCulture.png"),
      },
      {
        id: "dvnt-dayplay",
        label: "Day Play",
        source: require("@/assets/images/stickers/dvnt/DVNT-stickers_DAYPLAY.png"),
      },
      {
        id: "dvnt-deviant",
        label: "Deviant",
        source: require("@/assets/images/stickers/dvnt/DVNT-stickers_Deviant.png"),
      },
      {
        id: "dvnt-energycheck",
        label: "Energy Check",
        source: require("@/assets/images/stickers/dvnt/DVNT-stickers_EnergyCheck.png"),
      },
      {
        id: "dvnt-ftc",
        label: "FTC",
        source: require("@/assets/images/stickers/dvnt/DVNT-stickers_FTC.png"),
      },
      {
        id: "dvnt-outside",
        label: "Outside",
        source: require("@/assets/images/stickers/dvnt/DVNT-stickers_OUTSIDE.png"),
      },
      {
        id: "dvnt-eatit",
        label: "Eat It",
        source: require("@/assets/images/stickers/dvnt/eat-it.png"),
      },
    ],
  },
  {
    id: "ballroom",
    name: "Ballroom",
    icon: "💃",
    stickers: [
      {
        id: "ballroom-chop",
        label: "Chop",
        source: require("@/assets/images/stickers/ballroom/1-chop.png"),
      },
      {
        id: "ballroom-serve1",
        label: "Serve",
        source: require("@/assets/images/stickers/ballroom/ChatGPT Image Feb 12, 2026, 08_28_14 PM.png"),
      },
      {
        id: "ballroom-serve2",
        label: "Category Is",
        source: require("@/assets/images/stickers/ballroom/ChatGPT Image Feb 12, 2026, 08_30_42 PM.png"),
      },
      {
        id: "ballroom-ate",
        label: "Ate That",
        source: require("@/assets/images/stickers/ballroom/ate-that.png"),
      },
      {
        id: "ballroom-tea",
        label: "Tea",
        source: require("@/assets/images/stickers/ballroom/tea.png"),
      },
    ],
  },
];

// ---- .cube LUT Filter Files ----
// These reference bundled .cube LUT files in assets/luts/.
// Full .cube → Skia integration requires a runtime shader parser (future work).
// For now they're listed with friendly names for the filter picker UI.

export interface CubeLUTFilter {
  id: string;
  name: string;
  category: "film" | "fujifilm" | "vivid" | "cinematic" | "log";
  filename: string;
}

export const CUBE_LUT_FILTERS: CubeLUTFilter[] = [
  // ── Film Look ──
  {
    id: "film-look",
    name: "Film Look",
    category: "film",
    filename: "Film_Look.cube",
  },
  {
    id: "vintage-color",
    name: "Vintage",
    category: "film",
    filename: "Vintage_Color.cube",
  },

  // ── IWLTBAP Cinematic ──
  {
    id: "iwltbap-k25",
    name: "K25",
    category: "cinematic",
    filename: "IWLTBAP_K25.cube",
  },
  {
    id: "iwltbap-k64",
    name: "K64",
    category: "cinematic",
    filename: "IWLTBAP_K64.cube",
  },
  {
    id: "iwltbap-k99",
    name: "K99",
    category: "cinematic",
    filename: "IWLTBAP_K99.cube",
  },

  // ── Vivid ──
  {
    id: "vivid-1",
    name: "Vivid I",
    category: "vivid",
    filename: "Vivid_LUTs_1.cube",
  },
  {
    id: "vivid-2",
    name: "Vivid II",
    category: "vivid",
    filename: "Vivid_LUTs_2.cube",
  },
  {
    id: "vivid-3",
    name: "Vivid III",
    category: "vivid",
    filename: "Vivid_LUTs_3.cube",
  },
  {
    id: "vivid-4",
    name: "Vivid IV",
    category: "vivid",
    filename: "Vivid_LUTs_4.cube",
  },
  {
    id: "vivid-5",
    name: "Vivid V",
    category: "vivid",
    filename: "Vivid_LUTs_5.cube",
  },

  // ── Fujifilm Simulations ──
  {
    id: "fuji-provia",
    name: "Provia",
    category: "fujifilm",
    filename: "FLog2C_to_PROVIA_VLog.cube",
  },
  {
    id: "fuji-velvia",
    name: "Velvia",
    category: "fujifilm",
    filename: "FLog2C_to_Velvia_VLog.cube",
  },
  {
    id: "fuji-astia",
    name: "Astia",
    category: "fujifilm",
    filename: "FLog2C_to_ASTIA_VLog.cube",
  },
  {
    id: "fuji-classic-chrome",
    name: "Classic Chrome",
    category: "fujifilm",
    filename: "FLog2C_to_CLASSIC-CHROME_VLog.cube",
  },
  {
    id: "fuji-classic-neg",
    name: "Classic Neg",
    category: "fujifilm",
    filename: "FLog2C_to_CLASSIC-Neg_VLog.cube",
  },
  {
    id: "fuji-eterna",
    name: "Eterna",
    category: "fujifilm",
    filename: "FLog2C_to_ETERNA_VLog.cube",
  },
  {
    id: "fuji-eterna-bb",
    name: "Eterna BB",
    category: "fujifilm",
    filename: "FLog2C_to_ETERNA-BB_VLog.cube",
  },
  {
    id: "fuji-acros",
    name: "Acros",
    category: "fujifilm",
    filename: "FLog2C_to_ACROS_VLog.cube",
  },
  {
    id: "fuji-reala",
    name: "Reala Ace",
    category: "fujifilm",
    filename: "FLog2C_to_REALA-ACE_VLog.cube",
  },
  {
    id: "fuji-pro-neg",
    name: "Pro Neg Std",
    category: "fujifilm",
    filename: "FLog2C_to_PRO-Neg_Std_VLog.cube",
  },

  // ── Cinematic / Log ──
  {
    id: "arri-709",
    name: "ARRI 709",
    category: "cinematic",
    filename: "ARRI_LogC2Video_Classic709_VLog.cube",
  },
  {
    id: "kodak-2383",
    name: "Kodak 2383",
    category: "cinematic",
    filename: "Cineon_to_Kodak_2383_D65_VLog.cube",
  },
  {
    id: "fuji-3513",
    name: "Fuji 3513",
    category: "cinematic",
    filename: "Cineon_to_Fuji_3513DI_D65_VLog.cube",
  },
  {
    id: "red-film",
    name: "RED Film",
    category: "cinematic",
    filename: "RED_FilmBias_Rec2020_N-Log_to_Rec709_BT1886_VLog.cube",
  },
  {
    id: "red-bleach",
    name: "RED Bleach",
    category: "cinematic",
    filename:
      "RED_FilmBiasBleachBypass_Rec2020_N-Log_to_Rec709_BT1886_VLog.cube",
  },
  {
    id: "red-achromic",
    name: "RED B&W",
    category: "cinematic",
    filename: "RED_Achromic_Rec2020_N-Log_to_Rec709_VLog.cube",
  },
  {
    id: "rec709-soft",
    name: "Soft Contrast",
    category: "log",
    filename: "REC709_MEDIUM_CONTRAST_Soft_VLog.cube",
  },
  {
    id: "llog-classic",
    name: "L-Log Classic",
    category: "log",
    filename: "L-Log_to_Classic_VLog.cube",
  },
  {
    id: "llog-natural",
    name: "L-Log Natural",
    category: "log",
    filename: "L-Log_to_Natural_VLog.cube",
  },
  {
    id: "nlog-709",
    name: "N-Log 709",
    category: "log",
    filename: "N-Log_BT2020_to_REC709_BT1886_VLog.cube",
  },
];

// ---- Story Background Presets (Instagram-style) ----

export interface StoryBackground {
  id: string;
  type: "solid" | "gradient";
  color?: string;
  colors?: string[];
  /** Gradient angle in degrees (0 = top-to-bottom) */
  angle?: number;
}

export const STORY_BACKGROUNDS: StoryBackground[] = [
  // Solids
  { id: "black", type: "solid", color: "#000000" },
  { id: "white", type: "solid", color: "#FFFFFF" },
  { id: "dark-gray", type: "solid", color: "#1a1a2e" },
  { id: "navy", type: "solid", color: "#16213e" },
  { id: "forest", type: "solid", color: "#1b4332" },
  { id: "wine", type: "solid", color: "#590d22" },
  { id: "plum", type: "solid", color: "#3c096c" },
  // Gradients
  {
    id: "sunset",
    type: "gradient",
    colors: ["#F77062", "#FE5196"],
    angle: 135,
  },
  {
    id: "ocean",
    type: "gradient",
    colors: ["#2193B0", "#6DD5ED"],
    angle: 180,
  },
  {
    id: "instagram",
    type: "gradient",
    colors: ["#F58529", "#DD2A7B", "#8134AF", "#515BD4"],
    angle: 135,
  },
  {
    id: "midnight",
    type: "gradient",
    colors: ["#0F2027", "#203A43", "#2C5364"],
    angle: 180,
  },
  {
    id: "peach",
    type: "gradient",
    colors: ["#FFDEE9", "#B5FFFC"],
    angle: 180,
  },
  {
    id: "aurora",
    type: "gradient",
    colors: ["#A9F1DF", "#FFBBBB"],
    angle: 135,
  },
  {
    id: "neon",
    type: "gradient",
    colors: ["#08AEEA", "#2AF598"],
    angle: 0,
  },
  {
    id: "fire",
    type: "gradient",
    colors: ["#F12711", "#F5AF19"],
    angle: 135,
  },
  {
    id: "purple-haze",
    type: "gradient",
    colors: ["#7F00FF", "#E100FF"],
    angle: 135,
  },
  {
    id: "deep-space",
    type: "gradient",
    colors: ["#000000", "#434343"],
    angle: 180,
  },
];

// ---- Animation ----

export const ANIMATION_DURATION = 250;
export const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 1,
};

// ---- Export Presets ----

export const EXPORT_PRESETS = {
  story: {
    width: 1080,
    height: 1920,
    fps: 30,
    bitrate: 8000000,
  },
  reel: {
    width: 1080,
    height: 1920,
    fps: 30,
    bitrate: 10000000,
  },
  post: {
    width: 1080,
    height: 1080,
    fps: 30,
    bitrate: 8000000,
  },
};
