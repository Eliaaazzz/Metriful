package com.fitnessapp.backend.nutrition.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a food item recognized from image by AI Vision.
 * Uses Smart Splitting with intuitive units (piece, bowl, serving).
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class RecognizedFood {
  @JsonProperty("food_key")
  private String foodKey;

  @JsonProperty("display_name")
  private String displayName;

  @JsonProperty("estimated_grams")
  private Integer estimatedGrams;

  /** Unit of measurement (e.g., "piece", "bowl", "serving") */
  private String unit;

  /** Quantity count (e.g., 2 for "2 pieces") */
  private Integer quantity;

  @JsonProperty("cooking_method")
  private String cookingMethod;

  private Double confidence;

  // Structured metadata for RAG pipeline (optional, for enhanced search)
  private FoodMetadata metadata;

  // Nutrition info for this food item
  private NutritionInfo nutrition;

  /**
   * Optional normalized (0..1) location of this food in the image, emitted by the vision model
   * when it localizes. Lets the backend assign an on-device depth mask to this food for per-item
   * portion refinement ({@code PerItemPortionRefinementService}); absent → scene-level fallback.
   */
  @JsonProperty("bounding_box")
  private BoundingBox boundingBox;
}
