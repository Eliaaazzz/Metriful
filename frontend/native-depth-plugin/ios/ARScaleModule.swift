//
//  ARScaleModule.swift
//  Standard-AR (no-LiDAR) scale source. For devices WITHOUT a depth sensor but WITH ARKit,
//  this measures the camera-to-table distance via a horizontal-plane raycast and returns the
//  real-world image width (img_w_cm) — the SAME scale signal the LiDAR frame-processor produces,
//  so the rest of the pipeline (portion/mass estimation) is unchanged. This is the `standard_ar`
//  tier in useDeviceCapabilities (≈±3cm, between LiDAR ±1cm and the plate-reference fallback ±5cm).
//
//  ⚠️ REFERENCE TEMPLATE — must be built & tested in Xcode on a real ARKit device.
//  ARKit needs its own ARSession; it cannot run simultaneously with the VisionCamera/expo-camera
//  preview. Intended use: a brief "calibration tap" (start → measure → stop) on standard_ar
//  devices before/at capture, NOT a continuous parallel session.
//

import Foundation
import ARKit
import React

@objc(ARScaleModule)
class ARScaleModule: NSObject {

  // A 1×1 off-screen ARSCNView so raycastQuery has a valid view to project from, without
  // taking over the UI. Created lazily on the main thread.
  private var arView: ARSCNView?
  private let session = ARSession()

  @objc static func requiresMainQueueSetup() -> Bool { return true }

  /// Whether this device can provide an ARKit world-tracking scale (A9+ / iOS 11+).
  @objc(isSupported:rejecter:)
  func isSupported(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(ARWorldTrackingConfiguration.isSupported)
  }

  /// Start a horizontal-plane-detecting world-tracking session.
  @objc(start:rejecter:)
  func start(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard ARWorldTrackingConfiguration.isSupported else {
      reject("AR_UNSUPPORTED", "ARWorldTracking not supported on this device", nil); return
    }
    DispatchQueue.main.async {
      if self.arView == nil {
        let v = ARSCNView(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
        v.session = self.session
        UIApplication.shared.keyWindow?.addSubview(v) // off-screen 1×1; required for raycast projection
        v.isHidden = true
        self.arView = v
      }
      let cfg = ARWorldTrackingConfiguration()
      cfg.planeDetection = [.horizontal]
      self.session.run(cfg, options: [.resetTracking, .removeExistingAnchors])
      resolve(true)
    }
  }

  @objc(stop:rejecter:)
  func stop(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.session.pause()
      self.arView?.removeFromSuperview()
      self.arView = nil
      resolve(true)
    }
  }

  /// Raycast from the center of the frame to the nearest detected horizontal plane and return the
  /// real-world image width (cm) using the live camera intrinsics — the same field the LiDAR path
  /// emits. Returns null fields when no plane is found yet (caller should keep the raw estimate).
  @objc(measure:rejecter:)
  func measure(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let view = self.arView, let frame = self.session.currentFrame else {
        resolve(["hasScale": false]); return
      }
      let center = CGPoint(x: view.bounds.midX, y: view.bounds.midY)
      guard let query = view.raycastQuery(from: center, allowing: .estimatedPlane, alignment: .horizontal),
            let hit = self.session.raycast(query).first else {
        resolve(["hasScale": false]); return
      }
      // Distance camera→plane point (meters).
      let cam = frame.camera.transform.columns.3
      let pt = hit.worldTransform.columns.3
      let distM = sqrt(pow(cam.x - pt.x, 2) + pow(cam.y - pt.y, 2) + pow(cam.z - pt.z, 2))
      // Intrinsics → real-world image width: img_w_cm = distance_cm * imageWidthPx / fxPx.
      let intr = frame.camera.intrinsics            // 3×3, fx = intr[0][0]
      let fx = intr.columns.0.x
      let imgW = Float(frame.camera.imageResolution.width)
      let distCm = distM * 100.0
      let imgWcm = (fx > 0 && imgW > 0) ? distCm * imgW / fx : Float.nan
      resolve([
        "hasScale": true,
        "distanceCm": distCm,
        "imgWcm": imgWcm.isFinite ? imgWcm : NSNull(),
        "fx": fx,
        "trackingState": "\(frame.camera.trackingState)",
      ])
    }
  }
}
