package com.fitnessapp.backend.behavior.service;

import com.fitnessapp.backend.behavior.SubscriptionService;
import com.fitnessapp.backend.behavior.SubscriptionTier;
import com.fitnessapp.backend.behavior.entity.BehaviorInsight;
import com.fitnessapp.backend.behavior.entity.UserBehaviorDay;
import com.fitnessapp.backend.behavior.predicate.BehaviorPredicateRegistry;
import com.fitnessapp.backend.behavior.repository.BehaviorInsightRepository;
import com.fitnessapp.backend.behavior.repository.UserBehaviorDayRepository;
import com.fitnessapp.backend.behavior.stats.WelchTTest;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs Welch's t-test per behavior, persists the winners, and applies tier
 * gating + freshness filtering on read.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class InsightStatsService {

  // ---- thresholds -----------------------------------------------------------

  static final double P_VALUE_MAX  = 0.10;
  static final double COHENS_D_MIN = 0.30;

  static final double P_HIGH = 0.01;
  static final double P_MED  = 0.05;

  static final int FREE_TIER_LIMIT = 3;
  static final int FRESHNESS_DAYS  = 7;
  static final int MIN_PER_BUCKET  = 5;
  static final int WINDOW_DAYS     = 90;

  private final UserBehaviorDayRepository dayRepository;
  private final BehaviorInsightRepository insightRepository;
  private final BehaviorPredicateRegistry registry;
  private final SubscriptionService subscriptionService;

  @Value("${aurafitness.insights.min-days-for-cold-start:30}")
  private int minDaysForColdStart;

  // ===================================================================== read

  /** Fetch insights visible to the user, applying tier gating + freshness. */
  @Transactional(readOnly = true)
  public List<BehaviorInsight> listForUser(UUID userId) {
    OffsetDateTime freshSince = OffsetDateTime.now(ZoneOffset.UTC).minusDays(FRESHNESS_DAYS);
    List<BehaviorInsight> all = insightRepository.findActiveForUser(userId, freshSince);
    SubscriptionTier tier = subscriptionService.getTier(userId);
    return applyTierFilter(all, tier);
  }

  static List<BehaviorInsight> applyTierFilter(List<BehaviorInsight> all, SubscriptionTier tier) {
    if (tier.isAtLeast(SubscriptionTier.PRO)) {
      return all.stream()
          .sorted(Comparator
              .comparing((BehaviorInsight i) -> !i.isPinned())               // pinned first
              .thenComparing(i -> -Math.abs(i.getDeltaScore().doubleValue()))) // bigger effect first
          .toList();
    }
    // Free tier: top FREE_TIER_LIMIT positive insights only
    return all.stream()
        .filter(i -> i.getDeltaScore().signum() > 0)
        .sorted(Comparator
            .comparing((BehaviorInsight i) -> !i.isPinned())
            .thenComparing(i -> -i.getDeltaScore().doubleValue()))
        .limit(FREE_TIER_LIMIT)
        .toList();
  }

  /** True when the user has fewer than {@link #minDaysForColdStart} logged days. */
  @Transactional(readOnly = true)
  public ColdStartStatus coldStartStatus(UUID userId) {
    long days = dayRepository.countDistinctDaysForUser(userId);
    return new ColdStartStatus(days, minDaysForColdStart, days >= minDaysForColdStart);
  }

  public record ColdStartStatus(long daysLogged, int target, boolean unlocked) {}

  // ===================================================================== compute

  /**
   * Recompute every behavior's insight for the user from the last
   * {@link #WINDOW_DAYS} of behavior days. No row is written when the data
   * doesn't pass the {@link #P_VALUE_MAX} / {@link #COHENS_D_MIN} bar.
   *
   * <p>Window ends at <em>yesterday</em> (UTC) so an in-progress day cannot
   * skew either bucket.
   */
  @Transactional
  public int recomputeForUser(UUID userId) {
    LocalDate to = LocalDate.now(ZoneOffset.UTC).minusDays(1);
    LocalDate from = to.minusDays(WINDOW_DAYS - 1L);

    List<UserBehaviorDay> rows = dayRepository.findByUserIdAndDayBetween(userId, from, to);
    if (rows.isEmpty()) {
      log.debug("Insight recompute: user {} has no behavior days yet", userId);
      return 0;
    }

    Map<String, List<UserBehaviorDay>> byKey = new HashMap<>();
    for (UserBehaviorDay r : rows) {
      byKey.computeIfAbsent(r.getBehaviorKey(), k -> new ArrayList<>()).add(r);
    }

    // Single fetch up-front — avoids the N+1 lookup we used to do inside the loop.
    Map<String, BehaviorInsight> existingByKey = new HashMap<>();
    for (BehaviorInsight existing : insightRepository.findAllByUserId(userId)) {
      existingByKey.put(existing.getBehaviorKey(), existing);
    }

    Set<Long> toDelete = new HashSet<>();
    List<BehaviorInsight> toSave = new ArrayList<>();
    int written = 0;

    for (String key : registry.all().stream().map(p -> p.key()).toList()) {
      List<UserBehaviorDay> series = byKey.getOrDefault(key, List.of());
      List<Double> yes = new ArrayList<>();
      List<Double> no  = new ArrayList<>();
      for (UserBehaviorDay r : series) {
        if (r.getDailyScore() == null) continue;
        if (r.isObserved()) yes.add((double) r.getDailyScore());
        else                no.add((double) r.getDailyScore());
      }

      BehaviorInsight existing = existingByKey.get(key);

      if (yes.size() < MIN_PER_BUCKET || no.size() < MIN_PER_BUCKET) {
        if (existing != null) toDelete.add(existing.getId());
        continue;
      }

      WelchTTest.Result result = WelchTTest.run(toArray(yes), toArray(no));
      double delta = result.meanA() - result.meanB();
      double absD  = Math.abs(result.cohensD());

      if (result.pValue() > P_VALUE_MAX || absD < COHENS_D_MIN) {
        if (existing != null) toDelete.add(existing.getId());
        continue;
      }

      String confidence = result.pValue() < P_HIGH ? "high"
                        : result.pValue() < P_MED  ? "med"
                        : "low";

      BehaviorInsight insight = existing != null
          ? existing
          : BehaviorInsight.builder().userId(userId).behaviorKey(key).build();
      insight.setDeltaScore(BigDecimal.valueOf(delta).setScale(2, RoundingMode.HALF_UP));
      insight.setCohensD(BigDecimal.valueOf(result.cohensD()).setScale(3, RoundingMode.HALF_UP));
      insight.setPValue(BigDecimal.valueOf(result.pValue()).setScale(4, RoundingMode.HALF_UP));
      insight.setSampleYes(yes.size());
      insight.setSampleNo(no.size());
      insight.setConfidence(confidence);
      insight.setComputedAt(OffsetDateTime.now(ZoneOffset.UTC));
      toSave.add(insight);
      written++;
    }

    if (!toSave.isEmpty()) insightRepository.saveAll(toSave);
    if (!toDelete.isEmpty()) insightRepository.deleteAllByIdInBatch(toDelete);

    log.info("Insight recompute: user={} wrote={} dropped={}", userId, written, toDelete.size());
    return written;
  }


  // ===================================================================== mutations

  @Transactional
  public BehaviorInsight setPinned(UUID userId, Long insightId, boolean pinned) {
    BehaviorInsight insight = loadOwned(userId, insightId);
    insight.setPinned(pinned);
    return insightRepository.save(insight);
  }

  @Transactional
  public void dismiss(UUID userId, Long insightId) {
    BehaviorInsight insight = loadOwned(userId, insightId);
    insight.setDismissedUntil(LocalDate.now(ZoneOffset.UTC).plusDays(14));
    insightRepository.save(insight);
  }

  private BehaviorInsight loadOwned(UUID userId, Long insightId) {
    BehaviorInsight insight = insightRepository.findById(insightId)
        .orElseThrow(() -> new com.fitnessapp.backend.behavior.BehaviorInsightException(
            com.fitnessapp.backend.api.common.ErrorCode.INSIGHT_NOT_FOUND));
    if (!insight.getUserId().equals(userId)) {
      throw new com.fitnessapp.backend.behavior.BehaviorInsightException(
          com.fitnessapp.backend.api.common.ErrorCode.INSIGHT_ACCESS_DENIED);
    }
    return insight;
  }

  // -------- helpers --------------------------------------------------------

  private static double[] toArray(List<Double> xs) {
    double[] out = new double[xs.size()];
    for (int i = 0; i < xs.size(); i++) out[i] = xs.get(i);
    return out;
  }
}
