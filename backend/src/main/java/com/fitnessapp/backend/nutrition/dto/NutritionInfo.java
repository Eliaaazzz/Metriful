package com.fitnessapp.backend.nutrition.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Nutrition information DTO
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class NutritionInfo {
  private BigDecimal calories;
  private BigDecimal protein;
  private BigDecimal fat;
  private BigDecimal carbs;
  private BigDecimal fiber;
  private BigDecimal sugar;

  // Computed fields for visualization
  private BigDecimal netCarbs;
  private BigDecimal sugarCubes;

  // Glycemic impact
  private Integer glycemicIndex;   // 0-100 (per food item, from AI)
  private BigDecimal glycemicLoad; // (GI × net carbs) / 100

  public static NutritionInfo zero() {
    return NutritionInfo.builder()
        .calories(BigDecimal.ZERO)
        .protein(BigDecimal.ZERO)
        .fat(BigDecimal.ZERO)
        .carbs(BigDecimal.ZERO)
        .fiber(BigDecimal.ZERO)
        .sugar(BigDecimal.ZERO)
        .netCarbs(BigDecimal.ZERO)
        .sugarCubes(BigDecimal.ZERO)
        .build();
  }

  public void add(NutritionInfo other) {
    this.calories = safeAdd(this.calories, other.calories);
    this.protein = safeAdd(this.protein, other.protein);
    this.fat = safeAdd(this.fat, other.fat);
    this.carbs = safeAdd(this.carbs, other.carbs);
    this.fiber = safeAdd(this.fiber, other.fiber);
    this.sugar = safeAdd(this.sugar, other.sugar);
    this.netCarbs = safeAdd(this.netCarbs, other.netCarbs);
    this.sugarCubes = safeAdd(this.sugarCubes, other.sugarCubes);
    this.glycemicLoad = safeAdd(this.glycemicLoad, other.glycemicLoad);
  }

  private BigDecimal safeAdd(BigDecimal a, BigDecimal b) {
    if (a == null) a = BigDecimal.ZERO;
    if (b == null) b = BigDecimal.ZERO;
    return a.add(b);
  }
}
