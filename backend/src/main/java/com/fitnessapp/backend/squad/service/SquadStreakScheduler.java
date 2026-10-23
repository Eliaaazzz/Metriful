package com.fitnessapp.backend.squad.service;

import com.fitnessapp.backend.squad.entity.Squad;
import com.fitnessapp.backend.squad.repository.SquadRepository;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Hourly scheduler that evaluates each squad's shared streak shortly after the
 * squad's local midnight. Idempotent — re-running within the same local day is
 * a no-op (the service guards on {@code lastActiveDay}).
 *
 * <p>Why hourly instead of nightly? Squads have per-squad timezones, so the
 * "midnight" moment is different per squad. Iterating once per hour and only
 * processing every unevaluated completed day allows recovery after a missed run.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class SquadStreakScheduler {

  private final SquadRepository squadRepository;
  private final SquadService squadService;

  /** Fires at 5 minutes past every hour (UTC). */
  @Scheduled(cron = "${aurafitness.squads.streak-cron:0 5 * * * *}")
  public void evaluateAllSquads() {
    List<Squad> squads = squadRepository.findAll();
    if (squads.isEmpty()) return;

    int evaluated = 0;
    for (Squad squad : squads) {
      try {
        ZoneId zone = zoneOf(squad);
        LocalDate yesterday = LocalDate.now(zone).minusDays(1);
        LocalDate next = squad.getLastActiveDay() != null
            ? squad.getLastActiveDay().plusDays(1)
            : squad.getCreatedAt() != null
                ? squad.getCreatedAt().atZoneSameInstant(zone).toLocalDate()
                : yesterday;
        while (!next.isAfter(yesterday)) {
          squadService.evaluateStreakForDay(squad.getId(), next);
          evaluated++;
          next = next.plusDays(1);
        }
      } catch (Exception e) {
        log.error("Squad {} streak evaluation failed", squad.getId(), e);
      }
    }
    if (evaluated > 0) {
      log.info("Squad streak job evaluated {} of {} squads", evaluated, squads.size());
    }
  }

  private static ZoneId zoneOf(Squad squad) {
    String tz = squad.getTimezone();
    if (tz == null || tz.isBlank()) return ZoneId.of("UTC");
    try {
      return ZoneId.of(tz);
    } catch (Exception e) {
      return ZoneId.of("UTC");
    }
  }
}
