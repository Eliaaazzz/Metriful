package com.fitnessapp.backend.nutrition.service.core;

import java.math.BigDecimal;
import java.math.RoundingMode;

import com.fitnessapp.backend.nutrition.dto.NutritionInfo;
import com.fitnessapp.backend.nutrition.dto.RecognizedFood;

/**
 * Shared portion scaling for the geometric calorie refiners.
 *
 * <p>Returns a copy of a recognized food with its grams and mass-proportional nutrition multiplied
 * by {@code scale}, while leaving energy density (an intensive property) and the original object
 * untouched. Both {@link CaloriePhysicsRefinementService} (scene level) and
 * {@code PerItemPortionRefinementService} (per item) use this so they scale an item identically —
 * the per-item and single-item scene paths must never diverge on how a scale becomes grams/kcal.
 */
final class PortionScaling {

  private PortionScaling() {
  }

  /** Return a portion-scaled copy of {@code item}, leaving the original untouched. */
  static RecognizedFood scaledCopy(RecognizedFood item, double scale) {
    if (item == null) {
      return null;
    }
    RecognizedFood.RecognizedFoodBuilder b = item.toBuilder();
    Integer grams = item.getEstimatedGrams();
    if (grams != null && grams > 0) {
      b.estimatedGrams(Math.max(1, (int) Math.round(grams * scale)));
    }
    NutritionInfo n = item.getNutrition();
    if (n != null) {
      b.nutrition(n.toBuilder()
          .calories(scaleValue(n.getCalories(), scale, 0))
          .protein(scaleValue(n.getProtein(), scale, 1))
          .fat(scaleValue(n.getFat(), scale, 1))
          .carbs(scaleValue(n.getCarbs(), scale, 1))
          .fiber(scaleValue(n.getFiber(), scale, 1))
          .sugar(scaleValue(n.getSugar(), scale, 1))
          .netCarbs(scaleValue(n.getNetCarbs(), scale, 1))
          .sugarCubes(scaleValue(n.getSugarCubes(), scale, 1))
          // Glycemic index is intensive (portion-independent); glycemic load scales with net carbs.
          .glycemicLoad(scaleValue(n.getGlycemicLoad(), scale, 1))
          .build());
    }
    return b.build();
  }

  static BigDecimal scaleValue(BigDecimal value, double scale, int decimals) {
    if (value == null) {
      return null;
    }
    return value.multiply(BigDecimal.valueOf(scale)).setScale(decimals, RoundingMode.HALF_UP);
  }
}
