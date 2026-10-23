//
//  MetrifulLidarModule.swift
//  On-demand LiDAR depth + on-device PER-ITEM portion geometry for food-calorie correction.
//
//  Why a module (not a VisionCamera frame-processor plugin): VisionCamera does NOT pipe AVDepthData
//  into frame processors, so the old GetDepthAtCenterPlugin could never read real depth. Meal logging
//  only needs one capture, so we run a brief dedicated session and return the depth-derived features
//  the calorie refiner consumes.
//
//  Accuracy-first, all-Apple-native path (docs/calorie-accuracy-roadmap-25-to-15.md §10 + Lever #3):
//  the dominant calorie error is portion/grams, and on a MIXED plate one scene volume × one blended
//  density can't correct a bulky salad and a dense steak in opposite directions. So this session runs
//  BOTH depth and video, synchronized on the same LiDAR camera (aligned RGB↔depth, no ARSession
//  camera takeover), and on iOS 17+ uses Vision's on-device foreground *instance* segmentation
//  (VNGenerateForegroundInstanceMask, ~10ms on the Neural Engine, class-agnostic) to integrate depth
//  PER FOOD REGION. It returns, per capture:
//    - scene:  distanceCm + fx (scale hint), volumeCm3/areaCm2/meanHCm (whole-plate, food-only)
//    - items:  [{ volumeCm3, areaCm2, cx, cy }]  — one per segmented region, normalized centroid
//  The backend assigns each item to the vision model's matching food (by the model's bounding box)
//  and corrects each independently: mass_i = volume_i × density(food_i). Segmentation also removes
//  the plate/table from the integral, so even the scene total is cleaner than the old central-crop.
//
//  Geometry mirrors the offline pipeline (geom_depth.py): estimate the table plane from the depth
//  border, integrate height-above-plane × per-pixel area. Below iOS 17 (no instance mask) it degrades
//  to the whole-scene integral (previous behaviour); non-LiDAR devices return { hasDepth: false }.
//
//  Auto-linked by Expo (use_expo_modules! in the Podfile). Requires a LiDAR device (iPhone 12 Pro+)
//  and iOS 15.4+ for builtInLiDARDepthCamera; per-item segmentation additionally needs iOS 17+.
//

import ExpoModulesCore
import AVFoundation
import CoreVideo
import Vision

public class MetrifulLidarModule: Module {
  private let measurer = LidarMeasurer()

  public func definition() -> ModuleDefinition {
    Name("MetrifulLidar")

    Function("isAvailable") { () -> Bool in
      LidarMeasurer.deviceAvailable()
    }

    // Brief capture. Resolves the depth reading + per-item portion geometry, or { hasDepth: false }.
    // Never rejects — callers fall back to the backend's default plate-width assumption.
    AsyncFunction("measure") { (promise: Promise) in
      self.measurer.measure { result in promise.resolve(result) }
    }
  }
}

/// One segmented food region measured on-device: absolute volume + normalized centroid.
private struct FoodRegion {
  var volumeCm3: Float
  var areaCm2: Float
  var cx: Float   // normalized [0,1], top-left origin
  var cy: Float
  var npx: Int
}

/// Runs a short dedicated AVCaptureSession on the LiDAR depth camera with synchronized depth+video,
/// and per frame computes the center distance + a per-item geometric portion estimate. Returns the
/// richest frame (most food pixels).
final class LidarMeasurer: NSObject, AVCaptureDataOutputSynchronizerDelegate {
  private let session = AVCaptureSession()
  private let depthOutput = AVCaptureDepthDataOutput()
  private let videoOutput = AVCaptureVideoDataOutput()
  private var synchronizer: AVCaptureDataOutputSynchronizer?
  private let queue = DispatchQueue(label: "com.elia.aurafit.lidar")
  private var frames: [[String: Any]] = []
  private var done: (([String: Any]) -> Void)?
  private let targetFrames = 6

  /// > 0.5 cm above the supporting plane counts as food.
  private static let foodHeightThresholdM: Float = 0.005

  static func deviceAvailable() -> Bool {
    if #available(iOS 15.4, *) {
      return AVCaptureDevice.default(.builtInLiDARDepthCamera, for: .video, position: .back) != nil
    }
    return false
  }

  func measure(_ completion: @escaping ([String: Any]) -> Void) {
    queue.async {
      guard #available(iOS 15.4, *),
            let device = AVCaptureDevice.default(.builtInLiDARDepthCamera, for: .video, position: .back) else {
        DispatchQueue.main.async { completion(["hasDepth": false, "reason": "no_lidar"]) }
        return
      }
      self.frames.removeAll()
      self.done = completion
      do {
        self.session.beginConfiguration()
        self.session.inputs.forEach { self.session.removeInput($0) }
        self.session.outputs.forEach { self.session.removeOutput($0) }

        let input = try AVCaptureDeviceInput(device: device)
        guard self.session.canAddInput(input) else { throw NSError(domain: "lidar", code: 1) }
        self.session.addInput(input)

        guard self.session.canAddOutput(self.depthOutput) else { throw NSError(domain: "lidar", code: 2) }
        self.session.addOutput(self.depthOutput)
        self.depthOutput.isFilteringEnabled = true

        // Video output on the SAME camera → RGB frames aligned with the depth map (shared FOV), so a
        // Vision mask computed on RGB samples correctly onto depth by normalized coordinate.
        self.videoOutput.videoSettings =
          [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        self.videoOutput.alwaysDiscardsLateVideoFrames = true
        guard self.session.canAddOutput(self.videoOutput) else { throw NSError(domain: "lidar", code: 3) }
        self.session.addOutput(self.videoOutput)

        if let fmt = device.activeFormat.supportedDepthDataFormats.first(where: {
          CMFormatDescriptionGetMediaSubType($0.formatDescription) == kCVPixelFormatType_DepthFloat32
        }) {
          try device.lockForConfiguration()
          device.activeDepthDataFormat = fmt
          device.unlockForConfiguration()
        }
        if let conn = self.depthOutput.connection(with: .depthData) { conn.isEnabled = true }

        // Deliver depth+video as time-matched pairs on our background queue.
        let sync = AVCaptureDataOutputSynchronizer(dataOutputs: [self.depthOutput, self.videoOutput])
        sync.setDelegate(self, queue: self.queue)
        self.synchronizer = sync

        self.session.commitConfiguration()
        self.session.startRunning()
        self.queue.asyncAfter(deadline: .now() + 2.0) { [weak self] in self?.finish() }
      } catch {
        self.session.commitConfiguration()
        DispatchQueue.main.async { completion(["hasDepth": false, "reason": "config_error"]) }
        self.done = nil
      }
    }
  }

  func dataOutputSynchronizer(_ synchronizer: AVCaptureDataOutputSynchronizer,
                              didOutput collection: AVCaptureSynchronizedDataCollection) {
    guard let depthData = (collection.synchronizedData(for: depthOutput)
            as? AVCaptureSynchronizedDepthData), !depthData.depthDataWasDropped else { return }
    let rgb = (collection.synchronizedData(for: videoOutput) as? AVCaptureSynchronizedSampleBufferData)
      .flatMap { CMSampleBufferGetImageBuffer($0.sampleBuffer) }

    let converted = depthData.depthData.depthDataType == kCVPixelFormatType_DepthFloat32
      ? depthData.depthData
      : depthData.depthData.converting(toDepthDataType: kCVPixelFormatType_DepthFloat32)

    let map = converted.depthDataMap
    CVPixelBufferLockBaseAddress(map, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(map, .readOnly) }

    let w = CVPixelBufferGetWidth(map)
    let h = CVPixelBufferGetHeight(map)
    guard w > 0, h > 0, let base = CVPixelBufferGetBaseAddress(map) else { return }
    let rowBytes = CVPixelBufferGetBytesPerRow(map)

    // fx (px) scaled to depth-map width.
    var fx: Float = 0
    if let cal = converted.cameraCalibrationData {
      let ref = cal.intrinsicMatrixReferenceDimensions
      let fxRef = cal.intrinsicMatrix.columns.0.x
      fx = ref.width > 0 ? fxRef * Float(w) / Float(ref.width) : fxRef
    }
    guard fx > 0 else { return }

    @inline(__always) func depthAt(_ x: Int, _ y: Int) -> Float {
      base.advanced(by: y * rowBytes).assumingMemoryBound(to: Float32.self)[x]
    }

    // --- table plane = median of a depth border ring (the plate/surface) ---
    let b = max(2, min(w, h) / 16)
    var border: [Float] = []
    for y in 0..<h {
      let topBottom = y < b || y >= h - b
      for x in 0..<w where (topBottom || x < b || x >= w - b) {
        let d = depthAt(x, y); if d.isFinite && d > 0 { border.append(d) }
      }
    }
    guard border.count > 50 else { return }
    border.sort(); let plane = border[border.count / 2]   // meters

    // --- center distance (median of small center window) ---
    let cx = w / 2, cy = h / 2, r = max(1, min(w, h) / 32)
    var center: [Float] = []
    for y in max(0, cy - r)...min(h - 1, cy + r) {
      for x in max(0, cx - r)...min(w - 1, cx + r) {
        let d = depthAt(x, y); if d.isFinite && d > 0 { center.append(d) }
      }
    }
    guard !center.isEmpty else { return }
    center.sort(); let distM = center[center.count / 2]

    // --- per-item regions via Vision instance segmentation (iOS 17+), else one whole-scene region ---
    var regions: [FoodRegion] = []
    if #available(iOS 17.0, *), let rgb = rgb {
      regions = segmentedRegions(rgb: rgb, depthBase: base, rowBytes: rowBytes,
                                 w: w, h: h, fx: fx, plane: plane)
    }
    if regions.isEmpty {
      // Fallback: whole-scene integral over the central 80% (mirror of the previous behaviour).
      regions = [wholeSceneRegion(depthBase: base, rowBytes: rowBytes, w: w, h: h, fx: fx, plane: plane)]
    }

    let sceneVol = regions.reduce(0) { $0 + $1.volumeCm3 }
    let sceneArea = regions.reduce(0) { $0 + $1.areaCm2 }
    let sceneNpx = regions.reduce(0) { $0 + $1.npx }
    // Mean height is informational; derive from total volume/area to stay consistent with per-item.
    let meanHcm = sceneArea > 0 ? sceneVol / sceneArea : 0

    let items: [[String: Any]] = regions
      .filter { $0.volumeCm3 > 0 && $0.npx > 0 }
      .map { ["volumeCm3": $0.volumeCm3, "areaCm2": $0.areaCm2, "cx": $0.cx, "cy": $0.cy] }

    frames.append([
      "distanceCm": distM * 100.0,
      "distance": distM,
      "fx": fx,
      "width": w,
      "volumeCm3": sceneVol,
      "areaCm2": sceneArea,
      "meanHCm": meanHcm,
      "npx": sceneNpx,
      "items": items,
    ])
    if frames.count >= targetFrames { finish() }
  }

  /// Whole-scene integral over the central 80% (used below iOS 17 or when segmentation finds nothing).
  private func wholeSceneRegion(depthBase base: UnsafeMutableRawPointer, rowBytes: Int,
                                w: Int, h: Int, fx: Float, plane: Float) -> FoodRegion {
    @inline(__always) func depthAt(_ x: Int, _ y: Int) -> Float {
      base.advanced(by: y * rowBytes).assumingMemoryBound(to: Float32.self)[x]
    }
    let x0 = w / 10, x1 = w - w / 10, y0 = h / 10, y1 = h - h / 10
    var volCm3: Float = 0, areaCm2: Float = 0, npx = 0
    var sumX: Float = 0, sumY: Float = 0
    for y in y0..<y1 {
      for x in x0..<x1 {
        let d = depthAt(x, y); if !(d.isFinite && d > 0) { continue }
        let heightM = plane - d
        if heightM > Self.foodHeightThresholdM {
          let pxLin = d / fx
          let pxAreaM2 = pxLin * pxLin
          volCm3 += heightM * pxAreaM2 * 1_000_000
          areaCm2 += pxAreaM2 * 10_000
          sumX += Float(x); sumY += Float(y); npx += 1
        }
      }
    }
    let cx = npx > 0 ? (sumX / Float(npx)) / Float(w) : 0.5
    let cy = npx > 0 ? (sumY / Float(npx)) / Float(h) : 0.5
    return FoodRegion(volumeCm3: volCm3, areaCm2: areaCm2, cx: cx, cy: cy, npx: npx)
  }

  /// Per-instance regions: run foreground instance segmentation on the RGB frame, and for each
  /// instance integrate depth over that mask (sampled by normalized coordinate into depth space).
  @available(iOS 17.0, *)
  private func segmentedRegions(rgb: CVPixelBuffer, depthBase base: UnsafeMutableRawPointer,
                                rowBytes: Int, w: Int, h: Int, fx: Float, plane: Float) -> [FoodRegion] {
    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cvPixelBuffer: rgb, orientation: .up, options: [:])
    guard (try? handler.perform([request])) != nil,
          let observation = request.results?.first as? VNInstanceMaskObservation else {
      return []
    }
    @inline(__always) func depthAt(_ x: Int, _ y: Int) -> Float {
      base.advanced(by: y * rowBytes).assumingMemoryBound(to: Float32.self)[x]
    }
    var regions: [FoodRegion] = []
    for instance in observation.allInstances {
      guard let maskBuffer = try? observation.generateScaledMaskForImage(
              forInstances: IndexSet(integer: instance), from: handler) else { continue }
      CVPixelBufferLockBaseAddress(maskBuffer, .readOnly)
      defer { CVPixelBufferUnlockBaseAddress(maskBuffer, .readOnly) }
      let mw = CVPixelBufferGetWidth(maskBuffer)
      let mh = CVPixelBufferGetHeight(maskBuffer)
      guard mw > 0, mh > 0, let mBase = CVPixelBufferGetBaseAddress(maskBuffer) else { continue }
      let mRow = CVPixelBufferGetBytesPerRow(maskBuffer)

      @inline(__always) func maskAt(_ u: Float, _ v: Float) -> Float {
        let mx = min(mw - 1, max(0, Int(u * Float(mw))))
        let my = min(mh - 1, max(0, Int(v * Float(mh))))
        return mBase.advanced(by: my * mRow).assumingMemoryBound(to: Float32.self)[mx]
      }

      var volCm3: Float = 0, areaCm2: Float = 0, npx = 0
      var sumX: Float = 0, sumY: Float = 0
      for y in 0..<h {
        let v = (Float(y) + 0.5) / Float(h)
        for x in 0..<w {
          let d = depthAt(x, y); if !(d.isFinite && d > 0) { continue }
          let heightM = plane - d
          if heightM <= Self.foodHeightThresholdM { continue }
          let u = (Float(x) + 0.5) / Float(w)
          if maskAt(u, v) < 0.5 { continue }          // pixel not in this instance
          let pxLin = d / fx
          let pxAreaM2 = pxLin * pxLin
          volCm3 += heightM * pxAreaM2 * 1_000_000
          areaCm2 += pxAreaM2 * 10_000
          sumX += Float(x); sumY += Float(y); npx += 1
        }
      }
      if npx > 0 && volCm3 > 0 {
        regions.append(FoodRegion(volumeCm3: volCm3, areaCm2: areaCm2,
                                  cx: (sumX / Float(npx)) / Float(w),
                                  cy: (sumY / Float(npx)) / Float(h), npx: npx))
      }
    }
    return regions
  }

  /// Return the frame with the most food pixels (most complete view); never throws.
  private func finish() {
    guard let completion = done else { return }
    done = nil
    if session.isRunning { session.stopRunning() }
    synchronizer = nil
    guard let best = frames.max(by: { ($0["npx"] as? Int ?? 0) < ($1["npx"] as? Int ?? 0) }) else {
      DispatchQueue.main.async { completion(["hasDepth": false, "reason": "no_samples"]) }
      return
    }
    var result = best
    result["hasDepth"] = true
    result["confidence"] = 0.95
    result["accuracy"] = "absolute"
    DispatchQueue.main.async { completion(result) }
  }
}
