import {
  estimateImageWidthCm,
  DEFAULT_HORIZONTAL_FOV_DEG,
  MIN_IMAGE_WIDTH_CM,
  MAX_IMAGE_WIDTH_CM,
} from '../scale';

describe('estimateImageWidthCm', () => {
  it('uses camera intrinsics when fx + frame width are present (pinhole model)', () => {
    // img_w_cm = distance * frameWidthPx / fx = 35 * 4032 / 3200 = 44.1
    expect(estimateImageWidthCm({ distanceCm: 35, fxPx: 3200, frameWidthPx: 4032 })).toBeCloseTo(44.1, 1);
  });

  it('falls back to the default FOV when no intrinsics are given', () => {
    // 2 * 35 * tan(68/2 deg) ≈ 47.2
    const expected = 2 * 35 * Math.tan((DEFAULT_HORIZONTAL_FOV_DEG * Math.PI) / 180 / 2);
    expect(estimateImageWidthCm({ distanceCm: 35 })).toBeCloseTo(Math.round(expected * 10) / 10, 1);
  });

  it('uses an explicit horizontal FOV when provided', () => {
    // 2 * 40 * tan(25 deg) ≈ 37.3
    expect(estimateImageWidthCm({ distanceCm: 40, horizontalFovDeg: 50 })).toBeCloseTo(37.3, 1);
  });

  it('prefers intrinsics over FOV when both are available', () => {
    const withIntrinsics = estimateImageWidthCm({ distanceCm: 35, fxPx: 3200, frameWidthPx: 4032, horizontalFovDeg: 50 });
    expect(withIntrinsics).toBeCloseTo(44.1, 1);
  });

  it('returns null when there is no usable distance', () => {
    expect(estimateImageWidthCm({ distanceCm: null })).toBeNull();
    expect(estimateImageWidthCm({ distanceCm: undefined })).toBeNull();
    expect(estimateImageWidthCm({ distanceCm: 0 })).toBeNull();
    expect(estimateImageWidthCm({ distanceCm: -10 })).toBeNull();
    expect(estimateImageWidthCm({ distanceCm: NaN })).toBeNull();
  });

  it('returns null when intrinsics are required but unavailable', () => {
    expect(estimateImageWidthCm({ distanceCm: 35, allowFovFallback: false })).toBeNull();
  });

  it('clamps absurdly large readings to the max', () => {
    expect(estimateImageWidthCm({ distanceCm: 500 })).toBe(MAX_IMAGE_WIDTH_CM);
  });

  it('clamps tiny readings to the min', () => {
    expect(estimateImageWidthCm({ distanceCm: 3 })).toBe(MIN_IMAGE_WIDTH_CM);
  });

  it('ignores invalid intrinsics and falls back to FOV', () => {
    expect(estimateImageWidthCm({ distanceCm: 35, fxPx: 0, frameWidthPx: 4032 })).toBeCloseTo(47.2, 1);
    expect(estimateImageWidthCm({ distanceCm: 35, fxPx: 3200, frameWidthPx: 0 })).toBeCloseTo(47.2, 1);
  });

  it('produces realistic plate-photo widths across the working distance range', () => {
    const at20 = estimateImageWidthCm({ distanceCm: 20 })!;
    const at60 = estimateImageWidthCm({ distanceCm: 60 })!;
    expect(at20).toBeGreaterThanOrEqual(MIN_IMAGE_WIDTH_CM);
    expect(at60).toBeLessThanOrEqual(MAX_IMAGE_WIDTH_CM);
    expect(at60).toBeGreaterThan(at20); // monotonic in distance
  });
});
