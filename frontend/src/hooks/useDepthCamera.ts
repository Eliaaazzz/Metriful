/**
 * useDepthCamera Hook
 *
 * Provides real-time depth measurement using react-native-vision-camera
 * with native Frame Processor plugins for LiDAR (iOS) and ToF (Android).
 *
 * Features:
 * - Automatic device capability detection
 * - Real-time depth readings at 30fps
 * - Confidence-based filtering
 * - Graceful fallback for devices without depth sensors
 *
 * NOTE: This hook only works on native (iOS/Android).
 * On web, it returns a stub implementation.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useDeviceCapabilities } from './useDeviceCapabilities';

// VisionCamera imports - only available on native
let Camera: any = null;
let useCameraDevice: any = null;
let useCameraFormat: any = null;
let useFrameProcessor: any = null;
let useSharedValue: any = null;
let runOnJS: any = null;

// Only import on native platforms
if (Platform.OS !== 'web') {
  try {
    const VisionCamera = require('react-native-vision-camera');
    Camera = VisionCamera.Camera;
    useCameraDevice = VisionCamera.useCameraDevice;
    useCameraFormat = VisionCamera.useCameraFormat;
    useFrameProcessor = VisionCamera.useFrameProcessor;

    const Reanimated = require('react-native-reanimated');
    useSharedValue = Reanimated.useSharedValue;
    runOnJS = Reanimated.runOnJS;
  } catch (e) {
    console.warn('VisionCamera not available:', e);
  }
}

// Import types for TypeScript
type CameraDevice = any;
type CameraDeviceFormat = any;

// Frame Processor plugin types
declare const global: {
  __getDepthAtCenter?: (frame: any) => DepthResult;
};

export interface DepthResult {
  hasDepth: boolean;
  distance: number | null; // meters
  distanceCm: number | null; // centimeters
  confidence: number; // 0-1
  accuracy?: 'absolute' | 'relative' | 'high' | 'medium' | 'low';
  width?: number;  // frame width in px (matches fx)
  height?: number; // frame height in px
  fx?: number;     // focal length in px from camera intrinsics (for real-world scale)
  horizontalFovDeg?: number; // horizontal field of view in degrees (fallback for scale)
  error?: string;
}

export interface DepthCameraState {
  isReady: boolean;
  isActive: boolean;
  hasPermission: boolean;
  supportsDepth: boolean;
  device: CameraDevice | undefined;
  format: CameraDeviceFormat | undefined;
  currentDepth: DepthResult | null;
  error: string | null;
}

export interface UseDepthCameraOptions {
  /** Enable depth capture (default: true) */
  enableDepth?: boolean;
  /** Minimum confidence threshold (default: 0.5) */
  minConfidence?: number;
  /** Target FPS for depth readings (default: 30) */
  targetFps?: number;
  /** Callback when depth value changes significantly */
  onDepthChange?: (depth: DepthResult) => void;
}

const DEFAULT_OPTIONS: Required<Omit<UseDepthCameraOptions, 'onDepthChange'>> = {
  enableDepth: true,
  minConfidence: 0.5,
  targetFps: 30,
};

export function useDepthCamera(options: UseDepthCameraOptions = {}) {
  const { enableDepth, minConfidence, targetFps } = { ...DEFAULT_OPTIONS, ...options };

  const capabilities = useDeviceCapabilities();

  // On web, return a stub implementation
  if (Platform.OS === 'web' || !useCameraDevice || !useFrameProcessor) {
    return {
      isReady: false,
      isActive: false,
      hasPermission: false,
      supportsDepth: false,
      device: undefined,
      format: undefined,
      currentDepth: null,
      error: 'VisionCamera not available on web',
      start: () => {},
      stop: () => {},
      frameProcessor: undefined,
      deviceTier: capabilities.tier,
    };
  }

  const [hasPermission, setHasPermission] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [currentDepth, setCurrentDepth] = useState<DepthResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lastDepthRef = useRef<number | null>(null);

  // Shared value for frame processor
  const depthValue = useSharedValue(null as DepthResult | null);

  // Get camera device with depth support
  const device = useCameraDevice('back', {
    physicalDevices: Platform.OS === 'ios'
      ? ['ultra-wide-angle-camera', 'wide-angle-camera'] // LiDAR is paired with wide-angle on iPhone
      : ['wide-angle-camera'], // Android ToF varies by device
  });

  // Find format that supports depth capture
  const format = useCameraFormat(device, [
    { videoResolution: { width: 1920, height: 1080 } },
    { fps: targetFps },
    // Prefer formats with depth support
    { videoStabilizationMode: 'auto' },
  ]);

  // Check if depth is actually supported
  const supportsDepth = useMemo(() => {
    if (!device || !format) return false;

    // iOS: Check if device has LiDAR
    if (Platform.OS === 'ios') {
      return capabilities.hasLiDAR;
    }

    // Android: Check for ToF sensor support
    // This is device-specific and may need format.supportsDepthCapture check
    return capabilities.hasToF;
  }, [device, format, capabilities]);

  // Request camera permission
  useEffect(() => {
    (async () => {
      try {
        const status = await Camera.requestCameraPermission();
        setHasPermission(status === 'granted');
        if (status !== 'granted') {
          setError('Camera permission denied');
        }
      } catch (e) {
        setError(`Permission error: ${e}`);
      }
    })();
  }, []);

  // Update depth state from frame processor (called from worklet via runOnJS)
  const updateDepth = useCallback((result: DepthResult) => {
    if (!result.hasDepth || result.confidence < minConfidence) {
      return;
    }

    setCurrentDepth(result);

    // Notify callback if depth changed significantly (>2cm)
    if (result.distanceCm !== null) {
      const lastDepth = lastDepthRef.current;
      if (lastDepth === null || Math.abs(result.distanceCm - lastDepth) > 2) {
        lastDepthRef.current = result.distanceCm;
        options.onDepthChange?.(result);
      }
    }
  }, [minConfidence, options]);

  // Frame processor for reading depth data
  const frameProcessor = useFrameProcessor((frame: any) => {
    'worklet';

    // Check if the native plugin is available
    if (typeof global.__getDepthAtCenter !== 'function') {
      // Plugin not loaded - skip silently
      return;
    }

    try {
      const result = global.__getDepthAtCenter(frame);
      depthValue.value = result;

      // Send to JS thread
      if (result.hasDepth && result.confidence > 0) {
        runOnJS(updateDepth)(result);
      }
    } catch (e) {
      // Frame processor errors are silent to avoid spam
    }
  }, [updateDepth]);

  // Start/stop camera
  const start = useCallback(() => {
    if (!hasPermission || !device) {
      setError('Cannot start: no permission or device');
      return;
    }
    setIsActive(true);
    setError(null);
  }, [hasPermission, device]);

  const stop = useCallback(() => {
    setIsActive(false);
    setCurrentDepth(null);
    lastDepthRef.current = null;
  }, []);

  // Camera state
  const state: DepthCameraState = {
    isReady: hasPermission && !!device && !!format,
    isActive,
    hasPermission,
    supportsDepth: supportsDepth && enableDepth,
    device,
    format,
    currentDepth,
    error,
  };

  return {
    ...state,
    start,
    stop,
    frameProcessor: enableDepth && supportsDepth ? frameProcessor : undefined,
    deviceTier: capabilities.tier,
  };
}

/**
 * Get optimal distance string for display
 */
export function formatDistance(depth: DepthResult | null): string {
  if (!depth || depth.distanceCm === null) {
    return '--';
  }

  const cm = Math.round(depth.distanceCm);
  if (cm < 100) {
    return `${cm}cm`;
  }

  const m = (cm / 100).toFixed(1);
  return `${m}m`;
}

/**
 * Check if distance is in optimal range for food photography
 */
export function isOptimalDistance(
  depth: DepthResult | null,
  minCm = 20,
  maxCm = 60
): boolean {
  if (!depth || depth.distanceCm === null) {
    return false;
  }
  return depth.distanceCm >= minCm && depth.distanceCm <= maxCm;
}

export default useDepthCamera;
