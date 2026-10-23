package com.fitnessapp.backend.behavior.service;

import com.fitnessapp.backend.behavior.repository.UserBehaviorDayRepository;
import com.fitnessapp.backend.user.entity.User;
import com.fitnessapp.backend.user.repository.UserRepository;

import java.time.LocalDate;
import java.time.ZoneOffset;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nightly job that re-derives behavior days for the trailing day and recomputes
 * each user's insights. Scheduled at 03:00 UTC by default; override via the
 * {@code aurafitness.insights.recompute-cron} property.
 *
 * <p>For each user we incrementally derive <em>only</em> yesterday (cheap) so
 * the 90-day pool stays current without rewriting the full window every night.
 *
 * <p>Scalability: users are walked in {@link #BATCH_SIZE}-row pages so the JVM
 * never holds the entire user table in memory; the trailing-window trim is a
 * single bulk SQL statement instead of N per-user deletes.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class InsightScheduler {

  private static final int BATCH_SIZE = 200;

  private final UserRepository userRepository;
  private final UserBehaviorDayRepository dayRepository;
  private final BehaviorDeriver deriver;
  private final InsightStatsService statsService;

  /** Default zone used when we don't (yet) know the user's timezone. */
  @Value("${aurafitness.insights.default-zone:UTC}")
  private String defaultZone;

  @Scheduled(cron = "${aurafitness.insights.recompute-cron:0 0 3 * * *}")
  public void runNightly() {
    LocalDate yesterday = LocalDate.now(ZoneOffset.UTC).minusDays(1);
    LocalDate trimCutoff = yesterday.minusDays(90);

    // One bulk delete for the whole table; cheaper and atomic.
    int trimmed = dayRepository.deleteByDayBefore(trimCutoff);

    java.time.ZoneId zone;
    try {
      zone = java.time.ZoneId.of(defaultZone);
    } catch (Exception e) {
      zone = ZoneOffset.UTC;
    }

    int derived = 0;
    int recomputed = 0;
    int processedUsers = 0;
    int pageIndex = 0;

    while (true) {
      Pageable page = PageRequest.of(pageIndex, BATCH_SIZE);
      Page<User> userPage = userRepository.findAll(page);
      if (userPage.isEmpty()) break;

      for (User user : userPage.getContent()) {
        processedUsers++;
        try {
          // TODO(#221-followup): plumb each user's profile timezone here.
          deriver.deriveRange(user.getId(), yesterday, yesterday, zone);
          derived++;
          statsService.recomputeForUser(user.getId());
          recomputed++;
        } catch (Exception e) {
          log.error("Insight nightly job failed for user {}", user.getId(), e);
        }
      }
      if (!userPage.hasNext()) break;
      pageIndex++;
    }
    log.info("Insight nightly job: trimmed={} derived={} recomputed={} of {} users",
        trimmed, derived, recomputed, processedUsers);
  }
}
