# Native real-world scale

This directory contains native reference templates for depth frame processors and
ARKit plane raycasts. Device compilation and calibration remain required.

## Current capture flow

- `VisionCameraView.takePhoto` first calls the dedicated `useLidarScale` module.
- It falls back to frame-processor depth through `useDepthCamera` and
  `estimateImageWidthCm` in `src/utils/scale.ts`.
- `DepthResult` carries `distanceCm`, `fx`, `width`, and optional `horizontalFovDeg`.
  `CaptureMetadata.imgWcm` passes the result to `ReviewMealScreen`, which sends
  `img_w_cm` to the backend. Missing scale uses the 35cm plate default.
- `useARScale` wraps `ARScaleModule.swift` and rejects readings outside 12 to 90cm.
  The capture screen still has no caller for this hook. Building the template and
  integrating its camera session remain follow-up work.
- The `lidar` device tier covers iOS LiDAR and listed Android depth devices.
  Device model classification alone does not prove a depth source is available.
  The fallback expo-camera hook returns no automatic distance.

## Depth plugin contract

```ts
interface DepthResult {
  hasDepth: boolean;
  distance: number | null;      // meters
  distanceCm: number | null;
  confidence: number;           // confidence of the selected depth, 0 to 1
  fx?: number;                  // focal length at the video frame resolution
  width?: number;
  height?: number;
  horizontalFovDeg?: number;
  accuracy?: 'absolute' | 'relative' | 'high' | 'medium' | 'low';
  error?: string;
}
```

The pinhole formula is `img_w_cm = distanceCm * width / fx`. Intrinsics and width
must refer to the same resolution. The existing JS helper supports a FOV fallback
and clamps valid estimates to 12 to 90cm. The AR bridge rejects out-of-range
raycasts and returns null. These paths have different validation rules.

## iOS depth template

`ios/GetDepthAtCenterPlugin.swift` reads `DepthStore`, which receives synchronized
`AVDepthData` from the capture session. A VisionCamera video sample buffer does
not itself deliver the separate depth output.

1. Configure `AVCaptureDepthDataOutput` and an `AVCaptureDataOutputSynchronizer`
   for the video and depth outputs. Enable calibration-data delivery on the
   supported capture connection so the plugin can obtain intrinsics.
2. Push synchronized depth into the store:

   ```swift
   let d = collection.synchronizedData(for: depthOutput) as? AVCaptureSynchronizedDepthData
   if let d, !d.depthDataWasDropped {
     DepthStore.shared.update(d.depthData, timestamp: d.timestamp)
   }
   ```

3. Add the Swift and Objective-C registration files to the Xcode target and wire
   the registered plugin to `global.__getDepthAtCenter(frame)` in the worklet.

The store retains one sample and accepts a timestamp difference of at most 0.12s.
Missing depth or nonpositive focal length produces `hasDepth:false`.
The dedicated `frontend/modules/metriful-lidar` module provides a separate ARKit
scene-depth path. Validate camera ownership when switching native sessions.

## Android depth template

`android/GetDepthAtCenterPlugin.kt` expects a Camera2 DEPTH16 ImageReader and
`DepthBridge.latestDepthImage(frame.timestamp)` aligned to the video timestamp.
Implement that bridge and `focalLengthPx` using camera calibration scaled to the
frame width. The supplied bridge currently returns no depth and zero focal length.

DEPTH16 uses 13 bits for depth in millimeters and 3 bits for confidence. Confidence
code zero means 1; other codes map to `(code - 1) / 7`. The plugin returns the
median nonzero depth with that sample's own confidence. JS can reject an
unreliable selected depth. Sample confidence alone does not establish absolute
calibration, so the template reports relative accuracy.

Register with `FrameProcessorPluginRegistry.addFrameProcessorPlugin` and connect
the JS worklet. Confirm ImageReader ownership and release behavior on device.

## AR plane template

`ios/ARScaleModule.swift` and `.m` expose `isSupported`, `start`, `measure`, and
`stop`. `measure` returns `{ hasScale, distanceCm, imgWcm, fx, trackingState }`.
`useARScale` serializes startup and release, including release after delayed
startup. It returns null when the native module is absent, tracking fails, or a
raycast is implausible. Android has no ARCore implementation here.

Capture integration must release the active camera before starting the AR session,
then pass the measured `imgWcm` through capture metadata to review. Follow that
with device testing for camera handoff, interrupted tracking, and repeated capture.

## Verification

- JS tests: `npm test -- --maxWorkers=2` from `frontend`.
- TypeScript: `npm run type-check` from `frontend`.
- Native: build on physical iOS and Android depth devices. Verify timestamp
  pairing, focal-length scaling, low-confidence rejection, rotation and cropping.
- Inspect capture metadata and the outbound nutrition request to confirm a real
  measurement reaches `img_w_cm`. An absent reading should use the plate default.
- No native compilation, accuracy measurement, or device test is implied by the
  JavaScript test results.
