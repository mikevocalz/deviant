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

import React, { useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import type { SkImage, SkRuntimeEffect } from "@shopify/react-native-skia";
import { StyleSheet } from "react-native";
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
  RuntimeShader,
  ImageShader,
  DashPathEffect,
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
  StoryBackground,
} from "../../constants";
import {
  buildAdjustmentMatrix,
  interpolateMatrix,
  pointsToSvgPath,
} from "../../utils/helpers";
import { computeRenderSurface } from "../../utils/geometry";

// ---- Font asset (loaded once, shared across text elements) ----
const INTER_REGULAR = require("@/assets/fonts/Inter-Regular.ttf");
const INTER_BOLD = require("@/assets/fonts/Inter-Bold.ttf");

// ---- Props ----

interface EditorCanvasProps {
  mediaUri: string | null;
  mediaType: "image" | "video";
  elements: CanvasElement[];
  drawingPaths: DrawingPath[];
  currentFilter: LUTFilter | null;
  adjustments: FilterAdjustment;
  selectedElementId: string | null;
  videoCurrentTime: number;
  isPlaying: boolean;
  // 3D LUT shader props (from useCubeLUT hook)
  cubeLutImage?: SkImage | null;
  cubeLutSize?: number;
  cubeLutEffect?: SkRuntimeEffect | null;
  // Background for text-only stories
  canvasBackground?: StoryBackground | null;
  // Live drawing stroke (in-progress, not yet committed)
  liveStrokePoints?: Position[];
  liveStrokeColor?: string;
  liveStrokeWidth?: number;
}

// ---- Component ----

export const EditorCanvas = React.memo(
  forwardRef<{ snapshot: () => any }, EditorCanvasProps>(
    (
      {
        mediaUri,
        mediaType,
        elements,
        drawingPaths,
        currentFilter,
        adjustments,
        selectedElementId,
        videoCurrentTime,
        isPlaying,
        cubeLutImage,
        cubeLutSize,
        cubeLutEffect,
        canvasBackground,
        liveStrokePoints,
        liveStrokeColor,
        liveStrokeWidth,
      },
      ref,
    ) => {
      const canvasRef = useRef<any>(null);

      useImperativeHandle(ref, () => ({
        snapshot: () => canvasRef.current?.makeImageSnapshot(),
      }));

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
        if (cubeLutImage && cubeLutEffect && cubeLutSize) {
          return (
            <Paint>
              <RuntimeShader
                source={cubeLutEffect}
                uniforms={{ lutSize: cubeLutSize, intensity: 1.0 }}
              >
                <ImageShader
                  image={cubeLutImage}
                  fit="fill"
                  x={0}
                  y={0}
                  width={cubeLutSize * cubeLutSize}
                  height={cubeLutSize}
                />
              </RuntimeShader>
            </Paint>
          );
        }
        if (isFilterActive) {
          return (
            <Paint>
              <ColorMatrix matrix={combinedMatrix} />
            </Paint>
          );
        }
        return undefined;
      }, [
        cubeLutImage,
        cubeLutEffect,
        cubeLutSize,
        isFilterActive,
        combinedMatrix,
      ]);

      // RenderSurface — computed once
      const surface = useMemo(() => computeRenderSurface(), []);

      // Sorted elements (memoized)
      const sortedElements = useMemo(
        () => [...elements].sort((a, b) => a.zIndex - b.zIndex),
        [elements],
      );

      return (
        <Canvas
          ref={canvasRef}
          style={[
            styles.canvas,
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

            {/* Layer 3 — Drawing paths (canvas coords) */}
            <Group>
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
          </Group>
        </Canvas>
      );
    },
  ),
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

// ---- Text Element Renderer ----

const TextElementRenderer: React.FC<{
  element: TextElement;
  isSelected: boolean;
}> = React.memo(({ element, isSelected }) => {
  const { transform, content, fontSize, color, style, backgroundColor } =
    element;

  // Load actual font file — null returns null on most platforms
  const font = useFont(INTER_REGULAR, fontSize);

  if (!font) return null;

  const textWidth = font.measureText(content).width;
  const textX = -textWidth / 2;
  const textY = fontSize / 3;

  return (
    <Group
      transform={[
        { translateX: transform.translateX },
        { translateY: transform.translateY },
        { rotate: (transform.rotation * Math.PI) / 180 },
        { scale: transform.scale },
      ]}
      opacity={element.opacity}
    >
      {/* Background */}
      {backgroundColor && (
        <RoundedRect
          x={textX - 16}
          y={-fontSize / 2 - 12}
          width={textWidth + 32}
          height={fontSize + 24}
          r={8}
          color={backgroundColor}
        />
      )}

      {/* Shadow */}
      {style === "shadow" || style === "neon" ? (
        <SkiaText
          x={textX}
          y={textY}
          text={content}
          font={font}
          color={element.shadowColor || (style === "neon" ? color : "#000000")}
        >
          <Blur blur={element.shadowBlur || (style === "neon" ? 15 : 6)} />
        </SkiaText>
      ) : null}

      {/* Outline/Stroke */}
      {(style === "outline" || style === "strong") && element.strokeColor && (
        <SkiaText
          x={textX}
          y={textY}
          text={content}
          font={font}
          color={element.strokeColor}
        />
      )}

      {/* Main Text */}
      {style === "gradient" ? (
        <SkiaText x={textX} y={textY} text={content} font={font}>
          <LinearGradient
            start={vec(textX, -fontSize / 2)}
            end={vec(textX + textWidth, fontSize / 2)}
            colors={["#FF3366", "#CB5EEE", "#4158D0"]}
          />
        </SkiaText>
      ) : (
        <SkiaText
          x={textX}
          y={textY}
          text={content}
          font={font}
          color={style === "typewriter" ? "#000000" : color}
        />
      )}

      {/* Selection indicator */}
      {isSelected && (
        <RoundedRect
          x={textX - 20}
          y={-fontSize / 2 - 16}
          width={textWidth + 40}
          height={fontSize + 32}
          r={4}
          color="rgba(255,255,255,0.5)"
          style="stroke"
          strokeWidth={2}
        >
          <DashPathEffect intervals={[8, 4]} />
        </RoundedRect>
      )}
    </Group>
  );
});

// ---- Sticker Element Renderer ----

const ImageStickerContent: React.FC<{
  element: StickerElement;
  isSelected: boolean;
}> = React.memo(({ element, isSelected }) => {
  const { transform, source, size } = element;
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
    <Group
      transform={[
        { translateX: transform.translateX },
        { translateY: transform.translateY },
        { rotate: (transform.rotation * Math.PI) / 180 },
        { scale: transform.scale },
      ]}
      opacity={element.opacity}
    >
      <SkiaImage
        image={stickerImage}
        x={-halfSize}
        y={-halfSize}
        width={size}
        height={size}
        fit="contain"
      />
      {isSelected && (
        <RoundedRect
          x={-halfSize - 6}
          y={-halfSize - 6}
          width={size + 12}
          height={size + 12}
          r={6}
          color="rgba(255,255,255,0.7)"
          style="stroke"
          strokeWidth={1.5}
        >
          <DashPathEffect intervals={[8, 4]} />
        </RoundedRect>
      )}
    </Group>
  );
});

const EmojiStickerContent: React.FC<{
  element: StickerElement;
  isSelected: boolean;
}> = React.memo(({ element, isSelected }) => {
  const { transform, source, size } = element;
  const font = useFont(INTER_REGULAR, size);

  if (!font) return null;

  return (
    <Group
      transform={[
        { translateX: transform.translateX },
        { translateY: transform.translateY },
        { rotate: (transform.rotation * Math.PI) / 180 },
        { scale: transform.scale },
      ]}
      opacity={element.opacity}
    >
      <SkiaText
        x={-size / 3}
        y={size / 3}
        text={String(source)}
        font={font}
        color="#FFFFFF"
      />
      {isSelected && (
        <RoundedRect
          x={-size / 2 - 6}
          y={-size / 2 - 6}
          width={size + 12}
          height={size + 12}
          r={6}
          color="rgba(255,255,255,0.7)"
          style="stroke"
          strokeWidth={1.5}
        >
          <DashPathEffect intervals={[8, 4]} />
        </RoundedRect>
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

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: "#000",
  },
});

EditorCanvas.displayName = "EditorCanvas";
