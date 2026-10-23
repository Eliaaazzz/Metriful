package com.fitnessapp.backend.behavior.repository;

import com.fitnessapp.backend.behavior.entity.UserBehaviorDay;
import com.fitnessapp.backend.behavior.entity.UserBehaviorDayId;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserBehaviorDayRepository extends JpaRepository<UserBehaviorDay, UserBehaviorDayId> {

  List<UserBehaviorDay> findByUserIdAndDayBetween(UUID userId, LocalDate from, LocalDate to);

  List<UserBehaviorDay> findByUserIdAndBehaviorKeyAndDayBetween(
      UUID userId, String behaviorKey, LocalDate from, LocalDate to);

  @Query("SELECT COUNT(DISTINCT b.day) FROM UserBehaviorDay b WHERE b.userId = :userId")
  long countDistinctDaysForUser(@Param("userId") UUID userId);

  void deleteByUserIdAndDayBetween(UUID userId, LocalDate from, LocalDate to);

  /**
   * Bulk trim of rows older than {@code cutoff} (exclusive). Used by the nightly
   * scheduler to keep the rolling window bounded across all users in a single SQL
   * statement (vs N delete queries inside the per-user loop).
   */
  @org.springframework.data.jpa.repository.Modifying
  @org.springframework.transaction.annotation.Transactional
  @Query("DELETE FROM UserBehaviorDay b WHERE b.day < :cutoff")
  int deleteByDayBefore(@Param("cutoff") LocalDate cutoff);

  void deleteByUserId(UUID userId);
}
