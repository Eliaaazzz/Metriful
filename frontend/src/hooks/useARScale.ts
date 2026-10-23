/**
 * useARScale — standard_ar (no-LiDAR) real-world scale via ARKit.
 *
 * Bridges to the native `ARScaleModule` (see native-depth-plugin/ios/ARScaleModule.swift): on
 * devices with ARKit but no depth sensor, a horizontal-plane raycast gives the camera-to-table
 * distance, converted to img_w_cm — the SAME scale signal the LiDAR frame-processor emits, so the
 * portion/mass pipeline is unchanged. Tier sits between LiDAR (±1cm) and the plate fallback (±5cm).
 *
 * Degrades gracefully: if the native module is absent (web, Expo Go, not-yet-built, or Android
 * without the ARCore equivalent) every call resolves to "unsupported" and callers fall back to the
 * plate-reference scale — never a fabricated number.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeModules, Platform } from 'react-native';

interface ARMeasurement {
  hasScale: boolean;
  distanceCm?: number;
  imgWcm?: number | null;
  fx?: number;
  trackingState?: string;
}

interface ARScaleNative {
  isSupported(): Promise<boolean>;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  measure(): Promise<ARMeasurement>;
}

const Native: ARScaleNative | undefined =
  Platform.OS === 'ios' ? (NativeModules.ARScaleModule as ARScaleNative | undefined) : undefined;

// Plausible real-world image-width window for a food close-up. A plane raycast that
// lands on something other than the table (e.g. a far wall) produces a wildly
// out-of-range width; rather than feed the backend a fabricated scale we drop it and
// let the caller fall back to the plate-reference default. (±cm bounds documented in
// native-depth-plugin/README.md.)
const MIN_PLAUSIBLE_IMG_W_CM = 12;
const MAX_PLAUSIBLE_IMG_W_CM = 90;

export interface UseARScale {
  /** Native module present AND device reports ARWorldTracking support. */
  supported: boolean;
  /** Latest real-world image width (cm) from a plane raycast, or null until a plane is found. */
  imgWcm: number | null;
  /** Begin a brief AR session (call when the standard_ar capture screen mounts). */
  start: () => Promise<void>;
  /** End the AR session (call on unmount / after capture) to release the camera. */
  stop: () => Promise<void>;
  /** Take a single scale reading; returns img_w_cm or null. */
  measure: () => Promise<number | null>;
}

export function useARScale(enabled = true): UseARScale {
  const [supported, setSupported] = useState(false);
  const [imgWcm, setImgWcm] = useState<number | null>(null);
  const started = useRef(false);
  const active = useRef(enabled);
  const commands = useRef<Promise<void>>(Promise.resolve());

  const stopSession = useCallback(() => {
    commands.current = commands.current.then(async () => {
      if (!started.current) return;
      try { await Native?.stop(); } catch { /* release is best effort */ }
      started.current = false;
    });
    return commands.current;
  }, []);

  useEffect(() => {
    let alive = true;
    active.current = enabled;
    if (!enabled) {
      setSupported(false);
      setImgWcm(null);
    }
    if (enabled && Native?.isSupported) {
      Native.isSupported().then((s) => { if (alive) setSupported(!!s); }).catch(() => {});
    }
    return () => {
      alive = false;
      active.current = false;
      // Queue release after any pending start so unmount cannot leak the camera.
      void stopSession();
    };
  }, [enabled, stopSession]);

  const start = useCallback(async () => {
    if (!Native || !active.current) return;
    commands.current = commands.current.then(async () => {
      if (!active.current || started.current) return;
      try { started.current = !!(await Native.start()); } catch { /* fall back to plate scale */ }
    });
    await commands.current;
  }, []);

  const stop = stopSession;

  const measure = useCallback(async (): Promise<number | null> => {
    if (!Native) return null;
    try {
      const m = await Native.measure();
      const finite =
        m.hasScale && typeof m.imgWcm === 'number' && isFinite(m.imgWcm) ? m.imgWcm : null;
      // Plausibility gate: only a value inside the food-framing window is trusted;
      // anything else degrades to the plate fallback rather than fabricating a scale.
      const v =
        finite !== null && finite >= MIN_PLAUSIBLE_IMG_W_CM && finite <= MAX_PLAUSIBLE_IMG_W_CM
          ? finite
          : null;
      setImgWcm(v);
      return v;
    } catch {
      setImgWcm(null);
      return null;
    }
  }, []);

  return { supported, imgWcm, start, stop, measure };
}

export default useARScale;
