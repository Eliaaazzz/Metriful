package com.fitnessapp.backend.coach;

import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.fitnessapp.backend.nutrition.repository.MealLogRepository;
import com.fitnessapp.backend.user.repository.UserProfileRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CoachContextService {
  private final MealLogRepository meals;
  private final UserProfileRepository profiles;
  private record Key(UUID userId, LocalDate date, ZoneId zone) {}
  private final Cache<Key, Map<String, Object>> cache = Caffeine.newBuilder()
      .maximumSize(1000).expireAfterWrite(Duration.ofSeconds(15)).build();

  public Map<String, Object> context(UUID userId, LocalDate date, ZoneId zone) {
    return cache.get(new Key(userId, date, zone), this::load);
  }

  private Map<String, Object> load(Key key) {
    var start = key.date.atStartOfDay(key.zone).toOffsetDateTime();
    var end = key.date.plusDays(1).atStartOfDay(key.zone).toOffsetDateTime();
    var weekStart = key.date.minusDays(6).atStartOfDay(key.zone).toOffsetDateTime();
    Map<String, Object> profile = new LinkedHashMap<>();
    profiles.findByUserId(key.userId).ifPresent(p -> {
      profile.put("fitnessGoal", p.getFitnessGoal());
      profile.put("dietaryPreference", p.getDietaryPreference());
      profile.put("dailyCalorieTarget", p.getDailyCalorieTarget());
      profile.put("dailyProteinTarget", p.getDailyProteinTarget());
      profile.put("dailyCarbsTarget", p.getDailyCarbsTarget());
      profile.put("dailyFatTarget", p.getDailyFatTarget());
    });
    // No default profile creation, identifiers, free-text notes or health samples in this cache.
    return Map.of("nutritionToday", totals(meals.coachTotals(key.userId, start, end)),
        "nutritionWeek", totals(meals.coachTotals(key.userId, weekStart, end)),
        "profile", profile, "date", key.date, "timeZone", key.zone.getId());
  }

  private Map<String, Object> totals(CoachNutritionTotals totals) {
    return Map.of("mealCount", totals.getMealCount(), "calories", totals.getCalories(),
        "proteinGrams", totals.getProtein(), "carbsGrams", totals.getCarbs(),
        "fatGrams", totals.getFat(), "coverage", "Logged meals only; missing meals are unknown");
  }
}
