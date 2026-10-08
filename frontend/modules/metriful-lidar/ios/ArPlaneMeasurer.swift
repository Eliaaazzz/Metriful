//
//  ArPlaneMeasurer.swift
//  Standard-AR (no-LiDAR) scale source: camera-to-table distance from an ARKit horizontal-plane
//  raycast at the frame center, plus the live camera intrinsics. JS turns (distance, fx, width) into
//  img_w_cm with the same pinhole formula the LiDAR path uses (src/utils/scale.ts).
//
//  Runs as a brief dedicated ARSession right after the photo is taken (same pattern as LidarMeasurer):
//  ARKit owns the camera while it runs, so it can't share the preview session. Raycasting is done on
//  the ARFrame in normalized image coordinates, so no ARSCNView or on-screen view is needed.
//
//  Never fabricates: if tracking doesn't initialize or no plane is hit before the timeout, it resolves
//  { hasScale: false } and the backend keeps its default plate-width assumption.
//

import ARKit
import UIKit
import simd

final class ArPlaneMeasurer: NSObject {
  private var session: ARSession?
  private var samplesM: [Float] = []
  private var lastFx: Float = 0
  private var lastWidth: Int = 0
  private var lastTracking = "notAvailable"
  private var deadline = Date()
  private var done: (([String: Any]) -> Void)?

  private let targetSamples = 5
  private let timeoutS: TimeInterval = 2.5
  private let pollS: TimeInterval = 0.1
  /// Plausible hand-held food-photo distance band (m); anything else is a bad hit (floor, wall).
  private let minDepthM: Float = 0.1
  private let maxDepthM: Float = 1.5

  static func deviceAvailable() -> Bool {
    ARWorldTrackingConfiguration.isSupported
  }

  func measure(_ completion: @escaping ([String: Any]) -> Void) {
    DispatchQueue.main.async {
      guard ARWorldTrackingConfiguration.isSupported else {
        completion(["hasScale": false, "reason": "ar_unsupported"]); return
      }
      guard self.done == nil else {
        completion(["hasScale": false, "reason": "busy"]); return
      }
      self.done = completion
      self.samplesM.removeAll()
      self.lastFx = 0
      self.lastWidth = 0
      self.lastTracking = "notAvailable"

      let cfg = ARWorldTrackingConfiguration()
      cfg.planeDetection = [.horizontal]
      let s = ARSession()
      self.session = s
      s.run(cfg, options: [.resetTracking, .removeExistingAnchors])
      self.deadline = Date().addingTimeInterval(self.timeoutS)
      self.poll()
    }
  }

  /// Main-thread poll: sample one center raycast per tick until enough samples or the deadline.
  private func poll() {
    guard done != nil, let s = session else { return }
    if let frame = s.currentFrame {
      lastTracking = Self.describe(frame.camera.trackingState)
      if case .normal = frame.camera.trackingState, let depth = centerDepth(frame, session: s) {
        samplesM.append(depth)
        // Intrinsics live in the landscape sensor frame. In portrait the photo's horizontal axis is the
        // sensor's y axis, so img_w must use (height, fy); in landscape it's (width, fx).
        let intr = frame.camera.intrinsics
        let res = frame.camera.imageResolution
        if Self.isPortrait() {
          lastFx = intr.columns.1.y
          lastWidth = Int(res.height)
        } else {
          lastFx = intr.columns.0.x
          lastWidth = Int(res.width)
        }
      }
    }
    if samplesM.count >= targetSamples || Date() >= deadline {
      finish()
    } else {
      DispatchQueue.main.asyncAfter(deadline: .now() + pollS) { [weak self] in self?.poll() }
    }
  }

  /// Depth along the optical axis (m) to the horizontal surface under the frame center. Prefers a
  /// detected plane anchor, then ARKit's feature-point plane estimate.
  private func centerDepth(_ frame: ARFrame, session s: ARSession) -> Float? {
    let center = CGPoint(x: 0.5, y: 0.5)
    let targets: [ARRaycastQuery.Target] = [.existingPlaneGeometry, .estimatedPlane]
    for target in targets {
      let query = frame.raycastQuery(from: center, allowing: target, alignment: .horizontal)
      guard let hit = s.raycast(query).first else { continue }
      // Hit point in camera space; ARKit cameras look down -Z.
      let p = simd_mul(simd_inverse(frame.camera.transform), hit.worldTransform.columns.3)
      let depth = -p.z
      if depth.isFinite && depth >= minDepthM && depth <= maxDepthM { return depth }
    }
    return nil
  }

  private func finish() {
    guard let completion = done else { return }
    done = nil
    session?.pause()
    session = nil

    guard !samplesM.isEmpty, lastFx > 0, lastWidth > 0 else {
      completion(["hasScale": false, "reason": "no_plane", "trackingState": lastTracking])
      return
    }
    let sorted = samplesM.sorted()
    let distM = sorted[sorted.count / 2]
    // Fewer samples → less agreement evidence. Cap below LiDAR's 0.95.
    let confidence = min(0.8, 0.5 + 0.06 * Float(sorted.count))
    completion([
      "hasScale": true,
      "distanceCm": distM * 100.0,
      "fx": lastFx,
      "width": lastWidth,
      "samples": sorted.count,
      "confidence": confidence,
      "trackingState": lastTracking,
    ])
  }

  /// Interface orientation of the foreground scene (main thread only). Defaults to portrait.
  private static func isPortrait() -> Bool {
    let scene = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first { $0.activationState == .foregroundActive }
    return !(scene?.interfaceOrientation.isLandscape ?? false)
  }

  private static func describe(_ state: ARCamera.TrackingState) -> String {
    switch state {
    case .normal: return "normal"
    case .notAvailable: return "notAvailable"
    case .limited(let reason):
      switch reason {
      case .initializing: return "limited:initializing"
      case .excessiveMotion: return "limited:excessiveMotion"
      case .insufficientFeatures: return "limited:insufficientFeatures"
      case .relocalizing: return "limited:relocalizing"
      @unknown default: return "limited"
      }
    }
  }
}
