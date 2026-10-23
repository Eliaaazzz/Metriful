/**
 * useLidarScale — capture-time real-world scale from LiDAR.
 *
 * Wires the native MetrifulLidar module to scale.ts: take one depth reading at the moment the user
 * captures, convert (distance, fx, width) → img_w_cm via the pinhole model, and hand it to the
 * backend in the food-recognition metadata. Falls back cleanly (returns null) on non-LiDAR devices,
 * web, or Expo Go, so the backend uses its default plate-width assumption instead of a fabricated one.
 */
import { useCallback, useEffect, useState } from 'react';
import { isLidarAvailable, measureLidar, type LidarReading, type LidarRegion } from '../../modules/metriful-lidar';
import { estimateImageWidthCm } from '../utils/scale';

export interface LidarScaleResult {
  /** real-world width of the full frame, cm — feed to backend as img_w_cm */
  imgWidthCm: number | null;
  distanceCm: number | null;
  confidence: number;
  accuracy: LidarReading['accuracy'] | null;
  /** on-device portion geometry the calorie corrector consumes (null when no real depth) */
  geometry: { volumeCm3: number; areaCm2: number; meanHCm: number; npx: number } | null;
  /** per-item segmented regions for per-item portion refinement (null when unavailable) */
  items: LidarRegion[] | null;
  /** raw native reading for debugging */
  raw: LidarReading | null;
}

const EMPTY: LidarScaleResult = {
  imgWidthCm: null,
  distanceCm: null,
  confidence: 0,
  accuracy: null,
  geometry: null,
  items: null,
  raw: null,
};

export function useLidarScale() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setAvailable(isLidarAvailable());
  }, []);

  /**
   * Measure once and return the real-world image width (cm). Call this right before/after takePhoto.
   * Always resolves — never throws — so it can't break the capture flow.
   */
  const measure = useCallback(async (): Promise<LidarScaleResult> => {
    const reading = await measureLidar();
    if (!reading.hasDepth || reading.distanceCm == null) {
      return { ...EMPTY, raw: reading };
    }
    const imgWidthCm = estimateImageWidthCm({
      distanceCm: reading.distanceCm,
      fxPx: reading.fx ?? null,
      frameWidthPx: reading.width ?? null,
      // No FOV last-resort here: if intrinsics are missing we'd rather send nothing than a guess.
      allowFovFallback: false,
    });
    const geometry =
      reading.volumeCm3 != null && reading.areaCm2 != null && reading.meanHCm != null
        ? {
            volumeCm3: reading.volumeCm3,
            areaCm2: reading.areaCm2,
            meanHCm: reading.meanHCm,
            npx: reading.npx ?? 0,
          }
        : null;
    // Keep only well-formed regions with positive volume; the backend ignores the rest anyway.
    const items =
      Array.isArray(reading.items) && reading.items.length > 0
        ? reading.items.filter(
            (r) => r != null && typeof r.volumeCm3 === 'number' && r.volumeCm3 > 0,
          )
        : null;

    return {
      imgWidthCm,
      distanceCm: reading.distanceCm,
      confidence: reading.confidence ?? 0,
      accuracy: reading.accuracy ?? null,
      geometry,
      items: items && items.length > 0 ? items : null,
      raw: reading,
    };
  }, []);

  return { available, measure };
}

export default useLidarScale;
