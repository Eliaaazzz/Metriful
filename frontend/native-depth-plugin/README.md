# `__getDepthAtCenter` — native depth frame-processor plugin

This folder contains **reference templates** for the native VisionCamera frame-processor
plugin that the JS layer already calls. The TypeScript side is fully wired:

```
LiDAR/ToF depth ──▶ global.__getDepthAtCenter(frame)   ← THIS PLUGIN (native)
                    └▶ useDepthCamera (DepthResult)
                       └▶ VisionCameraView capture metadata
                          └▶ estimateImageWidthCm()  (src/utils/scale.ts)
                             └▶ ReviewMealScreen → img_w_cm
                                └▶ backend GeminiMealAnalysisService prompt scale
```

Until this plugin is built into the app, `__getDepthAtCenter` is absent, the frame
processor skips silently, `distanceCm` is `null`, `estimateImageWidthCm()` returns
`null`, and the app falls back to the default plate-width assumption. So shipping
without it is safe — it just doesn't add real scale yet.

> ⚠️ These files cannot be compiled or tested outside Xcode / Android Studio on a
> real LiDAR/ToF device. Treat them as a strong starting point, not drop-in code.

## The contract (what the worklet must return)

A plain object matching `DepthResult` in `src/hooks/useDepthCamera.ts`:

```ts
{
  hasDepth: boolean,
  distance: number | null,      // meters, center of frame
  distanceCm: number | null,    // == distance * 100
  confidence: number,           // 0..1
  width?: number,               // frame width in px (must match fx)
  height?: number,
  fx?: number,                  // focal length in px (camera intrinsics) — preferred for scale
  horizontalFovDeg?: number,    // fallback if fx is unavailable
  accuracy?: 'absolute' | 'relative' | 'high' | 'medium' | 'low'
}
```

`estimateImageWidthCm()` prefers `fx` + `width` (pinhole: `img_w_cm = distanceCm * width / fx`),
and falls back to `horizontalFovDeg` (`img_w_cm = 2 · distanceCm · tan(HFOV/2)`). Returning
`fx` is strongly preferred — it's the most accurate and avoids the FOV guess.

## iOS (Swift) — `ios/GetDepthAtCenterPlugin.swift` + `.m`

Two viable depth sources on iOS:

1. **AVFoundation depth (this template).** Enable `AVCaptureDepthDataOutput` on the
   capture session and synchronize it with video so the depth map is attached to the
   frame. Read the center pixel of the `kCVPixelFormatType_DepthFloat32` map and
   `cameraCalibrationData.intrinsicMatrix[0][0]` for `fx` (scale it to the video
   frame width — see code).
2. **ARKit (recommended for LiDAR).** Run an `ARSession` with
   `configuration.frameSemantics = .sceneDepth`; read `frame.sceneDepth.depthMap`
   center + `frame.camera.intrinsics[0][0]` for `fx`. Cleaner and dense on LiDAR
   devices, but it's a separate camera session from VisionCamera — if you go this
   route, expose depth via a small native module instead of a frame-processor
   worklet and read it in `useDepthCamera` rather than through `__getDepthAtCenter`.

Register the plugin (VisionCamera v4) — see `.m` file. JS calls it as
`global.__getDepthAtCenter(frame)` via the `useFrameProcessor` worklet already in
`useDepthCamera.ts`.

## Android (Kotlin) — `android/GetDepthAtCenterPlugin.kt`

Use Camera2 `DEPTH16` / ToF output, read the center depth sample (millimeters →
meters), and read `LENS_INTRINSIC_CALIBRATION` for `fx`. Register via
`FrameProcessorPluginRegistry.addFrameProcessorPlugin("getDepthAtCenter", ...)`.

## Build / test steps (on your machine)

1. Copy the iOS files into your Xcode app target (and add the `-Swift.h` bridging
   import in the `.m`); copy the Kotlin file into your Android app package.
2. Ensure depth output is enabled on the capture session (iOS) / a DEPTH16 stream
   is configured (Android).
3. `cd frontend && npx expo prebuild` (or open `ios/`/`android/` directly), then
   build to a **real device with LiDAR/ToF** (simulators have no depth).
4. In the meal camera, confirm logs show a non-null `distanceCm` and that the
   request to the backend now carries a measured `img_w_cm` (not the 35cm default).

## How to verify the scale is actually flowing

- Add a temporary `console.log` of `metadata.imgWcm` in `VisionCameraView.takePhoto`.
- Backend `GeminiMealAnalysisService` logs the prompt context; confirm
  `"img_w_cm": <measured>` appears instead of the default.

---

# `ARScaleModule` — standard_ar (no-LiDAR) scale source

For the **`standard_ar` tier** (`useDeviceCapabilities`): devices with ARKit but **no** depth
sensor (most non-Pro iPhones, ARCore Androids). Instead of a depth map, it raycasts the center of
the frame to a detected **horizontal plane** (the table) and returns the camera-to-plane distance →
`img_w_cm` via the same pinhole formula. This slots between LiDAR (±1cm) and the plate-reference
fallback (±5cm), at ≈±3cm.

```
no depth sensor + ARKit ──▶ ARScaleModule.measure()  ← THIS MODULE (native)
                            └▶ useARScale (imgWcm)
                               └▶ ReviewMealScreen → img_w_cm  (same path as LiDAR)
```

Files: `ios/ARScaleModule.swift` + `ios/ARScaleModule.m`. JS: `src/hooks/useARScale.ts`
(degrades to `supported=false` → plate fallback when the native module is absent — never fabricates
a number). `measure()` returns `{ hasScale, distanceCm, imgWcm, fx, trackingState }`.

> ⚠️ REFERENCE TEMPLATE — ARKit needs its own `ARSession`; it can't run at the same time as the
> VisionCamera/expo-camera preview. Intended as a brief **calibration tap** (start → measure → stop)
> on standard_ar devices, NOT a continuous parallel session.

## Integration (remaining device-side steps)

1. Add `ARScaleModule.swift` + `.m` to the Xcode target (same `-Swift.h` bridging import as the
   depth plugin). Ensure `NSCameraUsageDescription` is set.
2. In the capture screen, for `tier === 'standard_ar'`, mount a small AR calibration step:
   `const ar = useARScale(); await ar.start(); const imgWcm = await ar.measure(); ar.stop();`
   then pass `imgWcm` into the same `navigation.setParams({ ... imgWcm })` path
   `VisionCameraView` uses for LiDAR. (This is the part that needs a real device — ARKit raycasting
   does not run in the simulator.)
3. Android/ARCore equivalent (`ARCore` Frame `hitTest` on a detected plane) is a parallel TODO; the
   JS hook already no-ops on Android until added.

## Verify

- `await NativeModules.ARScaleModule.isSupported()` → `true` on an ARKit device.
- After a `measure()` with the camera aimed at food on a table, `imgWcm` is a plausible 12–90 cm
  (clamped in `scale.ts`), and the backend prompt carries `"img_w_cm": <measured>`.
