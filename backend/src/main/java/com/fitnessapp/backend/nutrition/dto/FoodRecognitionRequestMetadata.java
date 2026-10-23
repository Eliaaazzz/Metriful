package com.fitnessapp.backend.nutrition.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Optional metadata sent by the client to improve portion scaling.
 *
 * This is intentionally small and forgiving: the client may omit it, or send
 * only one of the supported fields.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FoodRecognitionRequestMetadata {

  /**
   * Real-world width of the entire image in centimeters (preferred key in prompts).
   */
  @JsonProperty("img_w_cm")
  private Double imageWidthCm;

  /**
   * Legacy alias for image width in centimeters.
   */
  @JsonProperty("real_world_width_cm")
  private Double realWorldWidthCm;

  /**
   * Absolute food volume in cm³ measured on-device from the LiDAR depth map.
   * When present, the backend refines portion/calories geometrically
   * (see {@code CaloriePhysicsRefinementService}); when absent the estimate is
   * left to the vision model unchanged.
   */
  @JsonProperty("volume_cm3")
  private Double volumeCm3;

  /**
   * Absolute food footprint area in cm² (LiDAR). Currently informational.
   */
  @JsonProperty("area_cm2")
  private Double areaCm2;

  /**
   * Mean food height in cm above the supporting plane (LiDAR). Currently informational.
   */
  @JsonProperty("mean_h_cm")
  private Double meanHCm;

  /**
   * Per-item segmented food regions (LiDAR + on-device Vision instance masks). When present with
   * localized foods, the backend refines each food's portion independently
   * ({@code PerItemPortionRefinementService}); otherwise their volumes still feed the scene-level
   * correction as a cleaner, food-only total. Absent on non-depth devices, web, or gallery photos.
   */
  @JsonProperty("items")
  private List<DepthItem> items;

  @JsonIgnore
  public Double resolveImageWidthCm() {
    if (imageWidthCm != null) return imageWidthCm;
    return realWorldWidthCm;
  }

  /**
   * Absolute measured food volume in cm³, or {@code null} when the client sent no
   * usable LiDAR volume (non-depth devices, web, or a non-positive value).
   */
  @JsonIgnore
  public Double resolveVolumeCm3() {
    if (volumeCm3 != null && volumeCm3 > 0) {
      return volumeCm3;
    }
    return null;
  }

  /**
   * The usable per-item depth masks (positive volume), or an empty list when the client sent none.
   * Never returns {@code null}, so callers can iterate without a guard.
   */
  @JsonIgnore
  public List<DepthItem> resolveDepthItems() {
    if (items == null || items.isEmpty()) {
      return List.of();
    }
    return items.stream()
        .filter(i -> i != null && i.hasPositiveVolume())
        .toList();
  }
}

