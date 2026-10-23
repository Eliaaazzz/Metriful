package com.fitnessapp.backend.nutrition.repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.fitnessapp.backend.nutrition.entity.MealLog;

public interface MealLogRepository extends JpaRepository<MealLog, Long> {

  List<MealLog> findByUserIdAndConsumedAtBetweenOrderByConsumedAtAsc(UUID userId, OffsetDateTime start, OffsetDateTime end);

  List<MealLog> findByUserIdAndConsumedAtBetweenOrderByConsumedAtDesc(UUID userId, OffsetDateTime start, OffsetDateTime end);

  @Query("select coalesce(sum(coalesce(m.calories, 0) + coalesce(m.totalCalories, 0)), 0) from MealLog m where m.userId = :userId and m.consumedAt between :start and :end")
  Long sumCalories(@Param("userId") UUID userId, @Param("start") OffsetDateTime start, @Param("end") OffsetDateTime end);

  @Query("select coalesce(sum(coalesce(m.proteinGrams, 0) + coalesce(m.totalProtein, 0)), 0) from MealLog m where m.userId = :userId and m.consumedAt between :start and :end")
  BigDecimal sumProtein(@Param("userId") UUID userId, @Param("start") OffsetDateTime start, @Param("end") OffsetDateTime end);

  @Query("select coalesce(sum(coalesce(m.carbsGrams, 0) + coalesce(m.totalCarbs, 0)), 0) from MealLog m where m.userId = :userId and m.consumedAt between :start and :end")
  BigDecimal sumCarbs(@Param("userId") UUID userId, @Param("start") OffsetDateTime start, @Param("end") OffsetDateTime end);

  @Query("select coalesce(sum(coalesce(m.fatGrams, 0) + coalesce(m.totalFat, 0)), 0) from MealLog m where m.userId = :userId and m.consumedAt between :start and :end")
  BigDecimal sumFat(@Param("userId") UUID userId, @Param("start") OffsetDateTime start, @Param("end") OffsetDateTime end);

  @Query("""
      select m.userId as userId,
             count(m) as entryCount,
             max(m.consumedAt) as lastLog
        from MealLog m
       where m.consumedAt >= :start
       group by m.userId
       order by entryCount desc, lastLog desc
      """)
  List<MealLogLeaderboardRow> leaderboardSince(@Param("start") OffsetDateTime start, Pageable pageable);

  // === New: History Log pagination queries ===

  /**
   * Paginated query for user's meal history (no date filter)
   */
  Page<MealLog> findByUserId(UUID userId, Pageable pageable);

  /**
   * Delete all meal logs for a user (for account deletion)
   */
  void deleteByUserId(UUID userId);

  /**
   * Paginated query for user's meal history with start date only
   */
  Page<MealLog> findByUserIdAndConsumedAtGreaterThanEqual(
    UUID userId,
    OffsetDateTime startDate,
    Pageable pageable
  );

  /**
   * Paginated query for user's meal history with end date only
   */
  Page<MealLog> findByUserIdAndConsumedAtLessThan(
    UUID userId,
    OffsetDateTime endDate,
    Pageable pageable
  );

  /**
   * Paginated query for user's meal history with date range
   */
  Page<MealLog> findByUserIdAndConsumedAtGreaterThanEqualAndConsumedAtLessThan(
    UUID userId,
    OffsetDateTime startDate,
    OffsetDateTime endDate,
    Pageable pageable
  );

  // === New: Weekly Insights aggregation queries ===
  
  /**
   * Get daily nutrition summary grouped by date (for daily trend charts)
   */
  @Query("""
    SELECT 
      CAST(m.consumedAt AS LocalDate) as date,
      COUNT(m) as mealCount,
      SUM(COALESCE(m.calories, 0) + COALESCE(m.totalCalories, 0)) as totalCalories,
      SUM(COALESCE(m.proteinGrams, 0) + COALESCE(m.totalProtein, 0)) as totalProtein,
      SUM(COALESCE(m.carbsGrams, 0) + COALESCE(m.totalCarbs, 0)) as totalCarbs,
      SUM(COALESCE(m.fatGrams, 0) + COALESCE(m.totalFat, 0)) as totalFat
    FROM MealLog m
    WHERE m.userId = :userId
      AND m.consumedAt >= :start
      AND m.consumedAt < :end
    GROUP BY CAST(m.consumedAt AS LocalDate)
    ORDER BY CAST(m.consumedAt AS LocalDate) ASC
  """)
  List<DailyNutritionSummary> getDailyNutritionSummary(
    @Param("userId") UUID userId,
    @Param("start") OffsetDateTime start,
    @Param("end") OffsetDateTime end
  );
  
  /**
   * Get weekly total summary (for average calculations)
   */
  @Query("""
    SELECT 
      COUNT(m) as totalMeals,
      SUM(COALESCE(m.calories, 0) + COALESCE(m.totalCalories, 0)) as totalCalories,
      SUM(COALESCE(m.proteinGrams, 0) + COALESCE(m.totalProtein, 0)) as totalProtein,
      SUM(COALESCE(m.carbsGrams, 0) + COALESCE(m.totalCarbs, 0)) as totalCarbs,
      SUM(COALESCE(m.fatGrams, 0) + COALESCE(m.totalFat, 0)) as totalFat
    FROM MealLog m
    WHERE m.userId = :userId
      AND m.consumedAt >= :start
      AND m.consumedAt < :end
  """)
  WeeklySummary getWeeklySummary(
    @Param("userId") UUID userId,
    @Param("start") OffsetDateTime start,
    @Param("end") OffsetDateTime end
  );
  
  // === Projection Interfaces ===

  interface MealLogLeaderboardRow {
    UUID getUserId();
    long getEntryCount();
    OffsetDateTime getLastLog();
  }
  
  // ========== Squads / leaderboard helpers ==========

  long countByUserIdAndConsumedAtAfter(UUID userId, OffsetDateTime since);

  @Query("SELECT COUNT(DISTINCT FUNCTION('DATE', m.consumedAt)) FROM MealLog m WHERE m.userId = :userId AND m.consumedAt >= :since")
  long countDistinctDaysByUserSince(@Param("userId") UUID userId, @Param("since") OffsetDateTime since);

  /** Returns true if at least one meal log exists for {@code userId} in the half-open window. */
  @Query("""
      SELECT COUNT(m) > 0 FROM MealLog m
       WHERE m.userId = :userId
         AND m.consumedAt >= :start
         AND m.consumedAt <  :end
      """)
  boolean existsLogInRange(@Param("userId") UUID userId,
                           @Param("start") OffsetDateTime start,
                           @Param("end")   OffsetDateTime end);

  interface DailyNutritionSummary {
    LocalDate getDate();
    Long getMealCount();
    Long getTotalCalories();
    BigDecimal getTotalProtein();
    BigDecimal getTotalCarbs();
    BigDecimal getTotalFat();
  }
  
  interface WeeklySummary {
    Long getTotalMeals();
    Long getTotalCalories();
    BigDecimal getTotalProtein();
    BigDecimal getTotalCarbs();
    BigDecimal getTotalFat();
  }
}
