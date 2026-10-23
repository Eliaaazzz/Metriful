package com.fitnessapp.backend.squad.service;

import com.fitnessapp.backend.api.common.ErrorCode;
import com.fitnessapp.backend.nutrition.repository.MealLogRepository;
import com.fitnessapp.backend.squad.SquadException;
import com.fitnessapp.backend.squad.dto.LeaderboardEntry;
import com.fitnessapp.backend.squad.dto.SquadDetailResponse;
import com.fitnessapp.backend.squad.dto.SquadMapper;
import com.fitnessapp.backend.squad.dto.SquadResponse;
import com.fitnessapp.backend.squad.entity.Squad;
import com.fitnessapp.backend.squad.entity.SquadMember;
import com.fitnessapp.backend.squad.repository.SquadMemberRepository;
import com.fitnessapp.backend.squad.repository.SquadRepository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Squads core service — lifecycle (create / join / leave / list / detail),
 * shared streak evaluation, and 7-day leaderboard.
 *
 * <p>Service-layer invariants (not enforced by SQL):
 * <ul>
 *   <li>Max 10 members per squad</li>
 *   <li>Max 3 active squads per user</li>
 * </ul>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SquadService {

  static final int MAX_MEMBERS_PER_SQUAD = 10;
  static final int MAX_SQUADS_PER_USER = 3;
  static final int LEADERBOARD_WINDOW_DAYS = 7;
  /** Members with fewer than this many distinct logged days in the window are tagged "warming up". */
  static final int LEADERBOARD_MIN_ACTIVE_DAYS = 3;

  private final SquadRepository squadRepository;
  private final SquadMemberRepository squadMemberRepository;
  private final MealLogRepository mealLogRepository;
  private final InviteCodeGenerator inviteCodeGenerator;

  // ===================================================================== Lifecycle

  @Transactional
  public SquadResponse create(UUID userId, String name, String emoji, String timezone) {
    enforceSquadCap(userId);

    Squad squad = Squad.builder()
        .name(name.trim())
        .emoji(emoji.trim())
        .inviteCode(inviteCodeGenerator.generateUnique())
        .ownerUserId(userId)
        .currentStreak(0)
        .longestStreak(0)
        .timezone(normalizeTimezone(timezone))
        .build();
    squad = squadRepository.save(squad);

    SquadMember owner = SquadMember.builder()
        .squadId(squad.getId())
        .userId(userId)
        .role("owner")
        .build();
    squadMemberRepository.save(owner);

    log.info("Squad created: id={} owner={} code={}", squad.getId(), userId, squad.getInviteCode());
    return SquadMapper.toResponse(squad, 1);
  }

  @Transactional
  public SquadResponse joinByCode(UUID userId, String inviteCode) {
    Squad squad = squadRepository.findByInviteCode(inviteCode.trim().toUpperCase())
        .orElseThrow(() -> new SquadException(ErrorCode.SQUAD_INVITE_CODE_INVALID));

    if (squadMemberRepository.existsBySquadIdAndUserId(squad.getId(), userId)) {
      throw new SquadException(ErrorCode.SQUAD_ALREADY_MEMBER);
    }

    enforceSquadCap(userId);

    long memberCount = squadMemberRepository.countBySquadId(squad.getId());
    if (memberCount >= MAX_MEMBERS_PER_SQUAD) {
      throw new SquadException(ErrorCode.SQUAD_FULL);
    }

    squadMemberRepository.save(SquadMember.builder()
        .squadId(squad.getId())
        .userId(userId)
        .role("member")
        .build());

    log.info("User {} joined squad {} (code={})", userId, squad.getId(), squad.getInviteCode());
    return SquadMapper.toResponse(squad, memberCount + 1);
  }

  @Transactional(readOnly = true)
  public List<SquadResponse> listForUser(UUID userId) {
    List<Squad> squads = squadRepository.findAllForMember(userId);
    List<SquadResponse> out = new ArrayList<>(squads.size());
    for (Squad s : squads) {
      out.add(SquadMapper.toResponse(s, squadMemberRepository.countBySquadId(s.getId())));
    }
    return out;
  }

  @Transactional(readOnly = true)
  public SquadDetailResponse getDetail(UUID userId, UUID squadId) {
    Squad squad = squadRepository.findById(squadId)
        .orElseThrow(() -> new SquadException(ErrorCode.SQUAD_NOT_FOUND));
    requireMembership(squadId, userId);

    List<SquadMember> members = squadMemberRepository.findAllBySquadId(squadId);
    SquadResponse response = SquadMapper.toResponse(squad, members.size());
    return new SquadDetailResponse(response, SquadMapper.toMemberSummaries(members));
  }

  @Transactional
  public void leave(UUID userId, UUID squadId) {
    Squad squad = squadRepository.findById(squadId)
        .orElseThrow(() -> new SquadException(ErrorCode.SQUAD_NOT_FOUND));
    if (!squadMemberRepository.existsBySquadIdAndUserId(squadId, userId)) {
      throw new SquadException(ErrorCode.SQUAD_ACCESS_DENIED);
    }

    long count = squadMemberRepository.countBySquadId(squadId);
    squadMemberRepository.deleteBySquadIdAndUserId(squadId, userId);

    if (count <= 1) {
      // Last member leaving → tear down the squad
      squadRepository.deleteById(squadId);
      log.info("Squad {} dissolved by last member {}", squadId, userId);
      return;
    }

    if (squad.getOwnerUserId().equals(userId)) {
      // Promote earliest joiner to owner
      List<SquadMember> remaining = squadMemberRepository.findAllBySquadId(squadId);
      remaining.stream()
          .min(Comparator.comparing(SquadMember::getJoinedAt,
              Comparator.nullsLast(Comparator.naturalOrder())))
          .ifPresent(m -> {
            squad.setOwnerUserId(m.getUserId());
            m.setRole("owner");
            squadMemberRepository.save(m);
            squadRepository.save(squad);
            log.info("Squad {} ownership transferred to {}", squadId, m.getUserId());
          });
    }
  }

  @Transactional
  public void removeMember(UUID actorUserId, UUID squadId, UUID targetUserId) {
    Squad squad = squadRepository.findById(squadId)
        .orElseThrow(() -> new SquadException(ErrorCode.SQUAD_NOT_FOUND));
    if (!squad.getOwnerUserId().equals(actorUserId)) {
      throw new SquadException(ErrorCode.SQUAD_ACCESS_DENIED, "Only the squad owner can remove members");
    }
    if (actorUserId.equals(targetUserId)) {
      // Owner removing themself → use leave() instead so ownership is transferred safely
      leave(actorUserId, squadId);
      return;
    }
    if (!squadMemberRepository.existsBySquadIdAndUserId(squadId, targetUserId)) {
      throw new SquadException(ErrorCode.SQUAD_NOT_FOUND, "User is not a member of this squad");
    }
    squadMemberRepository.deleteBySquadIdAndUserId(squadId, targetUserId);
    log.info("User {} removed from squad {} by owner {}", targetUserId, squadId, actorUserId);
  }

  // ===================================================================== Membership helpers

  /**
   * Returns the set of squad ids a user is a member of. Used by Kudos validation
   * to confirm two users share at least one squad.
   */
  @Transactional(readOnly = true)
  public List<UUID> squadIdsForUser(UUID userId) {
    return squadMemberRepository.findAllByUserId(userId).stream()
        .map(SquadMember::getSquadId)
        .toList();
  }

  /**
   * Returns true if {@code userA} and {@code userB} share at least one squad.
   */
  @Transactional(readOnly = true)
  public boolean shareSquad(UUID userA, UUID userB) {
    if (userA.equals(userB)) return true;
    List<UUID> a = squadIdsForUser(userA);
    if (a.isEmpty()) return false;
    List<UUID> b = squadIdsForUser(userB);
    for (UUID id : a) if (b.contains(id)) return true;
    return false;
  }

  // ===================================================================== Streak

  /**
   * Evaluate the squad's shared streak for a given day. Idempotent: re-running
   * for the same day after lastActiveDay has been advanced is a no-op.
   *
   * <p>Rule: if {@code ≥1 member} logged a meal on {@code evaluationDay} (squad
   * timezone), increment {@code currentStreak} by 1 and update {@code lastActiveDay};
   * otherwise reset {@code currentStreak} to 0 and preserve {@code longestStreak}.
   */
  @Transactional
  public void evaluateStreakForDay(UUID squadId, LocalDate evaluationDay) {
    Squad squad = squadRepository.findByIdForUpdate(squadId)
        .orElseThrow(() -> new SquadException(ErrorCode.SQUAD_NOT_FOUND));

    // Idempotency guard
    if (squad.getLastActiveDay() != null && !evaluationDay.isAfter(squad.getLastActiveDay())) {
      log.debug("Squad {} already evaluated through {}", squadId, squad.getLastActiveDay());
      return;
    }

    ZoneId zone = ZoneId.of(squad.getTimezone() == null ? "UTC" : squad.getTimezone());
    OffsetDateTime dayStart = evaluationDay.atStartOfDay(zone).toOffsetDateTime();
    OffsetDateTime dayEnd = evaluationDay.plusDays(1).atStartOfDay(zone).toOffsetDateTime();

    boolean anyLogged = squadMemberRepository.findAllBySquadId(squadId).stream()
        .anyMatch(m -> mealLogRepository.existsLogInRange(m.getUserId(), dayStart, dayEnd));

    int oldStreak = squad.getCurrentStreak() == null ? 0 : squad.getCurrentStreak();
    int newStreak = anyLogged ? oldStreak + 1 : 0;
    int longest = Math.max(squad.getLongestStreak() == null ? 0 : squad.getLongestStreak(), newStreak);

    squad.setCurrentStreak(newStreak);
    squad.setLongestStreak(longest);
    squad.setLastActiveDay(evaluationDay);
    squadRepository.save(squad);

    log.info("Squad {} streak evaluation: day={} anyLogged={} streak {}→{} longest={}",
        squadId, evaluationDay, anyLogged, oldStreak, newStreak, longest);
  }

  // ===================================================================== Leaderboard

  /**
   * 7-day leaderboard ordered by meals logged desc. Members with fewer than
   * {@link #LEADERBOARD_MIN_ACTIVE_DAYS} distinct logged days appear last and
   * are flagged {@code warmingUp = true}.
   */
  @Transactional(readOnly = true)
  public List<LeaderboardEntry> leaderboard(UUID actorUserId, UUID squadId) {
    requireMembership(squadId, actorUserId);

    OffsetDateTime since = OffsetDateTime.now(ZoneOffset.UTC).minusDays(LEADERBOARD_WINDOW_DAYS);
    List<SquadMember> members = squadMemberRepository.findAllBySquadId(squadId);

    record Row(UUID userId, long meals, long days) {}
    List<Row> rows = new ArrayList<>(members.size());
    for (SquadMember m : members) {
      long meals = mealLogRepository.countByUserIdAndConsumedAtAfter(m.getUserId(), since);
      long days  = mealLogRepository.countDistinctDaysByUserSince(m.getUserId(), since);
      rows.add(new Row(m.getUserId(), meals, days));
    }

    // Sort: warming-up users go last; within each group, more meals = higher rank.
    rows.sort((a, b) -> {
      boolean aw = a.days() < LEADERBOARD_MIN_ACTIVE_DAYS;
      boolean bw = b.days() < LEADERBOARD_MIN_ACTIVE_DAYS;
      if (aw != bw) return aw ? 1 : -1;
      return Long.compare(b.meals(), a.meals());
    });

    List<LeaderboardEntry> out = new ArrayList<>(rows.size());
    int rank = 1;
    for (Row r : rows) {
      boolean warming = r.days() < LEADERBOARD_MIN_ACTIVE_DAYS;
      out.add(new LeaderboardEntry(r.userId(), warming ? 0 : rank, r.meals(), r.days(), warming));
      if (!warming) rank++;
    }
    return Collections.unmodifiableList(out);
  }

  // ===================================================================== Internal

  private void enforceSquadCap(UUID userId) {
    if (squadMemberRepository.countByUserId(userId) >= MAX_SQUADS_PER_USER) {
      throw new SquadException(ErrorCode.SQUAD_LIMIT_REACHED);
    }
  }

  private void requireMembership(UUID squadId, UUID userId) {
    if (!squadMemberRepository.existsBySquadIdAndUserId(squadId, userId)) {
      throw new SquadException(ErrorCode.SQUAD_ACCESS_DENIED);
    }
  }

  private static String normalizeTimezone(String tz) {
    if (tz == null || tz.isBlank()) return "UTC";
    try {
      return ZoneId.of(tz.trim()).getId();
    } catch (Exception e) {
      return "UTC";
    }
  }
}
