package com.fitnessapp.backend.behavior.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fitnessapp.backend.behavior.SubscriptionTier;
import com.fitnessapp.backend.behavior.entity.BehaviorInsight;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

/**
 * Targeted tests for the static tier-filter helper. Heavy mocking of
 * recompute is left to integration-style tests.
 */
class InsightStatsServiceTierFilterTest {

  @Test
  void freeTier_returnsTopThreePositiveOnly() {
    List<BehaviorInsight> all = List.of(
        insight("a", 9.0, false),
        insight("b", 4.0, false),
        insight("c", 7.0, false),
        insight("d", -3.0, false),  // negative — filtered for free tier
        insight("e", 1.0, false)
    );

    List<BehaviorInsight> result = InsightStatsService.applyTierFilter(all, SubscriptionTier.FREE);

    assertThat(result).hasSize(3);
    assertThat(result).extracting(BehaviorInsight::getBehaviorKey)
        .containsExactly("a", "c", "b"); // sorted desc by delta
  }

  @Test
  void freeTier_pinnedFloatsToTop_evenIfSmaller() {
    List<BehaviorInsight> all = List.of(
        insight("a", 9.0, false),
        insight("b", 4.0, true),   // pinned — should be first
        insight("c", 7.0, false),
        insight("d", 1.0, false)
    );

    List<BehaviorInsight> result = InsightStatsService.applyTierFilter(all, SubscriptionTier.FREE);

    assertThat(result.get(0).getBehaviorKey()).isEqualTo("b");
  }

  @Test
  void proTier_includesNegativesAndPositives_sortedByAbsoluteDelta() {
    List<BehaviorInsight> all = List.of(
        insight("a", 9.0, false),
        insight("b", -5.0, false),
        insight("c", 7.0, false),
        insight("d", -8.0, false)
    );

    List<BehaviorInsight> result = InsightStatsService.applyTierFilter(all, SubscriptionTier.PRO);

    assertThat(result).hasSize(4);
    assertThat(result).extracting(BehaviorInsight::getBehaviorKey)
        .containsExactly("a", "d", "c", "b"); // |Δ|: 9, 8, 7, 5
  }

  @Test
  void proTier_pinnedItemFloatsToTop() {
    List<BehaviorInsight> all = List.of(
        insight("big", 9.0, false),
        insight("small", 1.0, true)
    );
    List<BehaviorInsight> result = InsightStatsService.applyTierFilter(all, SubscriptionTier.PRO);
    assertThat(result.get(0).getBehaviorKey()).isEqualTo("small");
  }

  // -------- helpers --------------------------------------------------------

  private static BehaviorInsight insight(String key, double delta, boolean pinned) {
    return BehaviorInsight.builder()
        .userId(UUID.randomUUID())
        .behaviorKey(key)
        .deltaScore(BigDecimal.valueOf(delta))
        .cohensD(BigDecimal.valueOf(0.5))
        .pValue(BigDecimal.valueOf(0.04))
        .sampleYes(15)
        .sampleNo(20)
        .confidence("med")
        .computedAt(OffsetDateTime.now(ZoneOffset.UTC))
        .pinned(pinned)
        .build();
  }
}
