package com.fitnessapp.backend.coach;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import com.fitnessapp.backend.nutrition.repository.MealLogRepository;
import com.fitnessapp.backend.user.repository.UserProfileRepository;

class CoachContextServiceTest {
  @Test
  void cacheIsScopedToIdentityDateAndTimezoneAndUsesLocalDstBoundaries() {
    var meals = mock(MealLogRepository.class);
    var profiles = mock(UserProfileRepository.class);
    var totals = mock(CoachNutritionTotals.class);
    when(totals.getMealCount()).thenReturn(0L);
    when(totals.getCalories()).thenReturn(0L);
    when(totals.getProtein()).thenReturn(BigDecimal.ZERO);
    when(totals.getCarbs()).thenReturn(BigDecimal.ZERO);
    when(totals.getFat()).thenReturn(BigDecimal.ZERO);
    when(meals.coachTotals(any(), any(), any())).thenReturn(totals);
    when(profiles.findByUserId(any())).thenReturn(Optional.empty());
    var service = new CoachContextService(meals, profiles);
    UUID first = UUID.randomUUID(), second = UUID.randomUUID();
    LocalDate day = LocalDate.of(2026, 10, 4);
    ZoneId zone = ZoneId.of("Australia/Sydney");
    var result = service.context(first, day, zone);
    assertThat(service.context(first, day, zone)).isSameAs(result);
    var start = day.atStartOfDay(zone).toOffsetDateTime();
    var end = day.plusDays(1).atStartOfDay(zone).toOffsetDateTime();
    assertThat(Duration.between(start, end).toHours()).isEqualTo(23);
    verify(meals).coachTotals(first, start, end);
    verify(meals).coachTotals(first, day.minusDays(6).atStartOfDay(zone).toOffsetDateTime(), end);
    service.context(second, day, zone);
    service.context(first, day, ZoneId.of("UTC"));
    service.context(first, day.plusDays(1), zone);
    verify(profiles, times(4)).findByUserId(any());
    assertThat(result).doesNotContainKeys("userId", "health", "email");
    verify(profiles, never()).save(any());
  }
}
