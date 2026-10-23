package com.fitnessapp.backend.coach;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ComponentScan.Filter;
import org.springframework.context.annotation.FilterType;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.http.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import com.fitnessapp.backend.auth.JwtUtils;
import com.fitnessapp.backend.config.*;
import com.fitnessapp.backend.api.common.GlobalExceptionHandler;
import com.fitnessapp.backend.nutrition.entity.MealLog;
import com.fitnessapp.backend.nutrition.repository.*;
import com.fitnessapp.backend.user.entity.*;
import com.fitnessapp.backend.user.repository.*;
import com.fasterxml.jackson.databind.JsonNode;

/** Runs against a real Python HTTP process started by scripts/verify_http_chain.py. */
@EnabledIfEnvironmentVariable(named = "COACH_HTTP_INTEGRATION", matches = "true")
@SpringBootTest(classes = CoachHttpIntegrationTest.Application.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
      "spring.profiles.active=coach-http-test",
      "spring.datasource.url=jdbc:h2:mem:coachhttp;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
      "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
      "spring.datasource.password=", "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
      "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
      "spring.jpa.show-sql=false", "app.api-key=coach-local-http-test",
      "app.jwt.secret=local-http-fixture-secret-with-more-than-32-characters",
      "logging.level.org.springframework.security=WARN", "logging.level.org.hibernate=WARN"
    })
class CoachHttpIntegrationTest {
  @Configuration
  @EnableAutoConfiguration
  @EntityScan(basePackageClasses = {MealLog.class, User.class})
  @EnableJpaRepositories(basePackageClasses = {MealLogRepository.class, UserRepository.class},
      excludeFilters = @Filter(type = FilterType.ASSIGNABLE_TYPE, classes = FoodNutritionRepository.class))
  @Import({CoachController.class, CoachGateway.class, CoachContextService.class,
      SecurityConfig.class, ApiKeyAuthFilter.class, JwtUtils.class, CorsConfig.class, GlobalExceptionHandler.class})
  static class Application {}

  @Autowired TestRestTemplate http;
  @Autowired UserRepository users;
  @Autowired UserProfileRepository profiles;
  @Autowired MealLogRepository meals;
  @Autowired JwtUtils jwt;
  @Autowired PlatformTransactionManager transactions;
  private User user;
  private final LocalDate day = LocalDate.now(ZoneId.of("Australia/Sydney"));

  @BeforeEach
  void fixture() {
    new TransactionTemplate(transactions).executeWithoutResult(status -> {
    user = users.saveAndFlush(User.builder().email(UUID.randomUUID() + "@example.invalid")
        .timeBucket(1).level("BEGINNER").build());
    profiles.saveAndFlush(UserProfile.builder().user(user).dailyCalorieTarget(2000)
        .dailyProteinTarget(100).fitnessGoal(FitnessGoal.MAINTAIN).build());
    meals.saveAndFlush(MealLog.builder().userId(user.getId()).mealType("LUNCH").calories(1234)
        .consumedAt(day.atTime(12, 0).atZone(ZoneId.of("Australia/Sydney")).toOffsetDateTime()).build());
    });
  }

  private Map<String, Object> body(String message, boolean share) {
    var health = new LinkedHashMap<String, Object>();
    health.put("date", day.toString()); health.put("timeZone", "Australia/Sydney");
    health.put("capturedAt", OffsetDateTime.now().toString()); health.put("steps", 3456);
    var body = new LinkedHashMap<String, Object>();
    body.put("message", message); body.put("date", day.toString()); body.put("timeZone", "Australia/Sydney");
    body.put("shareHealth", share); body.put("health", health); body.put("history", List.of());
    return body;
  }

  private ResponseEntity<JsonNode> post(Map<String, Object> body, boolean authenticated) {
    var headers = new HttpHeaders();
    headers.set("X-API-Key", "coach-local-http-test");
    headers.setContentType(MediaType.APPLICATION_JSON);
    if (authenticated) headers.setBearerAuth(jwt.generateToken(user.getId(), user.getEmail()));
    return http.postForEntity("/api/v1/coach/runs", new HttpEntity<>(body, headers), JsonNode.class);
  }

  @Test
  void authenticatedRequestReadsDatabaseThroughPythonAndGeminiSdk() {
    var body = body("Review my weekly nutrition", false);
    body.put("userId", UUID.randomUUID());
    body.put("context", Map.of("nutritionWeek", Map.of("calories", 99999)));
    var response = post(body, true);
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody().get("answer").asText()).contains("1234").doesNotContain("99999");
    assertThat(response.getBody().get("tools").toString()).contains("nutrition_week");
  }

  @Test
  void healthConsentControlsWhatTheModelCanRead() {
    var shared = post(body("Read my Apple Health steps", true), true);
    assertThat(shared.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(shared.getBody().get("answer").asText()).contains("3456");
    assertThat(shared.getBody().get("tools").toString()).contains("apple_health");
    var privateResponse = post(body("Read my Apple Health steps", false), true);
    assertThat(privateResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(privateResponse.getBody().get("answer").asText()).doesNotContain("3456");
  }

  @Test
  void missingUserAndStaleHealthAreRejectedBeforeModelAccess() {
    assertThat(post(body("Review today", false), false).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    var body = body("Read my steps", true);
    body.put("health", new CoachRequest.HealthSnapshot(day, "Australia/Sydney", OffsetDateTime.now().minusHours(1),
        3456d, null, null, null, null));
    assertThat(post(body, true).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
  }

  @Test
  void providerBillingFailureIsSanitizedAcrossBothHttpBoundaries() {
    var response = post(body("provider billing failure fixture", false), true);
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    assertThat(response.getBody().toString()).doesNotContain("prepayment", "API key", "secret", "3456");
  }
}
