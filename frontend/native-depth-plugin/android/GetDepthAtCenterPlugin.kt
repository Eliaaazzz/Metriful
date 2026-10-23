/*
 * GetDepthAtCenterPlugin.kt
 * VisionCamera frame-processor plugin: returns center-of-frame depth (from a
 * Camera2 DEPTH16 / ToF stream) + intrinsics so JS can compute img_w_cm.
 *
 * ⚠️ REFERENCE TEMPLATE — must be built & tested in Android Studio on a real ToF
 * device. A DEPTH16 output must be configured on the capture session; VisionCamera
 * delivers the YUV video frame, so depth typically comes from a parallel ImageReader
 * keyed by timestamp (see README). The code below shows the DEPTH16 decode + the
 * contract; wire the depth Image source to match your session.
 */

package com.metriful.depth

import android.media.Image
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy

class GetDepthAtCenterPlugin(
  proxy: VisionCameraProxy,
  options: Map<String, Any>?
) : FrameProcessorPlugin() {

  override fun callback(frame: Frame, arguments: Map<String, Any>?): Any {
    val width = frame.width
    val height = frame.height

    // Obtain the latest DEPTH16 image aligned to this frame (see README for wiring).
    val depthImage: Image? = DepthBridge.latestDepthImage(frame.timestamp)
    if (depthImage == null) {
      return hashMapOf("hasDepth" to false, "width" to width, "height" to height)
    }

    val meters = readCenterDepthMeters(depthImage)
    if (meters == null || meters <= 0f) {
      return hashMapOf("hasDepth" to false, "width" to width, "height" to height)
    }

    // fx (px) from LENS_INTRINSIC_CALIBRATION [fx, fy, cx, cy, s], scaled to frame width.
    val fx = DepthBridge.focalLengthPx(width)

    return hashMapOf(
      "hasDepth" to true,
      "distance" to meters,
      "distanceCm" to meters * 100.0,
      "confidence" to 0.9,
      "fx" to fx,
      "width" to width,
      "height" to height,
      "accuracy" to "absolute"
    )
  }

  /** DEPTH16: each sample is 16-bit; low 13 bits = depth in millimeters, high 3 bits = confidence. */
  private fun readCenterDepthMeters(image: Image): Float? {
    val plane = image.planes.firstOrNull() ?: return null
    val buffer = plane.buffer
    val rowStride = plane.rowStride
    val pixelStride = if (plane.pixelStride > 0) plane.pixelStride else 2
    val w = image.width
    val h = image.height
    if (w <= 0 || h <= 0) return null

    val cx = w / 2
    val cy = h / 2
    val radius = maxOf(1, minOf(w, h) / 64)

    val samples = ArrayList<Float>()
    var y = maxOf(0, cy - radius)
    while (y <= minOf(h - 1, cy + radius)) {
      var x = maxOf(0, cx - radius)
      while (x <= minOf(w - 1, cx + radius)) {
        val index = y * rowStride + x * pixelStride
        if (index + 1 < buffer.limit()) {
          val sample = (buffer.get(index).toInt() and 0xFF) or ((buffer.get(index + 1).toInt() and 0xFF) shl 8)
          val millimeters = sample and 0x1FFF // low 13 bits
          if (millimeters > 0) samples.add(millimeters / 1000f)
        }
        x++
      }
      y++
    }
    if (samples.isEmpty()) return null
    samples.sort()
    return samples[samples.size / 2] // median, meters
  }
}

/**
 * Glue between your Camera2 DEPTH16 ImageReader and the frame processor.
 * Implement these to hand the latest depth Image + intrinsics to the plugin.
 */
object DepthBridge {
  fun latestDepthImage(frameTimestampNs: Long): Image? {
    // TODO: return the DEPTH16 Image whose timestamp best matches frameTimestampNs.
    return null
  }

  fun focalLengthPx(frameWidthPx: Int): Float {
    // TODO: from CameraCharacteristics.LENS_INTRINSIC_CALIBRATION[0], scaled to frameWidthPx
    // (the calibration is relative to the active array size).
    return 0f
  }
}
