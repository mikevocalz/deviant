// ============================================================
// .cube LUT File Parser
// ============================================================
//
// Parses Adobe/Resolve .cube 3D LUT files into a flat RGB array
// suitable for creating a Skia texture atlas.
//
// .cube format spec:
//   - Lines starting with # are comments
//   - TITLE "name" (optional)
//   - LUT_3D_SIZE N (required, typically 17, 33, or 65)
//   - DOMAIN_MIN r g b (optional, defaults to 0 0 0)
//   - DOMAIN_MAX r g b (optional, defaults to 1 1 1)
//   - N^3 lines of "R G B" float values (0.0–1.0)
//   - Data order: R fastest, then G, then B
// ============================================================

export interface ParsedCubeLUT {
  title: string;
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  /** Flat array of RGB float triplets, length = size^3 * 3 */
  data: Float32Array;
}

/**
 * Parse a .cube file string into a structured LUT object.
 */
export function parseCubeFile(content: string): ParsedCubeLUT {
  let title = '';
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const rgbValues: number[] = [];

  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

    // Parse header directives
    if (line.startsWith('TITLE')) {
      // TITLE "Some Name"
      const match = line.match(/TITLE\s+"?([^"]*)"?/);
      if (match) title = match[1];
      continue;
    }

    if (line.startsWith('LUT_3D_SIZE')) {
      size = parseInt(line.split(/\s+/)[1], 10);
      continue;
    }

    if (line.startsWith('DOMAIN_MIN')) {
      const parts = line.split(/\s+/);
      domainMin = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
      continue;
    }

    if (line.startsWith('DOMAIN_MAX')) {
      const parts = line.split(/\s+/);
      domainMax = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
      continue;
    }

    // Skip any other keywords (LUT_1D_SIZE, etc.)
    if (line.match(/^[A-Z_]/)) continue;

    // Parse data line: "R G B"
    const parts = line.split(/\s+/);
    if (parts.length >= 3) {
      const r = parseFloat(parts[0]);
      const g = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);

      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        rgbValues.push(r, g, b);
      }
    }
  }

  if (size === 0) {
    throw new Error('[CubeParser] Missing LUT_3D_SIZE directive');
  }

  const expectedCount = size * size * size * 3;
  if (rgbValues.length !== expectedCount) {
    console.warn(
      `[CubeParser] Expected ${expectedCount / 3} entries (size=${size}), got ${rgbValues.length / 3}. Padding/truncating.`
    );
  }

  return {
    title,
    size,
    domainMin,
    domainMax,
    data: new Float32Array(rgbValues.slice(0, expectedCount)),
  };
}

/**
 * Convert a parsed 3D LUT into a 2D texture atlas (RGBA Uint8Array).
 *
 * Layout: The 3D LUT (size N) is flattened into a 2D image where:
 *   - Width  = N * N  (N blue-slices side by side)
 *   - Height = N
 *   - Within each slice: X = red axis, Y = green axis
 *
 * .cube data order: R varies fastest, then G, then B.
 * So index = R + G*N + B*N*N  →  data[(R + G*N + B*N*N) * 3 + channel]
 *
 * Returns { pixels, width, height } where pixels is RGBA Uint8Array.
 */
export function lutToTextureAtlas(lut: ParsedCubeLUT): {
  pixels: Uint8Array;
  width: number;
  height: number;
} {
  const N = lut.size;
  const width = N * N;
  const height = N;
  const pixels = new Uint8Array(width * height * 4);

  for (let b = 0; b < N; b++) {
    for (let g = 0; g < N; g++) {
      for (let r = 0; r < N; r++) {
        // .cube index: R fastest, then G, then B
        const cubeIdx = (r + g * N + b * N * N) * 3;

        // Atlas pixel position:
        // x = blue_slice_offset + red
        // y = green
        const x = b * N + r;
        const y = g;
        const pixelIdx = (y * width + x) * 4;

        // Clamp to [0, 1] and convert to [0, 255]
        pixels[pixelIdx + 0] = Math.round(clamp01(lut.data[cubeIdx + 0]) * 255);
        pixels[pixelIdx + 1] = Math.round(clamp01(lut.data[cubeIdx + 1]) * 255);
        pixels[pixelIdx + 2] = Math.round(clamp01(lut.data[cubeIdx + 2]) * 255);
        pixels[pixelIdx + 3] = 255; // Fully opaque
      }
    }
  }

  return { pixels, width, height };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
