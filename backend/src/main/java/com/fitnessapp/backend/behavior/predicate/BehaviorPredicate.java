package com.fitnessapp.backend.behavior.predicate;

import com.fitnessapp.backend.nutrition.entity.MealLog;
import java.time.ZoneId;
import java.util.List;

/**
 * A behavior is a single yes/no signal computed from one user-day's meal logs.
 * Implementations are stateless and registered in {@link BehaviorPredicateRegistry}.
 *
 * <p>This interface is shared with Feature #222 (Challenges) so the same set of
 * predicates drives both insight derivation and challenge evaluation — keeping
 * one source of truth for "did the user X today?".
 */
public interface BehaviorPredicate {

  /** Stable, machine-friendly identifier. Persisted; do not rename. */
  String key();

  /** Short, sentence-case display label, e.g. "Logged breakfast". */
  String label();

  /**
   * True when the day's meals satisfy the behavior. May see an empty list.
   *
   * @param zone time-of-day predicates ({@code breakfast_logged}, {@code late_eating})
   *             evaluate {@code consumedAt.atZoneSameInstant(zone).getHour()}, so the
   *             caller controls the local-day frame of reference. Must not be {@code null}.
   */
  boolean evaluate(List<MealLog> dayMeals, ZoneId zone);
}
