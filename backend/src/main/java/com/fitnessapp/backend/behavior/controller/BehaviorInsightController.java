package com.fitnessapp.backend.behavior.controller;

import com.fitnessapp.backend.behavior.BehaviorInsightException;
import com.fitnessapp.backend.api.common.ErrorCode;
import com.fitnessapp.backend.behavior.dto.BehaviorDayPoint;
import com.fitnessapp.backend.behavior.dto.ColdStartResponse;
import com.fitnessapp.backend.behavior.dto.InsightDetailResponse;
import com.fitnessapp.backend.behavior.dto.InsightMapper;
import com.fitnessapp.backend.behavior.dto.InsightResponse;
import com.fitnessapp.backend.behavior.dto.ScoreSplit;
import com.fitnessapp.backend.behavior.entity.BehaviorInsight;
import com.fitnessapp.backend.behavior.entity.UserBehaviorDay;
import com.fitnessapp.backend.behavior.predicate.BehaviorPredicateRegistry;
import com.fitnessapp.backend.behavior.repository.BehaviorInsightRepository;
import com.fitnessapp.backend.behavior.repository.UserBehaviorDayRepository;
import com.fitnessapp.backend.behavior.service.BehaviorDeriver;
import com.fitnessapp.backend.behavior.service.InsightStatsService;
import com.fitnessapp.backend.security.CurrentUser;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/insights")
@RequiredArgsConstructor
public class BehaviorInsightController {

  private final CurrentUser currentUser;
  private final InsightStatsService statsService;
  private final BehaviorInsightRepository insightRepository;
  private final UserBehaviorDayRepository dayRepository;
  private final BehaviorPredicateRegistry registry;
  private final BehaviorDeriver deriver;

  @GetMapping
  public ResponseEntity<List<InsightResponse>> list() {
    UUID userId = currentUser.requireUserId();
    List<InsightResponse> out = statsService.listForUser(userId).stream()
        .map(i -> InsightMapper.toResponse(i, registry))
        .toList();
    return ResponseEntity.ok(out);
  }

  @GetMapping("/cold-start")
  public ResponseEntity<ColdStartResponse> coldStart() {
    UUID userId = currentUser.requireUserId();
    InsightStatsService.ColdStartStatus status = statsService.coldStartStatus(userId);
    if (!status.unlocked()) {
      deriver.backfill(userId, LocalDate.now(ZoneOffset.UTC).minusDays(1), ZoneOffset.UTC);
      statsService.recomputeForUser(userId);
      status = statsService.coldStartStatus(userId);
    }
    return ResponseEntity.ok(new ColdStartResponse(status.daysLogged(), status.target(), status.unlocked()));
  }

  @PostMapping("/{id}/pin")
  public ResponseEntity<InsightResponse> pin(@PathVariable Long id) {
    UUID userId = currentUser.requireUserId();
    BehaviorInsight insight = statsService.setPinned(userId, id, true);
    return ResponseEntity.ok(InsightMapper.toResponse(insight, registry));
  }

  @DeleteMapping("/{id}/pin")
  public ResponseEntity<InsightResponse> unpin(@PathVariable Long id) {
    UUID userId = currentUser.requireUserId();
    BehaviorInsight insight = statsService.setPinned(userId, id, false);
    return ResponseEntity.ok(InsightMapper.toResponse(insight, registry));
  }

  @PostMapping("/{id}/dismiss")
  public ResponseEntity<Void> dismiss(@PathVariable Long id) {
    UUID userId = currentUser.requireUserId();
    statsService.dismiss(userId, id);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/{id}/detail")
  public ResponseEntity<InsightDetailResponse> detail(@PathVariable Long id) {
    UUID userId = currentUser.requireUserId();
    BehaviorInsight insight = insightRepository.findById(id)
        .orElseThrow(() -> new BehaviorInsightException(ErrorCode.INSIGHT_NOT_FOUND));
    if (!insight.getUserId().equals(userId)) {
      throw new BehaviorInsightException(ErrorCode.INSIGHT_ACCESS_DENIED);
    }

    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    LocalDate from = today.minusDays(89);
    List<UserBehaviorDay> rows = dayRepository.findByUserIdAndBehaviorKeyAndDayBetween(
        userId, insight.getBehaviorKey(), from, today);

    List<BehaviorDayPoint> calendar = new ArrayList<>(rows.size());
    List<Integer> yesScores = new ArrayList<>();
    List<Integer> noScores  = new ArrayList<>();
    for (UserBehaviorDay r : rows) {
      calendar.add(new BehaviorDayPoint(r.getDay(), r.isObserved(), r.getDailyScore()));
      if (r.getDailyScore() != null) {
        if (r.isObserved()) yesScores.add(r.getDailyScore().intValue());
        else                noScores.add(r.getDailyScore().intValue());
      }
    }

    return ResponseEntity.ok(new InsightDetailResponse(
        InsightMapper.toResponse(insight, registry),
        calendar,
        new ScoreSplit(yesScores, noScores)
    ));
  }

  /** Recompute on demand (manual trigger; nightly scheduler runs the same code). */
  @PostMapping("/recompute")
  public ResponseEntity<RecomputeResponse> recompute() {
    UUID userId = currentUser.requireUserId();
    int written = statsService.recomputeForUser(userId);
    return ResponseEntity.ok(new RecomputeResponse(written));
  }

  /**
   * Backfill 90 days of behavior data for the current user (dev / first run).
   * The {@code X-User-Timezone} header (e.g. {@code "America/Los_Angeles"})
   * controls local-day bucketing for time-of-day predicates; if missing or
   * invalid we fall back to UTC.
   */
  @PostMapping("/backfill")
  public ResponseEntity<BackfillResponse> backfill(
      @RequestHeader(value = "X-User-Timezone", required = false) String userTimezone
  ) {
    UUID userId = currentUser.requireUserId();
    ZoneId zone = parseZone(userTimezone);
    int days = deriver.backfill(userId, LocalDate.now(zone), zone);
    int written = statsService.recomputeForUser(userId);
    return ResponseEntity.ok(new BackfillResponse(days, written));
  }

  private static ZoneId parseZone(String tz) {
    if (tz == null || tz.isBlank()) return ZoneOffset.UTC;
    try {
      return ZoneId.of(tz.trim());
    } catch (Exception e) {
      return ZoneOffset.UTC;
    }
  }

  public record RecomputeResponse(int insightsWritten) {}
  public record BackfillResponse(int daysProcessed, int insightsWritten) {}
}
