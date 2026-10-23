package com.fitnessapp.backend.squad.service;

import com.fitnessapp.backend.api.common.ErrorCode;
import com.fitnessapp.backend.nutrition.entity.MealLog;
import com.fitnessapp.backend.nutrition.repository.MealLogRepository;
import com.fitnessapp.backend.squad.SquadException;
import com.fitnessapp.backend.squad.dto.KudosResponse;
import com.fitnessapp.backend.squad.entity.MealLogKudos;
import com.fitnessapp.backend.squad.repository.MealLogKudosRepository;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Toggle Kudos on a meal log. Kudos is allowed only when:
 * <ul>
 *   <li>The actor is not the meal owner.</li>
 *   <li>The meal owner shares at least one squad with the actor.</li>
 *   <li>The meal was consumed within the last 7 days.</li>
 * </ul>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class KudosService {

  static final int KUDOS_WINDOW_DAYS = 7;

  private final MealLogRepository mealLogRepository;
  private final MealLogKudosRepository kudosRepository;
  private final SquadService squadService;

  /**
   * Toggle a kudos. If the user has already kudoed this meal the row is removed;
   * otherwise it is created. Returns the post-toggle count and the new state.
   */
  @Transactional
  public KudosResponse toggle(UUID actorUserId, Long mealLogId) {
    MealLog meal = mealLogRepository.findById(mealLogId)
        .orElseThrow(() -> new SquadException(ErrorCode.MEAL_NOT_FOUND));

    if (meal.getUserId().equals(actorUserId)) {
      throw new SquadException(ErrorCode.KUDOS_SELF_FORBIDDEN);
    }

    OffsetDateTime cutoff = OffsetDateTime.now(ZoneOffset.UTC).minusDays(KUDOS_WINDOW_DAYS);
    if (meal.getConsumedAt() == null || meal.getConsumedAt().isBefore(cutoff)) {
      throw new SquadException(ErrorCode.KUDOS_FORBIDDEN, "Kudos window has expired for this meal");
    }

    if (!squadService.shareSquad(actorUserId, meal.getUserId())) {
      throw new SquadException(ErrorCode.KUDOS_FORBIDDEN, "Kudos requires sharing a squad");
    }

    boolean kudoed;
    if (kudosRepository.existsByMealLogIdAndUserId(mealLogId, actorUserId)) {
      kudosRepository.deleteByMealLogIdAndUserId(mealLogId, actorUserId);
      kudoed = false;
    } else {
      kudosRepository.save(MealLogKudos.builder()
          .mealLogId(mealLogId)
          .userId(actorUserId)
          .build());
      kudoed = true;
    }

    long count = kudosRepository.countByMealLogId(mealLogId);
    log.info("Kudos toggle: actor={} meal={} kudoed={} count={}", actorUserId, mealLogId, kudoed, count);
    return new KudosResponse(mealLogId, count, kudoed);
  }
}
