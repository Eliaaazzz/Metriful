package com.fitnessapp.backend.nutrition.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One on-device segmented food region: an absolute LiDAR volume (cm³) integrated over a single
 * Vision instance mask, plus the mask's normalized centroid so the backend can assign it to the
 * vision model's matching food.
 *
 * <p>This is what makes per-item portion refinement possible on mixed plates — per-item volume ×
 * per-food density, instead of one scene-level volume × one blended density. See
 * {@code docs/calorie-accuracy-roadmap-25-to-15.md} §10 and Lever&nbsp;#3 (segment before
 * integrating). The centroid/area are normalized and unit-free so they are resolution-independent.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DepthItem {

  /** Absolute volume of this mask (cm³), integrated on-device over food pixels only. */
  @JsonProperty("volume_cm3")
  private Double volumeCm3;

  /** Footprint area of this mask (cm²). Informational. */
  @JsonProperty("area_cm2")
  private Double areaCm2;

  /** Mask centroid X, fraction of image width [0..1], top-left origin. */
  @JsonProperty("cx")
  private Double centroidX;

  /** Mask centroid Y, fraction of image height [0..1], top-left origin. */
  @JsonProperty("cy")
  private Double centroidY;

  @JsonIgnore
  public boolean hasPositiveVolume() {
    return volumeCm3 != null && Double.isFinite(volumeCm3) && volumeCm3 > 0;
  }

  @JsonIgnore
  public boolean hasCentroid() {
    return centroidX != null && centroidY != null
        && Double.isFinite(centroidX) && Double.isFinite(centroidY);
  }
}
