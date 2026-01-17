import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Rect, Image as SvgImage, Defs, ClipPath, Circle } from "react-native-svg";
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

function generateQRMatrix(data: string): boolean[][] {
  const size = 25;
  const matrix: boolean[][] = Array(size)
    .fill(null)
    .map(() => Array(size).fill(false));

  // Add finder patterns
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

  addFinderPattern(0, 0);
  addFinderPattern(size - 7, 0);
  addFinderPattern(0, size - 7);

  // Add timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Generate data pattern based on input string
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }
  
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  let seed = Math.abs(hash);
  for (let y = 8; y < size - 8; y++) {
    for (let x = 8; x < size - 8; x++) {
      // Skip center area for logo
      const centerStart = Math.floor(size / 2) - 3;
      const centerEnd = Math.floor(size / 2) + 3;
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
  const logoPadding = 6;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Rect x="0" y="0" width={size} height={size} fill={backgroundColor} />
        
        {modules.map((module, index) => (
          <Rect
            key={index}
            x={module.x * moduleSize}
            y={module.y * moduleSize}
            width={moduleSize}
            height={moduleSize}
            fill={foregroundColor}
          />
        ))}

        {logo && (
          <>
            <Rect
              x={logoOffset - logoPadding}
              y={logoOffset - logoPadding}
              width={logoSize + logoPadding * 2}
              height={logoSize + logoPadding * 2}
              rx={12}
              fill={logoBackgroundColor}
            />
            <Logo
              x={logoOffset}
              y={logoOffset}
              width={logoSize}
              height={logoSize}
              viewBox="0 0 2360 908"
              preserveAspectRatio="xMidYMid meet"
            />
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});
