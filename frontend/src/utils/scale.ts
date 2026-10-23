/**
 * Real-world scale estimation.
 *
 * Converts a measured camera-to-subject distance (from LiDAR / ToF / ARKit depth)
 * into the real-world width of the full camera frame, in centimeters. The backend
 * consumes this as `img_w_cm` to break monocular scale ambiguity when estimating
 * food portions — i.e. it lets the model know how physically large the scene is,
 * instead of guessing from how much of the frame the food fills.
 *
 * Two equivalent pinhole-camera formulas, in order of preference:
 *   1. Intrinsics:  img_w_cm = distanceCm * frameWidthPx / fxPx
 *   2. Field of view: img_w_cm = 2 * distanceCm * tan(HFOV / 2)
 *
 * Returns `null` when there is no usable real depth reading. Callers should then
 * omit the hint so the backend falls back to its default plate-width assumption,
 * rather than sending a fabricated number.
 */

/** Typical phone wide-camera horizontal FOV; last-resort only, when intrinsics are unknown. */
export const DEFAULT_HORIZONTAL_FOV_DEG = 68;

/** Sane bounds for a hand-held food photo, used to reject bad depth readings. */
export const MIN_IMAGE_WIDTH_CM = 12;
export const MAX_IMAGE_WIDTH_CM = 90;

export interface ScaleInputs {
  /** Camera-to-subject distance in centimeters (from the depth sensor). */
  distanceCm: number | null | undefined;
  /** Focal length in pixels, from camera intrinsics (preferred). */
  fxPx?: number | null;
  /** Frame width in pixels that matches `fxPx`. */
  frameWidthPx?: number | null;
  /** Horizontal field of view in degrees, if intrinsics are unavailable. */
  horizontalFovDeg?: number | null;
  /**
   * Allow the DEFAULT_HORIZONTAL_FOV_DEG last resort when only a real distance is
   * known (no intrinsics, no explicit FOV). Default true. Set false to require
   * intrinsics/FOV and otherwise return null.
   */
  allowFovFallback?: boolean;
}

/**
 * Estimate the real-world width (cm) of the full image from a depth reading.
 * Returns null when no reliable estimate can be made.
 */
export function estimateImageWidthCm(input: ScaleInputs): number | null {
  const d = input.distanceCm;
  if (typeof d !== 'number' || !Number.isFinite(d) || d <= 0) {
    return null;
  }

  let widthCm: number | null = null;

  if (
    typeof input.fxPx === 'number' && input.fxPx > 0 &&
    typeof input.frameWidthPx === 'number' && input.frameWidthPx > 0
  ) {
    // Pinhole model: realWidth = distance * sensorWidthPx / focalLengthPx
    widthCm = (d * input.frameWidthPx) / input.fxPx;
  } else {
    const fov =
      typeof input.horizontalFovDeg === 'number' && input.horizontalFovDeg > 0
        ? input.horizontalFovDeg
        : input.allowFovFallback !== false
        ? DEFAULT_HORIZONTAL_FOV_DEG
        : null;
    if (typeof fov === 'number' && fov > 0 && fov < 180) {
      const halfRad = ((fov * Math.PI) / 180) / 2;
      widthCm = 2 * d * Math.tan(halfRad);
    }
  }

  if (widthCm == null || !Number.isFinite(widthCm) || widthCm <= 0) {
    return null;
  }

  // Clamp to a sane range to guard against spurious depth readings, then round to 0.1cm.
  const clamped = Math.min(MAX_IMAGE_WIDTH_CM, Math.max(MIN_IMAGE_WIDTH_CM, widthCm));
  return Math.round(clamped * 10) / 10;
}

export default estimateImageWidthCm;
