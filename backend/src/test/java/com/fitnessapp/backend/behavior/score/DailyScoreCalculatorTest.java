package com.fitnessapp.backend.behavior.score;

import static org.assertj.core.api.Assertions.assertThat;

import com.fitnessapp.backend.nutrition.entity.MealLog;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class DailyScoreCalculatorTest {

  private final DailyScoreCalculator calc = new DailyScoreCalculator();

  @Test
  void calculate_emptyDayIsZero() {
    assertThat(calc.calculate(List.of())).isZero();
  }

  @Test
  void calculate_perfectDayMaxesOut() {
    int score = calc.calculate(List.of(
        meal(8,  "breakfast", 30, 600),
        meal(13, "lunch",     30, 700),
        meal(19, "dinner",    25, 800)
    ));
    // 30 (3 meals) + 30 (85g protein > 75) + 30 (calories=2100 in 1200..2400) + 10 (3 distinct types) = 100
    assertThat(score).isEqualTo(100);
  }

  @Test
  void calculate_underCaloriesPartialCredit() {
    int score = calc.calculate(List.of(meal(13, "lunch", 25, 1000))); // single meal, 1000 cals
    assertThat(score).isLessThan(60);
    assertThat(score).isGreaterThan(0);
  }

  @Test
  void calculate_capsAt100() {
    int score = calc.calculate(List.of(
        meal(8, "breakfast", 200, 500),
        meal(13, "lunch", 200, 700),
        meal(19, "dinner", 200, 700),
        meal(21, "snack", 50, 400)
    ));
    assertThat(score).isLessThanOrEqualTo(100);
  }

  @Test
  void calculate_clamsToZeroFloor() {
    // calories far below hard floor → cal component 0
    int score = calc.calculate(List.of(meal(13, "lunch", 0, 100)));
    assertThat(score).isGreaterThanOrEqualTo(0);
    assertThat(score).isLessThan(40);
  }

  private static MealLog meal(int hour, String type, int proteinG, int calories) {
    OffsetDateTime at = OffsetDateTime.of(2026, 5, 1, hour, 0, 0, 0, ZoneOffset.UTC);
    return MealLog.builder()
        .userId(UUID.randomUUID())
        .mealType(type)
        .consumedAt(at)
        .calories(calories)
        .proteinGrams(BigDecimal.valueOf(proteinG))
        .build();
  }
}
