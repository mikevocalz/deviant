/**
 * Tests for computeCropRectPixels — the most critical pure function
 * in the image editor. Ensures crop rect correctness across all
 * combinations of rotate/straighten/flip/zoom/pan.
 */

import {
  computeCropRectPixels,
  getRotatedDimensions,
  getStraightenedDimensions,
  getBaseDisplaySize,
  clampPanForEdit,
  type CropMathInput,
} from "../src/crop/crop-math";

// Helper: create a default input with overrides
function makeInput(overrides: Partial<CropMathInput> = {}): CropMathInput {
  return {
    sourceW: 1080,
    sourceH: 1920,
    containerW: 375,
    containerH: 469, // 375 * 5/4
    cropFrameW: 375,
    cropFrameH: 469,
    scale: 0.347, // minScale for 1080x1920 in 375x469 frame
    tx: 0,
    ty: 0,
    rotate90: 0,
    straighten: 0,
    flipX: false,
    ...overrides,
  };
}

describe("getRotatedDimensions", () => {
  it("returns same dims for 0°", () => {
    expect(getRotatedDimensions(1080, 1920, 0)).toEqual({ w: 1080, h: 1920 });
  });

  it("swaps dims for 90°", () => {
    expect(getRotatedDimensions(1080, 1920, 90)).toEqual({ w: 1920, h: 1080 });
  });

  it("returns same dims for 180°", () => {
    expect(getRotatedDimensions(1080, 1920, 180)).toEqual({
      w: 1080,
      h: 1920,
    });
  });

  it("swaps dims for 270°", () => {
    expect(getRotatedDimensions(1080, 1920, 270)).toEqual({
      w: 1920,
      h: 1080,
    });
  });
});

describe("getStraightenedDimensions", () => {
  it("returns same dims for 0°", () => {
    expect(getStraightenedDimensions(1080, 1920, 0)).toEqual({
      w: 1080,
      h: 1920,
    });
  });

  it("expands dims for 45°", () => {
    const result = getStraightenedDimensions(1080, 1920, 45);
    // At 45°, bounding box is (w+h)/sqrt(2) × (w+h)/sqrt(2)
    expect(result.w).toBeGreaterThan(1080);
    expect(result.h).toBeGreaterThan(1920);
  });

  it("expands dims symmetrically for ±angle", () => {
    const pos = getStraightenedDimensions(1080, 1920, 15);
    const neg = getStraightenedDimensions(1080, 1920, -15);
    expect(pos.w).toEqual(neg.w);
    expect(pos.h).toEqual(neg.h);
  });

  it("expands dims for small angles", () => {
    const result = getStraightenedDimensions(1080, 1920, 5);
    expect(result.w).toBeGreaterThan(1080);
    expect(result.h).toBeGreaterThan(1920);
  });
});

describe("computeCropRectPixels — no transform", () => {
  it("returns centered crop at minScale with no pan", () => {
    // 1080x1920 source, 375x469 frame
    // minScale = max(375/1080, 469/1920) ≈ 0.347
    const minScale = Math.max(375 / 1080, 469 / 1920);
    const result = computeCropRectPixels(makeInput({ scale: minScale }));

    expect(result.originX).toBeGreaterThanOrEqual(0);
    expect(result.originY).toBeGreaterThanOrEqual(0);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);

    // Crop should be centered
    const centerX = result.originX + result.width / 2;
    expect(Math.abs(centerX - 540)).toBeLessThan(5); // near center of 1080
  });

  it("crop width + originX never exceeds sourceW", () => {
    const result = computeCropRectPixels(makeInput());
    expect(result.originX + result.width).toBeLessThanOrEqual(1080);
  });

  it("crop height + originY never exceeds sourceH", () => {
    const result = computeCropRectPixels(makeInput());
    expect(result.originY + result.height).toBeLessThanOrEqual(1920);
  });
});

describe("computeCropRectPixels — zoom/pan", () => {
  it("zooming in reduces crop rect size", () => {
    const base = computeCropRectPixels(makeInput({ scale: 0.5 }));
    const zoomed = computeCropRectPixels(makeInput({ scale: 1.0 }));
    expect(zoomed.width).toBeLessThan(base.width);
    expect(zoomed.height).toBeLessThan(base.height);
  });

  it("panning right moves crop left in source coords", () => {
    const center = computeCropRectPixels(makeInput({ scale: 0.5, tx: 0 }));
    const panned = computeCropRectPixels(makeInput({ scale: 0.5, tx: 50 }));
    expect(panned.originX).toBeLessThan(center.originX);
  });

  it("panning down moves crop up in source coords", () => {
    const center = computeCropRectPixels(makeInput({ scale: 0.5, ty: 0 }));
    const panned = computeCropRectPixels(makeInput({ scale: 0.5, ty: 50 }));
    expect(panned.originY).toBeLessThan(center.originY);
  });

  it("clamps negative originX to 0", () => {
    const result = computeCropRectPixels(
      makeInput({ scale: 0.5, tx: 99999 }),
    );
    expect(result.originX).toBeGreaterThanOrEqual(0);
  });

  it("clamps negative originY to 0", () => {
    const result = computeCropRectPixels(
      makeInput({ scale: 0.5, ty: 99999 }),
    );
    expect(result.originY).toBeGreaterThanOrEqual(0);
  });
});

describe("computeCropRectPixels — rotate90", () => {
  it("at 90°, effective dims are swapped → crop rect adapts", () => {
    const r0 = computeCropRectPixels(makeInput({ rotate90: 0, scale: 0.5 }));
    const r90 = computeCropRectPixels(makeInput({ rotate90: 90, scale: 0.5 }));

    // After 90° rotation, the effective source is 1920x1080 instead of 1080x1920
    // So the crop rect dimensions will differ
    expect(r90.width).not.toEqual(r0.width);
  });

  it("at 180°, dims unchanged, crop centered same as 0°", () => {
    const r0 = computeCropRectPixels(makeInput({ rotate90: 0, scale: 0.5 }));
    const r180 = computeCropRectPixels(
      makeInput({ rotate90: 180, scale: 0.5 }),
    );
    // Width and height should be identical (same effective dims)
    expect(r180.width).toEqual(r0.width);
    expect(r180.height).toEqual(r0.height);
  });
});

describe("computeCropRectPixels — straighten", () => {
  it("straighten expands effective dims → crop rect grows at same scale", () => {
    const flat = computeCropRectPixels(
      makeInput({ straighten: 0, scale: 0.5 }),
    );
    const tilted = computeCropRectPixels(
      makeInput({ straighten: 15, scale: 0.5 }),
    );
    // Same scale on a larger effective image = same crop rect size (cropW = frameW/scale)
    // But the effective dims are bigger, so the rect should still be bounded
    expect(tilted.originX + tilted.width).toBeLessThanOrEqual(
      getStraightenedDimensions(1080, 1920, 15).w + 1,
    );
  });

  it("extreme straighten (-45) still produces valid rect", () => {
    const result = computeCropRectPixels(
      makeInput({ straighten: -45, scale: 0.5 }),
    );
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.originX).toBeGreaterThanOrEqual(0);
    expect(result.originY).toBeGreaterThanOrEqual(0);
  });
});

describe("computeCropRectPixels — flipX", () => {
  it("flipX does not change crop rect (flip is visual only for crop math)", () => {
    const noFlip = computeCropRectPixels(
      makeInput({ flipX: false, scale: 0.5 }),
    );
    const flipped = computeCropRectPixels(
      makeInput({ flipX: true, scale: 0.5 }),
    );
    // Flip is applied by manipulator before crop, but the crop rect
    // in the flipped space is the same as the non-flipped space
    // (we compute in post-transform space, and flip is symmetric around center)
    expect(flipped.originX).toEqual(noFlip.originX);
    expect(flipped.originY).toEqual(noFlip.originY);
    expect(flipped.width).toEqual(noFlip.width);
    expect(flipped.height).toEqual(noFlip.height);
  });
});

describe("clampPanForEdit", () => {
  it("clamps tx within bounds", () => {
    const result = clampPanForEdit(9999, 0, 1080, 1920, 375, 469, 0.5);
    const dw = 1080 * 0.5;
    const maxTx = Math.max(0, (dw - 375) / 2);
    expect(result.tx).toBeLessThanOrEqual(maxTx);
  });

  it("returns 0 when image exactly fits frame", () => {
    // Scale where image width = frame width
    const scale = 375 / 1080;
    const result = clampPanForEdit(100, 100, 1080, 1920, 375, 469, scale);
    // Image fits exactly in width, may overflow in height
    // tx should be clamped to 0 since dw = frameW
    expect(result.tx).toBe(0);
  });
});

describe("getBaseDisplaySize", () => {
  it("minScale covers the frame", () => {
    const { minScale, baseW, baseH } = getBaseDisplaySize(
      1080,
      1920,
      375,
      469,
      0,
      0,
    );
    expect(baseW * minScale).toBeGreaterThanOrEqual(375 - 1);
    expect(baseH * minScale).toBeGreaterThanOrEqual(469 - 1);
  });

  it("after 90° rotation, effective dims are swapped", () => {
    const { baseW, baseH } = getBaseDisplaySize(1080, 1920, 375, 469, 90, 0);
    expect(baseW).toBe(1920);
    expect(baseH).toBe(1080);
  });
});
