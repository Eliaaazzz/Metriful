package com.fitnessapp.backend.behavior.repository;

import com.fitnessapp.backend.behavior.entity.BehaviorInsight;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BehaviorInsightRepository extends JpaRepository<BehaviorInsight, Long> {

  Optional<BehaviorInsight> findByUserIdAndBehaviorKey(UUID userId, String behaviorKey);

  /** All insights for a user, regardless of freshness — used by recompute to avoid N+1 lookups. */
  List<BehaviorInsight> findAllByUserId(UUID userId);

  /**
   * Active insights = computed within the freshness window AND not currently
   * dismissed (i.e. {@code dismissed_until} is null or in the past).
   */
  @Query("""
      SELECT i FROM BehaviorInsight i
       WHERE i.userId = :userId
         AND i.computedAt >= :freshSince
         AND (i.dismissedUntil IS NULL OR i.dismissedUntil < CURRENT_DATE)
       ORDER BY i.pinned DESC, ABS(i.deltaScore) DESC
      """)
  List<BehaviorInsight> findActiveForUser(
      @Param("userId") UUID userId,
      @Param("freshSince") OffsetDateTime freshSince);

  void deleteByUserId(UUID userId);
}
