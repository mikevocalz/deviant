import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Rect, Circle } from "react-native-svg";
import Logo from "./logo";

interface QRCodeProps {
  value: string;
  size?: number;
  backgroundColor?: string;
  foregroundColor?: string;
  logo?: boolean;
  logoSize?: number;
  logoBackgroundColor?: string;
}

function generateQRMatrix(data: string, size: number = 33): boolean[][] {
  const matrix: boolean[][] = Array(size)
    .fill(null)
    .map(() => Array(size).fill(false));

  // Add finder patterns (7x7 squares in corners)
  const addFinderPattern = (startX: number, startY: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const isOuter = x === 0 || x === 6 || y === 0 || y === 6;
        const isInner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (isOuter || isInner) {
          matrix[startY + y][startX + x] = true;
        }
      }
    }
  };

  // Top-left, top-right, bottom-left finder patterns
  addFinderPattern(0, 0);
  addFinderPattern(size - 7, 0);
  addFinderPattern(0, size - 7);

  // Add timing patterns (alternating pattern on row 6 and column 6)
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Generate deterministic pattern from data hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }

  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  // Fill data area with deterministic pattern
  let seed = Math.abs(hash);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Skip finder patterns
      const inFinderTL = x < 8 && y < 8;
      const inFinderTR = x >= size - 8 && y < 8;
      const inFinderBL = x < 8 && y >= size - 8;
      
      // Skip timing patterns
      const inTimingH = y === 6 && x >= 8 && x < size - 8;
      const inTimingV = x === 6 && y >= 8 && y < size - 8;

      if (inFinderTL || inFinderTR || inFinderBL || inTimingH || inTimingV) {
        continue;
      }

      // Skip center area for logo (larger area for better logo visibility)
      const centerStart = Math.floor(size / 2) - 4;
      const centerEnd = Math.floor(size / 2) + 4;
      if (x >= centerStart && x <= centerEnd && y >= centerStart && y <= centerEnd) {
        continue;
      }

      seed++;
      matrix[y][x] = seededRandom(seed) > 0.5;
    }
  }

  return matrix;
}

export default function QRCode({
  value,
  size = 200,
  backgroundColor = "#FFFFFF",
  foregroundColor = "#000000",
  logo,
  logoSize = 50,
  logoBackgroundColor = "#FFFFFF",
}: QRCodeProps) {
  const matrix = useMemo(() => generateQRMatrix(value), [value]);
  const moduleCount = matrix.length;
  const moduleSize = size / moduleCount;

  const modules = useMemo(() => {
    const result: { x: number; y: number }[] = [];
    for (let y = 0; y < moduleCount; y++) {
      for (let x = 0; x < moduleCount; x++) {
        if (matrix[y][x]) {
          result.push({ x, y });
        }
      }
    }
    return result;
  }, [matrix, moduleCount]);

  const logoOffset = (size - logoSize) / 2;
  const logoPadding = 8;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background */}
        <Rect x="0" y="0" width={size} height={size} fill={backgroundColor} />
        
        {/* QR Code modules */}
        {modules.map((module, index) => (
          <Rect
            key={`module-${index}`}
            x={module.x * moduleSize}
            y={module.y * moduleSize}
            width={moduleSize}
            height={moduleSize}
            fill={foregroundColor}
          />
        ))}

        {/* Logo background circle */}
        {logo && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={logoSize / 2 + logoPadding}
            fill={logoBackgroundColor}
          />
        )}
      </Svg>
      
      {/* Logo overlay - rendered as separate component on top */}
      {logo && (
        <View
          style={[
            styles.logoContainer,
            {
              width: logoSize,
              height: logoSize,
              left: logoOffset,
              top: logoOffset,
            },
          ]}
        >
          <Logo
            width={logoSize}
            height={logoSize}
            viewBox="0 0 2360 908"
            preserveAspectRatio="xMidYMid meet"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 8,
    position: "relative",
  },
  logoContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
