package com.fitnessapp.backend.squad.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fitnessapp.backend.api.common.ErrorCode;
import com.fitnessapp.backend.nutrition.entity.MealLog;
import com.fitnessapp.backend.nutrition.repository.MealLogRepository;
import com.fitnessapp.backend.squad.SquadException;
import com.fitnessapp.backend.squad.dto.KudosResponse;
import com.fitnessapp.backend.squad.entity.MealLogKudos;
import com.fitnessapp.backend.squad.repository.MealLogKudosRepository;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class KudosServiceTest {

  @Mock private MealLogRepository mealLogRepository;
  @Mock private MealLogKudosRepository kudosRepository;
  @Mock private SquadService squadService;

  private KudosService service;

  private final UUID actor = UUID.randomUUID();
  private final UUID owner = UUID.randomUUID();
  private final long mealLogId = 42L;

  @BeforeEach
  void setUp() {
    service = new KudosService(mealLogRepository, kudosRepository, squadService);
  }

  @Test
  void toggle_addsKudosWhenAbsent() {
    MealLog meal = recentMealOwnedBy(owner);
    when(mealLogRepository.findById(mealLogId)).thenReturn(Optional.of(meal));
    when(squadService.shareSquad(actor, owner)).thenReturn(true);
    when(kudosRepository.existsByMealLogIdAndUserId(mealLogId, actor)).thenReturn(false);
    when(kudosRepository.countByMealLogId(mealLogId)).thenReturn(1L);

    KudosResponse response = service.toggle(actor, mealLogId);

    assertThat(response.kudoed()).isTrue();
    assertThat(response.kudosCount()).isEqualTo(1);
    verify(kudosRepository).save(any(MealLogKudos.class));
  }

  @Test
  void toggle_removesKudosWhenPresent() {
    MealLog meal = recentMealOwnedBy(owner);
    when(mealLogRepository.findById(mealLogId)).thenReturn(Optional.of(meal));
    when(squadService.shareSquad(actor, owner)).thenReturn(true);
    when(kudosRepository.existsByMealLogIdAndUserId(mealLogId, actor)).thenReturn(true);
    when(kudosRepository.countByMealLogId(mealLogId)).thenReturn(0L);

    KudosResponse response = service.toggle(actor, mealLogId);

    assertThat(response.kudoed()).isFalse();
    assertThat(response.kudosCount()).isZero();
    verify(kudosRepository).deleteByMealLogIdAndUserId(mealLogId, actor);
    verify(kudosRepository, never()).save(any());
  }

  @Test
  void toggle_rejectsSelfKudos() {
    MealLog meal = recentMealOwnedBy(actor); // actor is also the meal owner
    when(mealLogRepository.findById(mealLogId)).thenReturn(Optional.of(meal));

    assertThatThrownBy(() -> service.toggle(actor, mealLogId))
        .isInstanceOf(SquadException.class)
        .extracting(e -> ((SquadException) e).getErrorCode())
        .isEqualTo(ErrorCode.KUDOS_SELF_FORBIDDEN);
  }

  @Test
  void toggle_rejectsExpiredMeal() {
    MealLog meal = MealLog.builder()
        .userId(owner)
        .consumedAt(OffsetDateTime.now(ZoneOffset.UTC).minusDays(8)) // outside 7-day window
        .build();
    when(mealLogRepository.findById(mealLogId)).thenReturn(Optional.of(meal));

    assertThatThrownBy(() -> service.toggle(actor, mealLogId))
        .isInstanceOf(SquadException.class)
        .extracting(e -> ((SquadException) e).getErrorCode())
        .isEqualTo(ErrorCode.KUDOS_FORBIDDEN);
  }

  @Test
  void toggle_rejectsWhenUsersDoNotShareSquad() {
    MealLog meal = recentMealOwnedBy(owner);
    when(mealLogRepository.findById(mealLogId)).thenReturn(Optional.of(meal));
    when(squadService.shareSquad(actor, owner)).thenReturn(false);

    assertThatThrownBy(() -> service.toggle(actor, mealLogId))
        .isInstanceOf(SquadException.class)
        .extracting(e -> ((SquadException) e).getErrorCode())
        .isEqualTo(ErrorCode.KUDOS_FORBIDDEN);
  }

  @Test
  void toggle_rejectsUnknownMeal() {
    when(mealLogRepository.findById(eq(mealLogId))).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.toggle(actor, mealLogId))
        .isInstanceOf(SquadException.class)
        .extracting(e -> ((SquadException) e).getErrorCode())
        .isEqualTo(ErrorCode.MEAL_NOT_FOUND);
  }

  private MealLog recentMealOwnedBy(UUID ownerId) {
    return MealLog.builder()
        .userId(ownerId)
        .consumedAt(OffsetDateTime.now(ZoneOffset.UTC).minusHours(3))
        .build();
  }
}
