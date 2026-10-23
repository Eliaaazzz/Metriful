package com.fitnessapp.backend.behavior.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.fitnessapp.backend.behavior.predicate.BehaviorPredicateRegistry;
import com.fitnessapp.backend.behavior.repository.BehaviorInsightRepository;
import com.fitnessapp.backend.behavior.repository.UserBehaviorDayRepository;
import com.fitnessapp.backend.behavior.service.BehaviorDeriver;
import com.fitnessapp.backend.behavior.service.InsightStatsService;
import com.fitnessapp.backend.security.CurrentUser;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BehaviorInsightControllerTest {
  @Test
  void firstVisitBackfillsCompletedHistoryAndUnlocksExistingLogger() {
    CurrentUser currentUser = mock(CurrentUser.class);
    InsightStatsService stats = mock(InsightStatsService.class);
    BehaviorDeriver deriver = mock(BehaviorDeriver.class);
    UUID userId = UUID.randomUUID();
    when(currentUser.requireUserId()).thenReturn(userId);
    when(stats.coldStartStatus(userId)).thenReturn(
        new InsightStatsService.ColdStartStatus(0, 30, false),
        new InsightStatsService.ColdStartStatus(35, 30, true));
    BehaviorInsightController controller = new BehaviorInsightController(currentUser, stats,
        mock(BehaviorInsightRepository.class), mock(UserBehaviorDayRepository.class),
        mock(BehaviorPredicateRegistry.class), deriver);

    var response = controller.coldStart().getBody();

    assertThat(response.unlocked()).isTrue();
    assertThat(response.daysLogged()).isEqualTo(35);
    verify(deriver).backfill(userId, LocalDate.now(ZoneOffset.UTC).minusDays(1), ZoneOffset.UTC);
    verify(stats).recomputeForUser(userId);
  }

  @Test
  void initializedUserDoesNotRepeatBackfill() {
    CurrentUser currentUser = mock(CurrentUser.class);
    InsightStatsService stats = mock(InsightStatsService.class);
    BehaviorDeriver deriver = mock(BehaviorDeriver.class);
    UUID userId = UUID.randomUUID();
    when(currentUser.requireUserId()).thenReturn(userId);
    when(stats.coldStartStatus(userId)).thenReturn(new InsightStatsService.ColdStartStatus(35, 30, true));
    BehaviorInsightController controller = new BehaviorInsightController(currentUser, stats,
        mock(BehaviorInsightRepository.class), mock(UserBehaviorDayRepository.class),
        mock(BehaviorPredicateRegistry.class), deriver);

    assertThat(controller.coldStart().getBody().unlocked()).isTrue();
    verifyNoInteractions(deriver);
  }
}
