package com.fitnessapp.backend.behavior.service;

import com.fitnessapp.backend.behavior.entity.UserBehaviorDay;
import com.fitnessapp.backend.behavior.predicate.BehaviorPredicate;
import com.fitnessapp.backend.behavior.predicate.BehaviorPredicateRegistry;
import com.fitnessapp.backend.behavior.repository.UserBehaviorDayRepository;
import com.fitnessapp.backend.behavior.score.DailyScoreCalculator;
import com.fitnessapp.backend.nutrition.entity.MealLog;
import com.fitnessapp.backend.nutrition.repository.MealLogRepository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Backfills {@link UserBehaviorDay} rows. For each (user, day) it loads the
 * meals consumed that day, evaluates every registered predicate, and stores
 * the day's daily score so the stats service has a paired dataset.
 *
 * <p>Days are bucketed by UTC for v1; per-user timezone bucketing is a
 * follow-up once a profile timezone is captured.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class BehaviorDeriver {

  static final int BACKFILL_WINDOW_DAYS = 90;

  private final MealLogRepository mealLogRepository;
  private final BehaviorPredicateRegistry registry;
  private final DailyScoreCalculator scoreCalculator;
  private final UserBehaviorDayRepository dayRepository;

  /**
   * Derive and persist behavior days for a user across the
   * {@link #BACKFILL_WINDOW_DAYS}-day window ending on {@code through}.
   */
  @Transactional
  public int backfill(UUID userId, LocalDate through, ZoneId zone) {
    LocalDate from = through.minusDays(BACKFILL_WINDOW_DAYS - 1L);
    deriveRange(userId, from, through, zone);
    return BACKFILL_WINDOW_DAYS;
  }

  /**
   * Derive all days in {@code [from, to]} inclusive. The {@code zone} controls
   * (1) which calendar day each meal falls into and (2) the local hour seen by
   * time-of-day predicates ({@code breakfast_logged}, {@code late_eating}).
   *
   * <p>Empty days (no meals in {@code zone}) are <strong>not</strong> persisted —
   * storing zero-score rows would skew the Welch t-test against any predicate.
   */
  @Transactional
  public void deriveRange(UUID userId, LocalDate from, LocalDate to, ZoneId zone) {
    // Pull a slightly wider window in UTC so meals that fall on the boundary days
    // in the user's local zone are not lost.
    OffsetDateTime windowStart = from.minusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);
    OffsetDateTime windowEnd   = to.plusDays(2).atStartOfDay().atOffset(ZoneOffset.UTC);

    List<MealLog> meals = mealLogRepository
        .findByUserIdAndConsumedAtBetweenOrderByConsumedAtAsc(userId, windowStart, windowEnd);

    Map<LocalDate, List<MealLog>> grouped = groupByLocalDate(meals, zone);

    // Wipe + rewrite for the whole range. Cheap (≤90 rows × 8 predicates per user).
    dayRepository.deleteByUserIdAndDayBetween(userId, from, to);

    List<UserBehaviorDay> rows = new ArrayList<>();
    LocalDate cursor = from;
    while (!cursor.isAfter(to)) {
      List<MealLog> dayMeals = grouped.getOrDefault(cursor, List.of());
      if (dayMeals.isEmpty()) {
        // Skip empty days entirely — they carry no signal and keep cold-start
        // distinct-day counts honest.
        cursor = cursor.plusDays(1);
        continue;
      }
      Short score = (short) scoreCalculator.calculate(dayMeals);
      for (BehaviorPredicate p : registry.all()) {
        boolean observed = p.evaluate(dayMeals, zone);
        rows.add(UserBehaviorDay.builder()
            .userId(userId)
            .day(cursor)
            .behaviorKey(p.key())
            .observed(observed)
            .dailyScore(score)
            .build());
      }
      cursor = cursor.plusDays(1);
    }

    if (!rows.isEmpty()) dayRepository.saveAll(rows);
    log.info("Behavior deriver: user={} zone={} wrote {} rows ({} → {})",
        userId, zone, rows.size(), from, to);
  }

  // -------- helpers --------------------------------------------------------

  private static Map<LocalDate, List<MealLog>> groupByLocalDate(List<MealLog> meals, ZoneId zone) {
    Map<LocalDate, List<MealLog>> out = new HashMap<>();
    for (MealLog m : meals) {
      if (m.getConsumedAt() == null) continue;
      LocalDate d = m.getConsumedAt().atZoneSameInstant(zone).toLocalDate();
      out.computeIfAbsent(d, k -> new ArrayList<>()).add(m);
    }
    return out;
  }
}
