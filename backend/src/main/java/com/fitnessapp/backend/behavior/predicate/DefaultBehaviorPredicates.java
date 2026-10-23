package com.fitnessapp.backend.behavior.predicate;

import com.fitnessapp.backend.nutrition.entity.MealLog;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Built-in {@link BehaviorPredicate}s. Each is computed solely from the day's
 * {@link MealLog} rows so they're cheap to evaluate at backfill time.
 *
 * <p>The list is intentionally short (8 behaviors). Every entry maps to a
 * column-derivable signal — fiber/sugar/processed-food markers from the issue
 * spec are deferred until those nutrient fields exist on {@code meal_log}.
 */
public final class DefaultBehaviorPredicates {

  private DefaultBehaviorPredicates() {}

  // -------- thresholds (default; profile-aware override is a follow-up) ----

  static final int    BREAKFAST_BEFORE_HOUR = 10;
  static final int    LATE_EATING_AT_OR_AFTER_HOUR = 21;
  static final int    MIN_MEAL_COUNT = 3;
  static final int    PROTEIN_GOAL_GRAMS = 75;
  static final int    PROTEIN_HIGH_GRAMS = 100;
  static final int    CALORIES_FLOOR = 1200;
  static final int    CALORIES_CEILING = 2400;
  static final int    DISTINCT_MEAL_TYPES = 3;
  static final int    PROTEIN_PER_MEAL_GRAMS = 20;

  // -------- public list -----------------------------------------------------

  public static List<BehaviorPredicate> all() {
    return List.of(
        new BreakfastLogged(),
        new LateEating(),
        new MealCount3OrMore(),
        new ProteinGoalHit(),
        new ProteinHigh(),
        new CaloriesInRange(),
        new VariedMealTypes(),
        new ProteinPerMealDecent()
    );
  }

  // -------- helpers ---------------------------------------------------------

  private static double sumProtein(List<MealLog> meals) {
    double total = 0.0;
    for (MealLog m : meals) {
      total += nz(m.getProteinGrams());
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

  private static double nz(BigDecimal value) {
    return value == null ? 0.0 : value.setScale(2, RoundingMode.HALF_UP).doubleValue();
  }

  /** Local-zone hour-of-day for the meal's instant. Returns -1 when consumedAt is null. */
  private static int localHour(MealLog meal, ZoneId zone) {
    OffsetDateTime t = meal.getConsumedAt();
    if (t == null) return -1;
    return t.atZoneSameInstant(zone).getHour();
  }

  // -------- predicates ------------------------------------------------------

  static final class BreakfastLogged implements BehaviorPredicate {
    @Override public String key() { return "breakfast_logged"; }
    @Override public String label() { return "Logged breakfast"; }
    @Override public boolean evaluate(List<MealLog> meals, ZoneId zone) {
      return meals.stream().anyMatch(m -> {
        int h = localHour(m, zone);
        return h >= 0 && h < BREAKFAST_BEFORE_HOUR;
      });
    }
  }

  static final class LateEating implements BehaviorPredicate {
    @Override public String key() { return "late_eating"; }
    @Override public String label() { return "Ate after 9pm"; }
    @Override public boolean evaluate(List<MealLog> meals, ZoneId zone) {
      return meals.stream().anyMatch(m -> localHour(m, zone) >= LATE_EATING_AT_OR_AFTER_HOUR);
    }
  }

  static final class MealCount3OrMore implements BehaviorPredicate {
    @Override public String key() { return "meal_count_3_or_more"; }
    @Override public String label() { return "Logged 3+ meals"; }
    @Override public boolean evaluate(List<MealLog> meals, ZoneId zone) {
      return meals.size() >= MIN_MEAL_COUNT;
    }
  }

  static final class ProteinGoalHit implements BehaviorPredicate {
    @Override public String key() { return "protein_goal_hit"; }
    @Override public String label() { return "Hit 75g protein"; }
    @Override public boolean evaluate(List<MealLog> meals, ZoneId zone) {
      return sumProtein(meals) >= PROTEIN_GOAL_GRAMS;
    }
  }

  static final class ProteinHigh implements BehaviorPredicate {
    @Override public String key() { return "protein_high"; }
    @Override public String label() { return "Hit 100g protein"; }
    @Override public boolean evaluate(List<MealLog> meals, ZoneId zone) {
      return sumProtein(meals) >= PROTEIN_HIGH_GRAMS;
    }
  }

  static final class CaloriesInRange implements BehaviorPredicate {
    @Override public String key() { return "calories_in_range"; }
    @Override public String label() { return "Calories in range (1200–2400)"; }
    @Override public boolean evaluate(List<MealLog> meals, ZoneId zone) {
      double cal = sumCalories(meals);
      return cal >= CALORIES_FLOOR && cal <= CALORIES_CEILING;
    }
  }

  static final class VariedMealTypes implements BehaviorPredicate {
    @Override public String key() { return "varied_meal_types"; }
    @Override public String label() { return "3+ distinct meal types"; }
    @Override public boolean evaluate(List<MealLog> meals, ZoneId zone) {
      Set<String> distinct = meals.stream()
          .map(MealLog::getMealType)
          .filter(s -> s != null && !s.isBlank())
          .map(String::toLowerCase)
          .collect(Collectors.toSet());
      return distinct.size() >= DISTINCT_MEAL_TYPES;
    }
  }

  static final class ProteinPerMealDecent implements BehaviorPredicate {
    @Override public String key() { return "protein_per_meal_decent"; }
    @Override public String label() { return "Avg ≥20g protein per meal"; }
    @Override public boolean evaluate(List<MealLog> meals, ZoneId zone) {
      if (meals.isEmpty()) return false;
      return (sumProtein(meals) / meals.size()) >= PROTEIN_PER_MEAL_GRAMS;
    }
  }
}
