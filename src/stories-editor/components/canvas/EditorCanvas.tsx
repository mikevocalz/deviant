// ============================================================
// Instagram Stories Editor - Main Skia Canvas Component
// ============================================================
//
// Single source of truth for rendering. ALL layers render inside
// one <Group transform={[{ scale: canvasScale }]}> so everything
// uses canvas coordinates (1080×1920). The Skia Canvas view is
// sized to displayW × displayH.
//
// Layer order (bottom to top):
//   1. Background color / gradient
//   2. Media image/video (with color filter)
//   3. Vignette & grain overlays
//   4. Drawing paths
//   5. Text & sticker elements
// ============================================================

import React, { useMemo, useRef } from "react";
import {
  Canvas,
  useImage,
  useVideo,
  Image as SkiaImage,
  ColorMatrix,
  Paint,
  Group,
  Path,
  Skia,
  Text as SkiaText,
  useFont,
  matchFont,
  RoundedRect,
  Blur,
  Circle,
  RadialGradient,
  StrokeCap,
  StrokeJoin,
  Rect,
  vec,
  Fill,
  LinearGradient,
} from "@shopify/react-native-skia";
import {
  CanvasElement,
  DrawingPath,
  LUTFilter,
  FilterAdjustment,
  TextElement,
  StickerElement,
  Position,
} from "../../types";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  IDENTITY_MATRIX,
  DRAWING_TOOL_CONFIG,
  DEFAULT_TEXT_FONT_SIZE,
  MIN_TEXT_FONT_SIZE,
  StoryBackground,
  FONT_ASSETS,
} from "../../constants";
import {
  buildAdjustmentMatrix,
  interpolateMatrix,
  pointsToSvgPath,
} from "../../utils/helpers";
import { useRenderSurface } from "../../utils/geometry";
import { useElementTransform } from "../../hooks/useElementTransform";

// ---- Font assets — resolved from central registry ----
const INTER_REGULAR = FONT_ASSETS["Inter-Regular"];
const INTER_BOLD = FONT_ASSETS["Inter-Bold"];

// ---- Props ----

interface EditorCanvasProps {
  canvasRef: React.RefObject<any>;
  mediaUri: string | null;
  mediaType: "image" | "video";
  elements: CanvasElement[];
  drawingPaths: DrawingPath[];
  currentFilter: LUTFilter | null;
  adjustments: FilterAdjustment;
  selectedElementId: string | null;
  videoCurrentTime: number;
  isPlaying: boolean;
  // Background for text-only stories
  canvasBackground?: StoryBackground | null;
  // Live drawing stroke (in-progress, not yet committed)
  liveStrokePoints?: Position[];
  liveStrokeColor?: string;
  liveStrokeWidth?: number;
  // Debug overlay toggle (driven by PerfHUD visibility)
  showDebugOverlay?: boolean;
}

// ---- Component ----

export const EditorCanvas: React.FC<EditorCanvasProps> = React.memo(
  ({
    canvasRef,
    mediaUri,
    mediaType,
    elements,
    drawingPaths,
    currentFilter,
    adjustments,
    selectedElementId,
    videoCurrentTime,
    isPlaying,
    canvasBackground,
    liveStrokePoints,
    liveStrokeColor,
    liveStrokeWidth,
    showDebugOverlay = false,
  }) => {
    // Load media
    const backgroundImage = useImage(
      mediaType === "image" && mediaUri ? mediaUri : undefined,
    );

    // For video, use Skia's useVideo hook
    const video =
      mediaType === "video" && mediaUri
        ? useVideo(mediaUri, { paused: !isPlaying })
        : null;

    // Compute combined color matrix (memoized — only recomputes on filter/adj change)
    const combinedMatrix = useMemo(() => {
      let matrix = [...IDENTITY_MATRIX];

      if (currentFilter && currentFilter.id !== "normal") {
        matrix = interpolateMatrix(
          IDENTITY_MATRIX,
          currentFilter.matrix,
          currentFilter.intensity,
        );
      }

      const adjMatrix = buildAdjustmentMatrix(adjustments);
      return multiplyMatrices(matrix, adjMatrix);
    }, [currentFilter, adjustments]);

    const isFilterActive = useMemo(() => {
      return combinedMatrix.some(
        (val, i) => Math.abs(val - IDENTITY_MATRIX[i]) > 0.001,
      );
    }, [combinedMatrix]);

    // Build the layer paint for the color filter (memoized JSX)
    const colorFilterPaint = useMemo(() => {
      if (isFilterActive) {
        return (
          <Paint>
            <ColorMatrix matrix={combinedMatrix} />
          </Paint>
        );
      }
      return undefined;
    }, [isFilterActive, combinedMatrix]);

    // RenderSurface — reactive to screen dimension changes
    const surface = useRenderSurface();

    // Pre-load fonts at canvas level so they're cached before any text element mounts
    // Must include DEFAULT_TEXT_FONT_SIZE (120) — the size TextElementRenderer uses
    const preloadedFont48 = useFont(INTER_REGULAR, 48);
    const preloadedFontBold48 = useFont(INTER_BOLD, 48);
    const preloadedFontDefault = useFont(INTER_REGULAR, DEFAULT_TEXT_FONT_SIZE);
    const preloadedFontBoldDefault = useFont(
      INTER_BOLD,
      DEFAULT_TEXT_FONT_SIZE,
    );

    // Debug font — guaranteed available via matchFont fallback
    const debugFontCustom = useFont(INTER_REGULAR, 28);
    const debugFontSystem = useMemo(
      () =>
        matchFont({
          fontFamily: "Inter",
          fontSize: 28,
          fontWeight: "400",
          fontStyle: "normal",
        }),
      [],
    );
    const debugFont = debugFontCustom ?? debugFontSystem;

    // Sorted elements (memoized)
    const sortedElements = useMemo(
      () => [...elements].sort((a, b) => a.zIndex - b.zIndex),
      [elements],
    );

    return (
      <Canvas
        ref={canvasRef}
        style={[
          canvasStyle,
          { width: surface.displayW, height: surface.displayH },
        ]}
      >
        {/* ---- Single scaled Group: everything in 1080×1920 canvas coords ---- */}
        <Group transform={[{ scale: surface.scale }]}>
          {/* Layer 1 — Media + color filter (composited via layer prop) */}
          <Group layer={colorFilterPaint}>
            {/* Background color or gradient */}
            {canvasBackground?.type === "gradient" &&
            canvasBackground.colors ? (
              <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(CANVAS_WIDTH, CANVAS_HEIGHT)}
                  colors={canvasBackground.colors}
                />
              </Rect>
            ) : (
              <Fill color={canvasBackground?.color || "black"} />
            )}

            {/* Background image */}
            {mediaType === "image" && backgroundImage && (
              <SkiaImage
                image={backgroundImage}
                x={0}
                y={0}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                fit="cover"
              />
            )}

            {/* Background video frame */}
            {mediaType === "video" && video?.currentFrame && (
              <SkiaImage
                image={video.currentFrame}
                x={0}
                y={0}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                fit="cover"
              />
            )}
          </Group>

          {/* Layer 2 — Vignette & Grain overlays */}
          {adjustments.vignette > 0 && (
            <VignetteOverlay intensity={adjustments.vignette} />
          )}
          {adjustments.grain > 0 && (
            <GrainOverlay intensity={adjustments.grain} />
          )}

          {/* Layer 3 — Drawing paths (canvas coords)
                Rendered to offscreen layer so eraser (blendMode="clear")
                only clears drawing strokes, not media underneath. */}
          <Group layer={<Paint />}>
            {drawingPaths.map((path) => (
              <DrawingPathRenderer key={path.id} path={path} />
            ))}
            {liveStrokePoints && liveStrokePoints.length >= 2 && (
              <LiveStrokeRenderer
                points={liveStrokePoints}
                color={liveStrokeColor || "#FFFFFF"}
                strokeWidth={liveStrokeWidth || 4}
              />
            )}
          </Group>

          {/* Layer 4 — Elements: text, stickers (canvas coords) */}
          <Group>
            {sortedElements.map((element) => (
              <ElementRenderer
                key={element.id}
                element={element}
                isSelected={element.id === selectedElementId}
              />
            ))}
          </Group>

          {/* DEBUG: Text Metrics Overlay (behind PerfHUD toggle) */}
          {showDebugOverlay && (
            <Group>
              {/* HUD background */}
              <RoundedRect
                x={20}
                y={20}
                width={620}
                height={100}
                r={8}
                color="rgba(0,0,0,0.85)"
              />
              <SkiaText
                x={32}
                y={50}
                text={`Canvas: ${CANVAS_WIDTH}x${CANVAS_HEIGHT} | Scale: ${surface.scale.toFixed(3)} | dW: ${surface.displayW.toFixed(0)}`}
                font={debugFont}
                color="#00FF88"
              />
              <SkiaText
                x={32}
                y={80}
                text={`Els: ${elements.length} | Texts: ${elements.filter((e) => e.type === "text").length} | Default: ${DEFAULT_TEXT_FONT_SIZE}cu`}
                font={debugFont}
                color="#FF00FF"
              />
              {/* Per-text-element metrics */}
              {elements
                .filter((e): e is TextElement => e.type === "text")
                .map((te, i) => (
                  <React.Fragment key={`dbg-${te.id}`}>
                    <RoundedRect
                      x={20}
                      y={140 + i * 50}
                      width={CANVAS_WIDTH - 40}
                      height={42}
                      r={6}
                      color="rgba(255,255,0,0.2)"
                    />
                    <SkiaText
                      x={30}
                      y={170 + i * 50}
                      text={`[${te.id.slice(0, 4)}] fs=${te.fontSize}cu (${Math.round(te.fontSize * surface.scale)}vp) "${te.content.slice(0, 20)}"`}
                      font={debugFont}
                      color="#FFFF00"
                    />
                  </React.Fragment>
                ))}
              {/* Forced TEXT_OK at fontSize=48 canvas units at (40,80) — coordinate system test */}
              {preloadedFont48 && (
                <SkiaText
                  x={40}
                  y={CANVAS_HEIGHT - 80}
                  text="TEXT_OK fs=48cu"
                  font={preloadedFont48}
                  color="#FF00FF"
                />
              )}
            </Group>
          )}
        </Group>
      </Canvas>
    );
  },
);

// ---- Drawing Path Renderer ----

const DrawingPathRenderer: React.FC<{ path: DrawingPath }> = React.memo(
  ({ path }) => {
    const toolConfig = DRAWING_TOOL_CONFIG[path.tool];
    const svgPath = pointsToSvgPath(path.points);

    if (!svgPath) return null;

    const skPath = Skia.Path.MakeFromSVGString(svgPath);
    if (!skPath) return null;

    const paint = Skia.Paint();
    paint.setColor(Skia.Color(path.color));
    paint.setStrokeWidth(path.strokeWidth);
    paint.setStyle(1); // Stroke
    paint.setStrokeCap(StrokeCap.Round);
    paint.setStrokeJoin(StrokeJoin.Round);
    paint.setAntiAlias(true);

    if (path.tool === "neon") {
      // Neon glow effect
      return (
        <Group>
          {/* Outer glow */}
          <Path
            path={skPath}
            color={path.color}
            style="stroke"
            strokeWidth={path.strokeWidth * 3}
            strokeCap="round"
            strokeJoin="round"
            opacity={0.3}
          >
            <Blur blur={10} />
          </Path>
          {/* Inner glow */}
          <Path
            path={skPath}
            color={path.color}
            style="stroke"
            strokeWidth={path.strokeWidth * 1.5}
            strokeCap="round"
            strokeJoin="round"
            opacity={0.6}
          >
            <Blur blur={4} />
          </Path>
          {/* Core line */}
          <Path
            path={skPath}
            color="#FFFFFF"
            style="stroke"
            strokeWidth={path.strokeWidth * 0.5}
            strokeCap="round"
            strokeJoin="round"
          />
        </Group>
      );
    }

    if (path.tool === "highlighter") {
      return (
        <Path
          path={skPath}
          color={path.color}
          style="stroke"
          strokeWidth={path.strokeWidth}
          strokeCap="butt"
          strokeJoin="round"
          opacity={toolConfig.opacity}
          blendMode="multiply"
        />
      );
    }

    if (path.tool === "eraser") {
      return (
        <Path
          path={skPath}
          color="black"
          style="stroke"
          strokeWidth={path.strokeWidth}
          strokeCap="round"
          strokeJoin="round"
          blendMode="clear"
        />
      );
    }

    if (path.tool === "marker") {
      return (
        <Path
          path={skPath}
          color={path.color}
          style="stroke"
          strokeWidth={path.strokeWidth}
          strokeCap="round"
          strokeJoin="round"
          opacity={toolConfig.opacity}
        />
      );
    }

    // Default pen
    return (
      <Path
        path={skPath}
        color={path.color}
        style="stroke"
        strokeWidth={path.strokeWidth}
        strokeCap="round"
        strokeJoin="round"
        opacity={path.opacity}
      />
    );
  },
);

// ---- Live Stroke Renderer (in-progress drawing) ----

const LiveStrokeRenderer: React.FC<{
  points: Position[];
  color: string;
  strokeWidth: number;
}> = React.memo(({ points, color, strokeWidth: sw }) => {
  const svgPath = pointsToSvgPath(points);
  if (!svgPath) return null;
  const skPath = Skia.Path.MakeFromSVGString(svgPath);
  if (!skPath) return null;
  return (
    <Path
      path={skPath}
      color={color}
      style="stroke"
      strokeWidth={sw}
      strokeCap="round"
      strokeJoin="round"
    />
  );
});

// ---- Element Renderer ----

const ElementRenderer: React.FC<{
  element: CanvasElement;
  isSelected: boolean;
}> = React.memo(({ element, isSelected }) => {
  const renderCount = useRef(0);
  renderCount.current++;
  if (__DEV__ && renderCount.current <= 3) {
    console.log(
      `[ElementRenderer] type=${element.type} id=${element.id.slice(0, 6)} render#${renderCount.current}`,
    );
  }
  switch (element.type) {
    case "text":
      return <TextElementRenderer element={element} isSelected={isSelected} />;
    case "sticker": {
      const src = element.source;
      const isImage =
        typeof src === "number" ||
        (typeof src === "string" && src.startsWith("http"));
      return isImage ? (
        <ImageStickerContent element={element} isSelected={isSelected} />
      ) : (
        <EmojiStickerContent element={element} isSelected={isSelected} />
      );
    }
    default:
      return null;
  }
});

// ---- Multi-line text helpers ----

/** Measure a single string's width via font, with fallback */
function measureWidth(
  font: ReturnType<typeof useFont>,
  text: string,
  fontSize: number,
): number {
  if (!font || text.length === 0) return 0;
  try {
    const m = font.measureText(text);
    const w = typeof m === "number" ? m : (m?.width ?? 0);
    return Number.isFinite(w) && w >= 0 ? w : text.length * fontSize * 0.5;
  } catch {
    return text.length * fontSize * 0.5;
  }
}

/** Split content on explicit \n, then word-wrap each paragraph to maxWidth */
function wrapText(
  content: string,
  font: ReturnType<typeof useFont>,
  maxWidth: number,
  fontSize: number,
): { text: string; width: number }[] {
  const paragraphs = content.split("\n");
  const lines: { text: string; width: number }[] = [];

  for (const para of paragraphs) {
    if (para.length === 0) {
      lines.push({ text: "", width: 0 });
      continue;
    }
    const words = para.split(/\s+/);
    let currentLine = "";
    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const w = measureWidth(font, candidate, fontSize);
      if (w > maxWidth && currentLine.length > 0) {
        lines.push({
          text: currentLine,
          width: measureWidth(font, currentLine, fontSize),
        });
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    }
    if (currentLine.length > 0) {
      lines.push({
        text: currentLine,
        width: measureWidth(font, currentLine, fontSize),
      });
    }
  }

  if (lines.length === 0) lines.push({ text: content, width: 0 });
  return lines;
}

// ---- Text Element Renderer ----

const TextElementRenderer: React.FC<{
  element: TextElement;
  isSelected: boolean;
}> = React.memo(({ element, isSelected }) => {
  const { content, color, style, backgroundColor } = element;
  const RENDER_MIN_FS = 80;
  const fontSize = Math.max(element.fontSize, RENDER_MIN_FS);
  const maxWidth = element.maxWidth || CANVAS_WIDTH * 0.8;
  const textAlign = element.textAlign || "center";

  const { skiaTransform: liveTransform } = useElementTransform(
    element.id,
    element.transform,
  );

  const fontAsset = FONT_ASSETS[element.fontFamily] ?? INTER_REGULAR;
  const font = useFont(fontAsset, fontSize, (err) => {
    console.warn(
      `[TextRenderer] Font load error for "${element.fontFamily}":`,
      err,
    );
  });
  if (__DEV__) {
    console.log(
      `[TextRenderer] id=${element.id.slice(0, 6)} font="${element.fontFamily}" asset=${fontAsset != null} loaded=${font != null} content="${content.slice(0, 10)}" fs=${fontSize}`,
    );
  }
  if (!font) return null;

  // Font size correction
  let fontScale = 1;
  try {
    const actualSize = font.getSize();
    if (actualSize > 0 && Math.abs(actualSize - fontSize) > 1) {
      fontScale = fontSize / actualSize;
    }
  } catch {}

  // Font metrics
  let metrics: { ascent: number; descent: number };
  try {
    const m = font.getMetrics();
    metrics = { ascent: Math.abs(m.ascent), descent: m.descent };
  } catch {
    metrics = { ascent: fontSize * 0.8, descent: fontSize * 0.2 };
  }

  const lhMultiplier = element.lineHeight ?? 1.25;
  const lineHeight = (metrics.ascent + metrics.descent) * lhMultiplier;
  const elLetterSpacing = element.letterSpacing ?? 0;
  const lines = wrapText(content, font, maxWidth, fontSize);
  const blockWidth = Math.max(...lines.map((l) => l.width), 0);
  const blockHeight = lines.length * lineHeight;

  // Center the block vertically around the transform origin
  const blockTopY = -blockHeight / 2;

  const resolvedColor = style === "typewriter" ? "#000000" : color || "#FFFFFF";

  // Per-line X offset based on alignment
  const lineX = (lw: number) => {
    if (textAlign === "left") return -blockWidth / 2;
    if (textAlign === "right") return blockWidth / 2 - lw;
    return -lw / 2; // center
  };

  return (
    <Group transform={liveTransform} opacity={element.opacity}>
      <Group transform={[{ scale: fontScale }]}>
        {/* Background — covers full block */}
        {backgroundColor && (
          <RoundedRect
            x={-blockWidth / 2 - 16}
            y={blockTopY - 12}
            width={blockWidth + 32}
            height={blockHeight + 24}
            r={8}
            color={backgroundColor}
          />
        )}

        {/* Render each line */}
        {lines.map((line, i) => {
          if (line.text.length === 0) return null;
          const x = lineX(line.width);
          const y = blockTopY + i * lineHeight + metrics.ascent;

          return (
            <React.Fragment key={i}>
              {/* Shadow / Neon */}
              {(style === "shadow" || style === "neon") && (
                <SkiaText
                  x={x}
                  y={y}
                  text={line.text}
                  font={font}
                  color={
                    element.shadowColor ||
                    (style === "neon" ? color : "#000000")
                  }
                >
                  <Blur
                    blur={element.shadowBlur || (style === "neon" ? 15 : 6)}
                  />
                </SkiaText>
              )}

              {/* Outline / Stroke */}
              {(style === "outline" || style === "strong") &&
                element.strokeColor && (
                  <SkiaText
                    x={x}
                    y={y}
                    text={line.text}
                    font={font}
                    color={element.strokeColor}
                  />
                )}

              {/* Main text */}
              {style === "gradient" ? (
                <SkiaText x={x} y={y} text={line.text} font={font}>
                  <LinearGradient
                    start={vec(-blockWidth / 2, blockTopY)}
                    end={vec(blockWidth / 2, blockTopY + blockHeight)}
                    colors={["#FF3366", "#CB5EEE", "#4158D0"]}
                  />
                </SkiaText>
              ) : (
                <SkiaText
                  x={x}
                  y={y}
                  text={line.text}
                  font={font}
                  color={resolvedColor}
                />
              )}
            </React.Fragment>
          );
        })}
      </Group>
    </Group>
  );
});

// ---- Sticker Element Renderer ----

const SelectionBorder: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
}> = React.memo(({ x, y, width, height }) => {
  const PAD = 8;

  return (
    <Rect
      x={x - PAD}
      y={y - PAD}
      width={width + PAD * 2}
      height={height + PAD * 2}
      color="rgba(255,255,255,0.7)"
      style="stroke"
      strokeWidth={3}
    />
  );
});

const ImageStickerContent: React.FC<{
  element: StickerElement;
  isSelected: boolean;
}> = React.memo(({ element, isSelected }) => {
  const { source, size } = element;

  // Shared-value transform — driven by gesture overlays at 60fps
  const { skiaTransform: liveTransform } = useElementTransform(
    element.id,
    element.transform,
  );

  // useImage handles both number (require asset ID) and string (URL)
  const stickerImage = useImage(
    typeof source === "number"
      ? source
      : typeof source === "string"
        ? source
        : undefined,
  );

  if (!stickerImage) return null;

  const halfSize = size / 2;

  return (
    <Group transform={liveTransform} opacity={element.opacity}>
      <SkiaImage
        image={stickerImage}
        x={-halfSize}
        y={-halfSize}
        width={size}
        height={size}
        fit="contain"
      />
      {isSelected && (
        <SelectionBorder
          x={-halfSize}
          y={-halfSize}
          width={size}
          height={size}
        />
      )}
    </Group>
  );
});

const EmojiStickerContent: React.FC<{
  element: StickerElement;
  isSelected: boolean;
}> = React.memo(({ element, isSelected }) => {
  const { source, size } = element;

  // Shared-value transform — driven by gesture overlays at 60fps
  const { skiaTransform: liveTransform } = useElementTransform(
    element.id,
    element.transform,
  );

  // Use system font for better emoji glyph support
  const font = useFont(INTER_REGULAR, size);

  if (!font) return null;

  const halfSize = size / 2;

  return (
    <Group transform={liveTransform} opacity={element.opacity}>
      <SkiaText x={-size / 3} y={size / 3} text={String(source)} font={font} />
      {isSelected && (
        <SelectionBorder
          x={-halfSize}
          y={-halfSize}
          width={size}
          height={size}
        />
      )}
    </Group>
  );
});

// ---- Vignette Overlay ----

const VignetteOverlay: React.FC<{ intensity: number }> = React.memo(
  ({ intensity }) => {
    const normalizedIntensity = intensity / 100;

    return (
      <Group blendMode="multiply">
        <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
          <RadialGradient
            c={vec(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)}
            r={CANVAS_WIDTH * 0.8}
            colors={[
              `rgba(255,255,255,1)`,
              `rgba(0,0,0,${normalizedIntensity})`,
            ]}
          />
        </Rect>
      </Group>
    );
  },
);

// ---- Grain Overlay ----
// Uses a simple noise pattern. For production, you'd use a shader.

const GrainOverlay: React.FC<{ intensity: number }> = React.memo(
  ({ intensity }) => {
    const normalizedIntensity = (intensity / 100) * 0.15;

    // Simple grain using random circles
    const grainElements = useMemo(() => {
      const elements: React.JSX.Element[] = [];
      const count = Math.floor(intensity * 5);

      for (let i = 0; i < count; i++) {
        const x = Math.random() * CANVAS_WIDTH;
        const y = Math.random() * CANVAS_HEIGHT;
        const r = Math.random() * 2 + 0.5;
        const opacity = Math.random() * normalizedIntensity;
        const color = Math.random() > 0.5 ? "white" : "black";

        elements.push(
          <Circle
            key={`grain-${i}`}
            cx={x}
            cy={y}
            r={r}
            color={color}
            opacity={opacity}
          />,
        );
      }
      return elements;
    }, [intensity, normalizedIntensity]);

    return <Group>{grainElements}</Group>;
  },
);

// ---- Helper: Multiply 4x5 matrices ----

const multiplyMatrices = (a: number[], b: number[]): number[] => {
  const result: number[] = new Array(20).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 5; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[i * 5 + k] * b[k * 5 + j];
      }
      if (j === 4) {
        sum += a[i * 5 + 4];
      }
      result[i * 5 + j] = sum;
    }
  }
  return result;
};

// ---- Styles ----

const canvasStyle = { backgroundColor: "#000" } as const;

EditorCanvas.displayName = "EditorCanvas";
