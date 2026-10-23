package com.fitnessapp.backend.squad.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fitnessapp.backend.api.common.ErrorCode;
import com.fitnessapp.backend.nutrition.repository.MealLogRepository;
import com.fitnessapp.backend.squad.SquadException;
import com.fitnessapp.backend.squad.dto.LeaderboardEntry;
import com.fitnessapp.backend.squad.dto.SquadResponse;
import com.fitnessapp.backend.squad.entity.Squad;
import com.fitnessapp.backend.squad.entity.SquadMember;
import com.fitnessapp.backend.squad.repository.SquadMemberRepository;
import com.fitnessapp.backend.squad.repository.SquadRepository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SquadServiceTest {

  @Mock private SquadRepository squadRepository;
  @Mock private SquadMemberRepository squadMemberRepository;
  @Mock private MealLogRepository mealLogRepository;
  @Mock private InviteCodeGenerator inviteCodeGenerator;

  private SquadService service;

  private final UUID userA = UUID.randomUUID();
  private final UUID userB = UUID.randomUUID();
  private final UUID squadId = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    service = new SquadService(squadRepository, squadMemberRepository, mealLogRepository, inviteCodeGenerator);
  }

  // ===================================================================== create

  @Test
  void create_persistsSquadAndOwnerMembership() {
    when(squadMemberRepository.countByUserId(userA)).thenReturn(0L);
    when(inviteCodeGenerator.generateUnique()).thenReturn("ABCD23");
    when(squadRepository.save(any(Squad.class))).thenAnswer(inv -> {
      Squad s = inv.getArgument(0);
      s.setId(squadId);
      return s;
    });

    SquadResponse response = service.create(userA, "Sunrise Eaters", "🌅", "America/New_York");

    assertThat(response.id()).isEqualTo(squadId);
    assertThat(response.inviteCode()).isEqualTo("ABCD23");
    assertThat(response.ownerUserId()).isEqualTo(userA);
    assertThat(response.memberCount()).isEqualTo(1);
    assertThat(response.timezone()).isEqualTo("America/New_York");

    ArgumentCaptor<SquadMember> memberCaptor = ArgumentCaptor.forClass(SquadMember.class);
    verify(squadMemberRepository).save(memberCaptor.capture());
    assertThat(memberCaptor.getValue().getUserId()).isEqualTo(userA);
    assertThat(memberCaptor.getValue().getRole()).isEqualTo("owner");
  }

  @Test
  void create_invalidTimezone_fallsBackToUTC() {
    when(squadMemberRepository.countByUserId(userA)).thenReturn(0L);
    when(inviteCodeGenerator.generateUnique()).thenReturn("XYZW34");
    when(squadRepository.save(any(Squad.class))).thenAnswer(inv -> inv.getArgument(0));

    SquadResponse response = service.create(userA, "Test", "🔥", "Not/A/Zone");

    assertThat(response.timezone()).isEqualTo("UTC");
  }

  @Test
  void create_rejectsWhenUserAlreadyInThreeSquads() {
    when(squadMemberRepository.countByUserId(userA)).thenReturn(3L);

    assertThatThrownBy(() -> service.create(userA, "X", "🔥", null))
        .isInstanceOf(SquadException.class)
        .extracting(e -> ((SquadException) e).getErrorCode())
        .isEqualTo(ErrorCode.SQUAD_LIMIT_REACHED);

    verify(squadRepository, never()).save(any());
  }

  // ===================================================================== join

  @Test
  void joinByCode_addsMemberWhenSquadHasRoom() {
    Squad squad = squadFixture();
    when(squadRepository.findByInviteCode("ABCD23")).thenReturn(Optional.of(squad));
    when(squadMemberRepository.existsBySquadIdAndUserId(squadId, userB)).thenReturn(false);
    when(squadMemberRepository.countByUserId(userB)).thenReturn(0L);
    when(squadMemberRepository.countBySquadId(squadId)).thenReturn(2L);

    SquadResponse response = service.joinByCode(userB, "ABCD23");

    assertThat(response.id()).isEqualTo(squadId);
    assertThat(response.memberCount()).isEqualTo(3);
    verify(squadMemberRepository).save(any(SquadMember.class));
  }

  @Test
  void joinByCode_rejectsWhenSquadFull() {
    Squad squad = squadFixture();
    when(squadRepository.findByInviteCode("ABCD23")).thenReturn(Optional.of(squad));
    when(squadMemberRepository.existsBySquadIdAndUserId(squadId, userB)).thenReturn(false);
    when(squadMemberRepository.countByUserId(userB)).thenReturn(0L);
    when(squadMemberRepository.countBySquadId(squadId)).thenReturn(10L);

    assertThatThrownBy(() -> service.joinByCode(userB, "ABCD23"))
        .isInstanceOf(SquadException.class)
        .extracting(e -> ((SquadException) e).getErrorCode())
        .isEqualTo(ErrorCode.SQUAD_FULL);

    verify(squadMemberRepository, never()).save(any());
  }

  @Test
  void joinByCode_rejectsWhenAlreadyMember() {
    Squad squad = squadFixture();
    when(squadRepository.findByInviteCode("ABCD23")).thenReturn(Optional.of(squad));
    when(squadMemberRepository.existsBySquadIdAndUserId(squadId, userB)).thenReturn(true);

    assertThatThrownBy(() -> service.joinByCode(userB, "ABCD23"))
        .isInstanceOf(SquadException.class)
        .extracting(e -> ((SquadException) e).getErrorCode())
        .isEqualTo(ErrorCode.SQUAD_ALREADY_MEMBER);
  }

  @Test
  void joinByCode_rejectsWhenInviteCodeUnknown() {
    when(squadRepository.findByInviteCode(any())).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.joinByCode(userB, "NOPE99"))
        .isInstanceOf(SquadException.class)
        .extracting(e -> ((SquadException) e).getErrorCode())
        .isEqualTo(ErrorCode.SQUAD_INVITE_CODE_INVALID);
  }

  // ===================================================================== leave

  @Test
  void leave_lastMember_dissolvesSquad() {
    Squad squad = squadFixture();
    when(squadRepository.findById(squadId)).thenReturn(Optional.of(squad));
    when(squadMemberRepository.existsBySquadIdAndUserId(squadId, userA)).thenReturn(true);
    when(squadMemberRepository.countBySquadId(squadId)).thenReturn(1L);

    service.leave(userA, squadId);

    verify(squadMemberRepository).deleteBySquadIdAndUserId(squadId, userA);
    verify(squadRepository).deleteById(squadId);
  }

  @Test
  void leave_nonMember_rejected() {
    Squad squad = squadFixture();
    when(squadRepository.findById(squadId)).thenReturn(Optional.of(squad));
    when(squadMemberRepository.existsBySquadIdAndUserId(squadId, userB)).thenReturn(false);

    assertThatThrownBy(() -> service.leave(userB, squadId))
        .isInstanceOf(SquadException.class)
        .extracting(e -> ((SquadException) e).getErrorCode())
        .isEqualTo(ErrorCode.SQUAD_ACCESS_DENIED);
  }

  @Test
  void leave_ownerWithRemainingMembers_transfersOwnershipToEarliestJoiner() {
    Squad squad = squadFixture();           // ownerUserId = userA
    UUID userC = UUID.randomUUID();
    when(squadRepository.findById(squadId)).thenReturn(Optional.of(squad));
    when(squadMemberRepository.existsBySquadIdAndUserId(squadId, userA)).thenReturn(true);
    when(squadMemberRepository.countBySquadId(squadId)).thenReturn(3L);

    // userC joined before userB → userC should be promoted, not userB
    SquadMember laterJoiner = SquadMember.builder()
        .squadId(squadId).userId(userB).role("member")
        .joinedAt(OffsetDateTime.parse("2026-04-02T10:00:00Z"))
        .build();
    SquadMember earliestJoiner = SquadMember.builder()
        .squadId(squadId).userId(userC).role("member")
        .joinedAt(OffsetDateTime.parse("2026-04-01T10:00:00Z"))
        .build();
    when(squadMemberRepository.findAllBySquadId(squadId))
        .thenReturn(List.of(laterJoiner, earliestJoiner));

    service.leave(userA, squadId);

    verify(squadMemberRepository).deleteBySquadIdAndUserId(squadId, userA);
    verify(squadRepository, never()).deleteById(any());
    assertThat(squad.getOwnerUserId()).isEqualTo(userC);
    assertThat(earliestJoiner.getRole()).isEqualTo("owner");
    assertThat(laterJoiner.getRole()).isEqualTo("member");
    verify(squadMemberRepository).save(earliestJoiner);
    verify(squadRepository).save(squad);
  }

  @Test
  void leave_nonOwnerWithRemainingMembers_doesNotTransferOwnership() {
    Squad squad = squadFixture();           // ownerUserId = userA
    when(squadRepository.findById(squadId)).thenReturn(Optional.of(squad));
    when(squadMemberRepository.existsBySquadIdAndUserId(squadId, userB)).thenReturn(true);
    when(squadMemberRepository.countBySquadId(squadId)).thenReturn(2L);

    service.leave(userB, squadId);

    verify(squadMemberRepository).deleteBySquadIdAndUserId(squadId, userB);
    verify(squadRepository, never()).deleteById(any());
    verify(squadRepository, never()).save(any());
    assertThat(squad.getOwnerUserId()).isEqualTo(userA);
  }

  // ===================================================================== streak

  @Test
  void evaluateStreakForDay_incrementsWhenAtLeastOneMemberLogged() {
    Squad squad = squadFixture();
    squad.setCurrentStreak(2);
    squad.setLongestStreak(2);
    when(squadRepository.findByIdForUpdate(squadId)).thenReturn(Optional.of(squad));

    SquadMember m1 = SquadMember.builder().squadId(squadId).userId(userA).build();
    SquadMember m2 = SquadMember.builder().squadId(squadId).userId(userB).build();
    when(squadMemberRepository.findAllBySquadId(squadId)).thenReturn(List.of(m1, m2));
    // userA logged, userB did not
    when(mealLogRepository.existsLogInRange(eq(userA), any(), any())).thenReturn(true);
    lenient().when(mealLogRepository.existsLogInRange(eq(userB), any(), any())).thenReturn(false);

    service.evaluateStreakForDay(squadId, LocalDate.of(2026, 5, 5));

    assertThat(squad.getCurrentStreak()).isEqualTo(3);
    assertThat(squad.getLongestStreak()).isEqualTo(3);
    assertThat(squad.getLastActiveDay()).isEqualTo(LocalDate.of(2026, 5, 5));
    verify(squadRepository).save(squad);
  }

  @Test
  void evaluateStreakForDay_resetsWhenNoMemberLogged_butKeepsLongest() {
    Squad squad = squadFixture();
    squad.setCurrentStreak(7);
    squad.setLongestStreak(7);
    when(squadRepository.findByIdForUpdate(squadId)).thenReturn(Optional.of(squad));
    when(squadMemberRepository.findAllBySquadId(squadId)).thenReturn(
        List.of(SquadMember.builder().squadId(squadId).userId(userA).build()));
    when(mealLogRepository.existsLogInRange(eq(userA), any(), any())).thenReturn(false);

    service.evaluateStreakForDay(squadId, LocalDate.of(2026, 5, 5));

    assertThat(squad.getCurrentStreak()).isZero();
    assertThat(squad.getLongestStreak()).isEqualTo(7); // preserved
  }

  @Test
  void evaluateStreakForDay_idempotent_skipsWhenAlreadyEvaluated() {
    Squad squad = squadFixture();
    squad.setLastActiveDay(LocalDate.of(2026, 5, 5));
    when(squadRepository.findByIdForUpdate(squadId)).thenReturn(Optional.of(squad));

    service.evaluateStreakForDay(squadId, LocalDate.of(2026, 5, 5));

    verify(squadRepository, never()).save(any());
    verify(mealLogRepository, never()).existsLogInRange(any(), any(), any());
  }

  // ===================================================================== leaderboard

  @Test
  void leaderboard_warmingUpUsersTrailRanked_andCarryFlag() {
    when(squadMemberRepository.existsBySquadIdAndUserId(squadId, userA)).thenReturn(true);
    SquadMember m1 = SquadMember.builder().squadId(squadId).userId(userA).build();
    SquadMember m2 = SquadMember.builder().squadId(squadId).userId(userB).build();
    when(squadMemberRepository.findAllBySquadId(squadId)).thenReturn(List.of(m1, m2));

    // userA: 12 meals across 5 days → ranked
    when(mealLogRepository.countByUserIdAndConsumedAtAfter(eq(userA), any())).thenReturn(12L);
    when(mealLogRepository.countDistinctDaysByUserSince(eq(userA), any())).thenReturn(5L);
    // userB: 2 meals across 2 days → warming up (below MIN_ACTIVE_DAYS=3)
    when(mealLogRepository.countByUserIdAndConsumedAtAfter(eq(userB), any())).thenReturn(2L);
    when(mealLogRepository.countDistinctDaysByUserSince(eq(userB), any())).thenReturn(2L);

    List<LeaderboardEntry> board = service.leaderboard(userA, squadId);

    assertThat(board).hasSize(2);
    LeaderboardEntry first = board.get(0);
    LeaderboardEntry second = board.get(1);
    assertThat(first.userId()).isEqualTo(userA);
    assertThat(first.warmingUp()).isFalse();
    assertThat(first.rank()).isEqualTo(1);
    assertThat(second.userId()).isEqualTo(userB);
    assertThat(second.warmingUp()).isTrue();
    assertThat(second.rank()).isEqualTo(0); // warming-up users are unranked
  }

  @Test
  void leaderboard_rejectsNonMember() {
    when(squadMemberRepository.existsBySquadIdAndUserId(squadId, userB)).thenReturn(false);

    assertThatThrownBy(() -> service.leaderboard(userB, squadId))
        .isInstanceOf(SquadException.class)
        .extracting(e -> ((SquadException) e).getErrorCode())
        .isEqualTo(ErrorCode.SQUAD_ACCESS_DENIED);
  }

  // ===================================================================== shareSquad

  @Test
  void shareSquad_returnsTrueWhenOverlap() {
    SquadMember a1 = SquadMember.builder().squadId(squadId).userId(userA).build();
    SquadMember b1 = SquadMember.builder().squadId(squadId).userId(userB).build();
    when(squadMemberRepository.findAllByUserId(userA)).thenReturn(List.of(a1));
    when(squadMemberRepository.findAllByUserId(userB)).thenReturn(List.of(b1));

    assertThat(service.shareSquad(userA, userB)).isTrue();
  }

  @Test
  void shareSquad_returnsFalseWhenDisjoint() {
    SquadMember a1 = SquadMember.builder().squadId(UUID.randomUUID()).userId(userA).build();
    SquadMember b1 = SquadMember.builder().squadId(UUID.randomUUID()).userId(userB).build();
    when(squadMemberRepository.findAllByUserId(userA)).thenReturn(List.of(a1));
    when(squadMemberRepository.findAllByUserId(userB)).thenReturn(List.of(b1));

    assertThat(service.shareSquad(userA, userB)).isFalse();
  }

  // ===================================================================== fixtures

  private Squad squadFixture() {
    return Squad.builder()
        .id(squadId)
        .name("Sunrise Eaters")
        .emoji("🌅")
        .inviteCode("ABCD23")
        .ownerUserId(userA)
        .currentStreak(0)
        .longestStreak(0)
        .timezone("UTC")
        .build();
  }
}
