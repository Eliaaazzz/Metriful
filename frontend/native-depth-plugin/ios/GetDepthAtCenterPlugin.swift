//
//  GetDepthAtCenterPlugin.swift
//  VisionCamera frame-processor plugin: returns center-of-frame depth + camera
//  intrinsics so the JS layer can compute a real-world image width (img_w_cm).
//
//  ⚠️ REFERENCE TEMPLATE — must be built & tested in Xcode on a real LiDAR/ToF device.
//
//  IMPORTANT ARCHITECTURE NOTE:
//  A VisionCamera frame processor only receives the VIDEO CMSampleBuffer; on iOS,
//  AVDepthData is NEVER attached to that video buffer. Depth is delivered separately
//  by AVCaptureDepthDataOutput, paired with video through AVCaptureDataOutputSynchronizer.
//  So this plugin does NOT try to read depth off the frame buffer. Instead your capture
//  session's synchronizer delegate pushes the latest AVDepthData (plus its presentation
//  timestamp) into `DepthStore.shared`, and the plugin reads it back only if it is fresh
//  enough to pair with the current frame — the iOS analogue of the Android `DepthBridge`.
//  (DepthStore keeps just the most recent sample, not a timestamp-indexed history.)
//
//  VisionCamera v4 plugin API.
//

import Foundation
import VisionCamera
import AVFoundation
import CoreVideo
import CoreMedia

/// Thread-safe hand-off between the app's AVCaptureDataOutputSynchronizer delegate and
/// the frame processor. Populate it from `dataOutputSynchronizer(_:didOutput:)` when a
/// synchronized AVDepthData arrives:
///
///     let depth = collection.synchronizedData(for: depthOutput) as? AVCaptureSynchronizedDepthData
///     if let d = depth, !d.depthDataWasDropped {
///       DepthStore.shared.update(d.depthData, timestamp: d.timestamp)
///     }
@objc(DepthStore)
public final class DepthStore: NSObject {
  @objc public static let shared = DepthStore()

  private let lock = NSLock()
  private var latest: AVDepthData?
  private var latestTimeSeconds: Double = -1
  /// Max age between the video frame and the stored depth before we treat it as stale.
  private let maxPairingAgeSeconds = 0.12

  @objc public func update(_ depthData: AVDepthData, timestamp: CMTime) {
    lock.lock(); defer { lock.unlock() }
    latest = depthData
    latestTimeSeconds = timestamp.seconds
  }

  /// Latest depth that is fresh enough to pair with a frame at `frameTimeSeconds`.
  fileprivate func depthData(near frameTimeSeconds: Double) -> AVDepthData? {
    lock.lock(); defer { lock.unlock() }
    guard let d = latest, latestTimeSeconds >= 0 else { return nil }
    if frameTimeSeconds >= 0, abs(frameTimeSeconds - latestTimeSeconds) > maxPairingAgeSeconds {
      return nil // never pair a stale depth map with a newer video frame
    }
    return d
  }
}

@objc(GetDepthAtCenterPlugin)
public class GetDepthAtCenterPlugin: FrameProcessorPlugin {

  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
    super.init(proxy: proxy, options: options)
  }

  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any? {
    let sampleBuffer = frame.buffer

    // Video frame dimensions (must match the fx we return).
    var frameWidth = 0
    var frameHeight = 0
    if let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) {
      frameWidth = CVPixelBufferGetWidth(imageBuffer)
      frameHeight = CVPixelBufferGetHeight(imageBuffer)
    }

    let noDepth: [String: Any] = ["hasDepth": false, "width": frameWidth, "height": frameHeight]

    // Pull the synchronized depth pushed by the session's synchronizer delegate.
    let frameTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer).seconds
    guard let depthData = DepthStore.shared.depthData(near: frameTime) else {
      return noDepth
    }

    // Normalize to Float32 depth (meters).
    let converted = depthData.depthDataType == kCVPixelFormatType_DepthFloat32
      ? depthData
      : depthData.converting(toDepthDataType: kCVPixelFormatType_DepthFloat32)

    let depthMap = converted.depthDataMap
    CVPixelBufferLockBaseAddress(depthMap, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(depthMap, .readOnly) }

    let dw = CVPixelBufferGetWidth(depthMap)
    let dh = CVPixelBufferGetHeight(depthMap)
    guard dw > 0, dh > 0, let base = CVPixelBufferGetBaseAddress(depthMap) else {
      return noDepth
    }

    // Sample a small window at the center and take the median to reduce noise.
    let rowBytes = CVPixelBufferGetBytesPerRow(depthMap)
    let cx = dw / 2
    let cy = dh / 2
    let radius = max(1, min(dw, dh) / 64)
    var samples: [Float] = []
    var y = max(0, cy - radius)
    while y <= min(dh - 1, cy + radius) {
      let row = base.advanced(by: y * rowBytes).assumingMemoryBound(to: Float32.self)
      var x = max(0, cx - radius)
      while x <= min(dw - 1, cx + radius) {
        let v = row[x]
        if v.isFinite && v > 0 { samples.append(v) }
        x += 1
      }
      y += 1
    }

    guard !samples.isEmpty else { return noDepth }
    samples.sort()
    let meters = samples[samples.count / 2] // median, in meters

    // Camera intrinsics → fx in pixels, scaled to the video frame width.
    // intrinsicMatrix is expressed relative to intrinsicMatrixReferenceDimensions, so
    // it must be rescaled to the actual video frame width before use.
    var fx: Float = 0
    if let cal = converted.cameraCalibrationData {
      let refDims = cal.intrinsicMatrixReferenceDimensions
      let fxRef = cal.intrinsicMatrix.columns.0.x // intrinsicMatrix[0][0]
      if refDims.width > 0 && frameWidth > 0 {
        fx = fxRef * Float(frameWidth) / Float(refDims.width)
      } else {
        fx = fxRef
      }
    }

    // Without intrinsics (cameraCalibrationData is often nil unless
    // isCameraCalibrationDataDeliveryEnabled is set on the depth output) we cannot
    // convert distance → img_w_cm. Report "no usable depth" rather than emitting fx:0,
    // which would divide to Infinity/NaN in the JS pinhole formula.
    guard fx > 0 else { return noDepth }

    // Confidence from accuracy flag (absolute = calibrated LiDAR).
    let confidence: Float = converted.depthDataAccuracy == .absolute ? 0.95 : 0.7

    return [
      "hasDepth": true,
      "distance": meters,
      "distanceCm": meters * 100.0,
      "confidence": confidence,
      "fx": fx,
      "width": frameWidth,
      "height": frameHeight,
      "accuracy": converted.depthDataAccuracy == .absolute ? "absolute" : "relative",
    ] as [String: Any]
  }
}
