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

    val sample = readCenterDepth(depthImage)
    if (sample == null || sample.meters <= 0f) {
      return hashMapOf("hasDepth" to false, "width" to width, "height" to height)
    }

    // fx (px) from LENS_INTRINSIC_CALIBRATION [fx, fy, cx, cy, s], scaled to frame width.
    val fx = DepthBridge.focalLengthPx(width)
    // Without intrinsics we cannot convert distance -> img_w_cm; report no usable depth
    // rather than emitting fx:0 (which divides to Infinity/NaN downstream).
    if (fx <= 0f) {
      return hashMapOf("hasDepth" to false, "width" to width, "height" to height)
    }

    return hashMapOf(
      "hasDepth" to true,
      "distance" to sample.meters,
      "distanceCm" to sample.meters * 100.0,
      "confidence" to sample.confidence, // real DEPTH16 confidence, not a hardcoded value
      "fx" to fx,
      "width" to width,
      "height" to height,
      // Confidence describes this sample; absolute calibration requires device validation.
      "accuracy" to "relative"
    )
  }

  private data class DepthSample(val meters: Float, val confidence: Float)

  /**
   * DEPTH16: each 16-bit sample packs depth in the low 13 bits (millimeters) and a
   * confidence code in the high 3 bits. Per the Android format spec the code maps to a
   * percentage as: 0 => 100% confident, otherwise (code - 1) / 7. Keep each depth
   * paired with its confidence so reliable neighbours cannot validate a bad median.
   */
  private fun readCenterDepth(image: Image): DepthSample? {
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

    val depths = ArrayList<DepthSample>()
    var y = maxOf(0, cy - radius)
    while (y <= minOf(h - 1, cy + radius)) {
      var x = maxOf(0, cx - radius)
      while (x <= minOf(w - 1, cx + radius)) {
        val index = y * rowStride + x * pixelStride
        if (index + 1 < buffer.limit()) {
          val raw = (buffer.get(index).toInt() and 0xFF) or ((buffer.get(index + 1).toInt() and 0xFF) shl 8)
          val millimeters = raw and 0x1FFF       // low 13 bits
          val code = (raw shr 13) and 0x7         // high 3 bits = confidence code
          if (millimeters > 0) {
            val confidence = if (code == 0) 1f else (code - 1) / 7f
            depths.add(DepthSample(millimeters / 1000f, confidence))
          }
        }
        x++
      }
      y++
    }
    if (depths.isEmpty()) return null
    depths.sortBy { it.meters }
    return depths[depths.size / 2]
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
