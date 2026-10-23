//
//  GetDepthAtCenterPlugin.swift
//  VisionCamera frame-processor plugin: returns center-of-frame depth + camera
//  intrinsics so the JS layer can compute a real-world image width (img_w_cm).
//
//  ⚠️ REFERENCE TEMPLATE — must be built & tested in Xcode on a real LiDAR/ToF device.
//  Depth is only attached to the frame if your capture session has depth output
//  enabled and synchronized with the video output (see README).
//
//  VisionCamera v4 plugin API.
//

import Foundation
import VisionCamera
import AVFoundation
import CoreVideo
import CoreMedia

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

    // Obtain the AVDepthData attached to this frame.
    // Requires AVCaptureDepthDataOutput synchronized with video on the session.
    guard let depthData = Self.depthData(from: sampleBuffer) else {
      return [
        "hasDepth": false,
        "width": frameWidth,
        "height": frameHeight,
      ]
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
      return ["hasDepth": false, "width": frameWidth, "height": frameHeight]
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

    guard !samples.isEmpty else {
      return ["hasDepth": false, "width": frameWidth, "height": frameHeight]
    }
    samples.sort()
    let meters = samples[samples.count / 2] // median, in meters

    // Camera intrinsics → fx in pixels, scaled to the video frame width.
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

  /// Read AVDepthData attached to the sample buffer (requires depth output enabled & synced).
  private static func depthData(from sampleBuffer: CMSampleBuffer) -> AVDepthData? {
    guard let attachment = CMGetAttachment(
      sampleBuffer,
      key: "AVDepthData" as CFString, // see README: set via your synchronized depth output
      attachmentModeOut: nil
    ) else {
      return nil
    }
    // When using AVCaptureDataOutputSynchronizer you typically have the AVDepthData
    // object directly — pass it through to this plugin instead of via attachment.
    return attachment as? AVDepthData
  }
}
