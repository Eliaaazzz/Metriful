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

  useEffect(() => {
    let alive = true;
    if (enabled && Native?.isSupported) {
      Native.isSupported().then((s) => { if (alive) setSupported(!!s); }).catch(() => {});
    }
    return () => {
      alive = false;
      if (started.current) Native?.stop().catch(() => {});
    };
  }, [enabled]);

  const start = useCallback(async () => {
    if (!Native || started.current) return;
    try { await Native.start(); started.current = true; } catch { /* fall back to plate scale */ }
  }, []);

  const stop = useCallback(async () => {
    if (!Native || !started.current) return;
    try { await Native.stop(); } finally { started.current = false; }
  }, []);

  const measure = useCallback(async (): Promise<number | null> => {
    if (!Native) return null;
    try {
      const m = await Native.measure();
      const v = m.hasScale && typeof m.imgWcm === 'number' && isFinite(m.imgWcm) ? m.imgWcm : null;
      if (v !== null) setImgWcm(v);
      return v;
    } catch {
      return null;
    }
  }, []);

  return { supported, imgWcm, start, stop, measure };
}

export default useARScale;
