package com.fitnessapp.backend.nutrition.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A normalized (0..1, image-relative, top-left origin) bounding box for a recognized food.
 *
 * <p>Optionally emitted by the vision model so the backend can assign on-device depth masks
 * ({@link DepthItem}) to the right food for per-item portion refinement
 * ({@code PerItemPortionRefinementService}). All fields are nullable: models or responses that do
 * not localize simply leave it absent, and the pipeline falls back to scene-level correction.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoundingBox {

  /** Left edge, fraction of image width [0..1]. */
  @JsonProperty("x")
  private Double x;

  /** Top edge, fraction of image height [0..1]. */
  @JsonProperty("y")
  private Double y;

  /** Width, fraction of image width (0..1]. */
  @JsonProperty("w")
  private Double w;

  /** Height, fraction of image height (0..1]. */
  @JsonProperty("h")
  private Double h;

  @JsonIgnore
  public boolean isValid() {
    return x != null && y != null && w != null && h != null
        && Double.isFinite(x) && Double.isFinite(y) && Double.isFinite(w) && Double.isFinite(h)
        && w > 0 && h > 0;
  }

  @JsonIgnore
  public double centerX() {
    return x + w / 2.0;
  }

  @JsonIgnore
  public double centerY() {
    return y + h / 2.0;
  }

  /** True if the (normalized) point falls inside this box. Always false for an invalid box. */
  @JsonIgnore
  public boolean contains(double px, double py) {
    return isValid() && px >= x && px <= x + w && py >= y && py <= y + h;
  }
}
