/**
 * useARScale — capture-time real-world scale from ARKit on devices without LiDAR (standard_ar tier).
 *
 * Calls the MetrifulLidar module's ARKit plane raycast (modules/metriful-lidar/ios/ArPlaneMeasurer.swift)
 * once, right after the photo is taken: camera-to-table distance + fx + width → img_w_cm via the same
 * pinhole formula as the LiDAR path, so the backend scale pipeline is unchanged. Gives scale only;
 * no volume or per-item geometry (that needs a depth map).
 *
 * Falls back cleanly (imgWidthCm = null) on web, Android, Expo Go, or when no plane is found, so the
 * backend keeps its default plate-width assumption instead of a fabricated one.
 */
import { useCallback, useEffect, useState } from 'react';
import { isArPlaneAvailable, measureArPlane, type ArPlaneReading } from '../../modules/metriful-lidar';
import { estimateImageWidthCm } from '../utils/scale';

export interface ARScaleResult {
  /** real-world width of the full frame, cm — feed to backend as img_w_cm */
  imgWidthCm: number | null;
  distanceCm: number | null;
  confidence: number;
  /** raw native reading for debugging */
  raw: ArPlaneReading | null;
}

const EMPTY: ARScaleResult = { imgWidthCm: null, distanceCm: null, confidence: 0, raw: null };

export function useARScale() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setAvailable(isArPlaneAvailable());
  }, []);

  /** Measure once (≤2.5s). Always resolves, never throws, so it can't break the capture flow. */
  const measure = useCallback(async (): Promise<ARScaleResult> => {
    const reading = await measureArPlane();
    if (!reading.hasScale || reading.distanceCm == null) {
      return { ...EMPTY, raw: reading };
    }
    const imgWidthCm = estimateImageWidthCm({
      distanceCm: reading.distanceCm,
      fxPx: reading.fx ?? null,
      frameWidthPx: reading.width ?? null,
      allowFovFallback: false,
    });
    return {
      imgWidthCm,
      distanceCm: imgWidthCm != null ? reading.distanceCm : null,
      confidence: imgWidthCm != null ? reading.confidence ?? 0 : 0,
      raw: reading,
    };
  }, []);

  return { available, measure };
}

export default useARScale;
