// ============================================================
// Skia 3D LUT Shader
// ============================================================
//
// SkSL (Skia Shading Language) runtime shader that applies a
// 3D LUT stored as a 2D texture atlas to an input image.
//
// Atlas layout:  width = N*N,  height = N
//   N blue-slices laid out horizontally.
//   Within each slice: X = red, Y = green.
//
// The shader performs trilinear interpolation between two
// adjacent blue slices for smooth color grading.
// ============================================================

/**
 * SkSL source for the 3D LUT shader.
 *
 * Uniforms:
 *   - image:    the source image to color-grade
 *   - lut:      the 2D LUT atlas texture
 *   - lutSize:  the LUT dimension (e.g. 33 for a 33^3 LUT)
 *   - intensity: blend factor 0.0 (no effect) to 1.0 (full LUT)
 */
export const LUT_3D_SHADER_SOURCE = `
uniform shader image;
uniform shader lut;
uniform float lutSize;
uniform float intensity;

half4 main(float2 coord) {
  half4 original = image.eval(coord);

  // Clamp input to [0, 1]
  float r = clamp(float(original.r), 0.0, 1.0);
  float g = clamp(float(original.g), 0.0, 1.0);
  float b = clamp(float(original.b), 0.0, 1.0);

  // Blue determines which two slices to sample
  float blueScaled = b * (lutSize - 1.0);
  float blueFloor  = floor(blueScaled);
  float blueCeil   = min(blueFloor + 1.0, lutSize - 1.0);
  float blueFrac   = blueScaled - blueFloor;

  // Texture coordinates within each slice
  // Each slice is lutSize pixels wide, offset by blueIndex * lutSize
  // Add 0.5 to sample pixel centers
  float redCoord   = r * (lutSize - 1.0) + 0.5;
  float greenCoord = g * (lutSize - 1.0) + 0.5;

  // Sample slice at blueFloor
  float2 uv1 = float2(blueFloor * lutSize + redCoord, greenCoord);
  half4 color1 = lut.eval(uv1);

  // Sample slice at blueCeil
  float2 uv2 = float2(blueCeil * lutSize + redCoord, greenCoord);
  half4 color2 = lut.eval(uv2);

  // Trilinear interpolation between blue slices
  half4 graded = mix(color1, color2, half(blueFrac));

  // Preserve original alpha
  graded.a = original.a;

  // Blend between original and graded by intensity
  return mix(original, graded, half(intensity));
}
`;
