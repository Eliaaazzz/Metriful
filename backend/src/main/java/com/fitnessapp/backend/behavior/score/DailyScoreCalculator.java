package com.fitnessapp.backend.behavior.score;

import com.fitnessapp.backend.nutrition.entity.MealLog;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Composes a 0..100 Daily Score from a single user-day's meal logs. This is
 * the outcome variable correlated against each behavior predicate by the
 * {@code InsightStatsService}.
 *
 * <p>Formula (deliberately simple, transparent, profile-agnostic for v1):
 * <pre>
 *   meals_component   = clamp(mealCount / 3,  0..1) * 30
 *   protein_component = clamp(proteinG / 75,  0..1) * 30
 *   calorie_component = 30 if 1200 ≤ cal ≤ 2400 else linear decay
 *   variety_component = clamp(distinctTypes / 3, 0..1) * 10
 * </pre>
 *
 * <p>Caveat: predicates and the score draw from the same underlying signal,
 * so positive correlations partly reflect the score's own construction.
 * Documented in feature #221's PR notes; profile-aware targets (replacing the
 * hardcoded 75g / 1200..2400) are a follow-up.
 */
@Component
public class DailyScoreCalculator {

  static final int MAX_MEAL_TARGET = 3;
  static final int MAX_PROTEIN_TARGET_G = 75;
  static final int CALORIES_FLOOR = 1200;
  static final int CALORIES_CEILING = 2400;
  static final int CALORIES_HARD_FLOOR = 800;
  static final int CALORIES_HARD_CEILING = 3500;
  static final int DISTINCT_MEAL_TARGET = 3;

  /** Returns a score in {@code [0, 100]}. Empty meals → 0. */
  public int calculate(List<MealLog> meals) {
    if (meals == null || meals.isEmpty()) return 0;

    double mealsComp   = clamp01((double) meals.size() / MAX_MEAL_TARGET) * 30.0;
    double proteinComp = clamp01(sumProtein(meals) / MAX_PROTEIN_TARGET_G) * 30.0;
    double calComp     = calorieComponent(sumCalories(meals));
    double varietyComp = clamp01((double) distinctMealTypes(meals) / DISTINCT_MEAL_TARGET) * 10.0;

    long total = Math.round(mealsComp + proteinComp + calComp + varietyComp);
    return (int) Math.max(0, Math.min(100, total));
  }

  // ------------------------------------------------------------------ helpers

  private static double calorieComponent(double calories) {
    if (calories >= CALORIES_FLOOR && calories <= CALORIES_CEILING) return 30.0;
    if (calories < CALORIES_FLOOR) {
      // Linear decay below floor down to hard floor
      double range = (double) (CALORIES_FLOOR - CALORIES_HARD_FLOOR);
      double dist = Math.max(0.0, calories - CALORIES_HARD_FLOOR);
      return clamp01(dist / range) * 30.0;
    }
    // Above ceiling
    double range = (double) (CALORIES_HARD_CEILING - CALORIES_CEILING);
    double dist = Math.max(0.0, CALORIES_HARD_CEILING - calories);
    return clamp01(dist / range) * 30.0;
  }

  private static double sumProtein(List<MealLog> meals) {
    double total = 0.0;
    for (MealLog m : meals) {
      BigDecimal v = m.getProteinGrams();
      if (v != null) total += v.setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
    return total;
  }

  private static double sumCalories(List<MealLog> meals) {
    double total = 0.0;
    for (MealLog m : meals) {
      Integer c = m.getCalories();
      if (c != null) total += c;
    }
    return total;
  }

  private static int distinctMealTypes(List<MealLog> meals) {
    Set<String> distinct = meals.stream()
        .map(MealLog::getMealType)
        .filter(s -> s != null && !s.isBlank())
        .map(String::toLowerCase)
        .collect(Collectors.toSet());
    return distinct.size();
  }

  private static double clamp01(double v) {
    if (v < 0.0) return 0.0;
    if (v > 1.0) return 1.0;
    return v;
  }
}
