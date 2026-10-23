/**
 * Distance Estimation Hook
 *
 * Backs the basic / fallback camera (expo-camera), which has NO access to the depth
 * sensor. Real LiDAR/ToF depth is read by VisionCameraView through the native
 * frame-processor plugin (`__getDepthAtCenter`) and converted to a real-world scale
 * by `estimateImageWidthCm`.
 *
 * Because expo-camera cannot read the depth sensor, this hook does NOT fabricate a
 * distance — it reports `null` unless the user sets one manually — and only drives
 * the MagicReticle UI state. (Earlier versions simulated a random distance here;
 * that has been removed so no fabricated scale ever reaches the backend.)
 *
 * Tiers (accuracy label / UX only):
 *   lidar/tof   → real depth handled by VisionCameraView
 *   standard_ar → ARKit plane-raycast scale via `useARScale` (native ARScaleModule); this hook
 *                 still reports null distance and only drives the reticle UI — the standard_ar
 *                 capture screen reads img_w_cm from useARScale, not from here.
 *   basic       → user-assisted reference guide
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceTier, useDeviceCapabilities } from './useDeviceCapabilities';

export type EstimationStatus =
  | 'idle'
  | 'initializing'
  | 'calibrating'
  | 'ready'
  | 'too_close'
  | 'too_far'
  | 'error';

export interface DistanceEstimation {
  status: EstimationStatus;
  distance: number | null; // in centimeters; null when there is no real measurement
  confidence: number; // 0-1
  accuracy: string; // e.g., "±1cm", "±3cm"
  deviceTier: DeviceTier;
  isReady: boolean;
}

export interface UseDistanceEstimationOptions {
  /** Minimum acceptable distance in cm (default: 20) */
  minDistance?: number;
  /** Maximum acceptable distance in cm (default: 60) */
  maxDistance?: number;
  /** Ideal distance in cm (default: 35) */
  idealDistance?: number;
  /** Auto-start estimation on mount (default: true) */
  autoStart?: boolean;
  /** Callback when a real (manually set) distance is locked */
  onReady?: (distance: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<UseDistanceEstimationOptions, 'onReady'>> = {
  minDistance: 20,
  maxDistance: 60,
  idealDistance: 35,
  autoStart: true,
};

export function useDistanceEstimation(
  options: UseDistanceEstimationOptions = {}
): DistanceEstimation & {
  start: () => void;
  stop: () => void;
  reset: () => void;
  setManualDistance: (cm: number) => void;
} {
  const { minDistance, maxDistance, autoStart } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const capabilities = useDeviceCapabilities();
  const [status, setStatus] = useState<EstimationStatus>('idle');
  const [distance, setDistance] = useState<number | null>(null);
  const [confidence, setConfidence] = useState(0);

  const isRunningRef = useRef(false);

  // Accuracy label by tier (UI only).
  const accuracy = capabilities.tier === 'lidar'
    ? '±1cm'
    : capabilities.tier === 'standard_ar'
    ? '±3cm'
    : '±5cm';

  const start = useCallback(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    // expo-camera cannot read the depth sensor, so we never fabricate a distance.
    // The camera is immediately usable; a precise measurement is only produced by
    // VisionCameraView on depth-capable devices. Tier affects the label only.
    const baseConfidence =
      capabilities.tier === 'lidar' ? 0.9 : capabilities.tier === 'standard_ar' ? 0.75 : 0.6;
    setDistance(null);
    setConfidence(baseConfidence);
    setStatus('ready');
  }, [capabilities.tier]);

  const stop = useCallback(() => {
    isRunningRef.current = false;
    setStatus('idle');
  }, []);

  const reset = useCallback(() => {
    stop();
    setDistance(null);
    setConfidence(0);
  }, [stop]);

  const setManualDistance = useCallback((cm: number) => {
    if (cm < minDistance) {
      setStatus('too_close');
      setDistance(cm);
      setConfidence(0.5);
    } else if (cm > maxDistance) {
      setStatus('too_far');
      setDistance(cm);
      setConfidence(0.5);
    } else {
      setStatus('ready');
      setDistance(cm);
      setConfidence(capabilities.tier === 'basic' ? 0.7 : 0.9);
      options.onReady?.(cm);
    }
  }, [minDistance, maxDistance, capabilities.tier, options]);

  // Auto-start on mount if enabled
  useEffect(() => {
    if (autoStart) {
      const timer = setTimeout(start, 300);
      return () => clearTimeout(timer);
    }
  }, [autoStart, start]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    status,
    distance,
    confidence,
    accuracy,
    deviceTier: capabilities.tier,
    isReady: status === 'ready',
    start,
    stop,
    reset,
    setManualDistance,
  };
}

/**
 * Convert distance estimation status to MagicReticle state
 */
export function toReticleState(
  status: EstimationStatus
): 'searching' | 'calibrating' | 'ready' | 'too_close' | 'too_far' {
  switch (status) {
    case 'idle':
    case 'initializing':
    case 'error':
      return 'searching';
    case 'calibrating':
      return 'calibrating';
    case 'too_close':
      return 'too_close';
    case 'too_far':
      return 'too_far';
    case 'ready':
    default:
      return 'ready';
  }
}

export default useDistanceEstimation;
