package com.fitnessapp.backend.coach;

import static org.assertj.core.api.Assertions.assertThat;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ComponentScan.Filter;
import org.springframework.context.annotation.FilterType;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ContextConfiguration;
import com.fitnessapp.backend.nutrition.entity.MealLog;
import com.fitnessapp.backend.nutrition.repository.FoodNutritionRepository;
import com.fitnessapp.backend.nutrition.repository.MealLogRepository;

@DataJpaTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:coach;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = CoachNutritionQueryTest.Config.class)
class CoachNutritionQueryTest {
  @Configuration
  @EntityScan(basePackageClasses = MealLog.class)
  @EnableJpaRepositories(basePackageClasses = MealLogRepository.class,
      excludeFilters = @Filter(type = FilterType.ASSIGNABLE_TYPE, classes = FoodNutritionRepository.class))
  static class Config {}

  @Autowired MealLogRepository meals;

  @Test
  void aggregatesBothLogFormatsWithExclusiveEndAndUserIsolation() {
    UUID user = UUID.randomUUID();
    var start = OffsetDateTime.parse("2026-10-04T00:00:00+10:00");
    var end = OffsetDateTime.parse("2026-10-05T00:00:00+11:00");
    var first = meal(user, start, 100);
    first.setProteinGrams(BigDecimal.TEN);
    var second = meal(user, end.minusNanos(1000000), null);
    second.setTotalCalories(200);
    second.setTotalProtein(BigDecimal.valueOf(20));
    meals.saveAllAndFlush(List.of(first, second, meal(user, start.minusSeconds(1), 500),
        meal(user, end, 600), meal(UUID.randomUUID(), start, 900)));
    var result = meals.coachTotals(user, start, end);
    assertThat(result.getMealCount()).isEqualTo(2);
    assertThat(result.getCalories()).isEqualTo(300);
    assertThat(result.getProtein()).isEqualByComparingTo("30");
    assertThat(result.getFat()).isEqualByComparingTo("0");
  }

  private MealLog meal(UUID user, OffsetDateTime time, Integer calories) {
    return MealLog.builder().userId(user).mealType("LUNCH").consumedAt(time).calories(calories).build();
  }
}
