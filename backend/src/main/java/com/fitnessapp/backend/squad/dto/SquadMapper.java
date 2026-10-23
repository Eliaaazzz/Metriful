package com.fitnessapp.backend.squad.dto;

import com.fitnessapp.backend.squad.entity.Squad;
import com.fitnessapp.backend.squad.entity.SquadMember;
import java.util.List;

public final class SquadMapper {

  private SquadMapper() {}

  public static SquadResponse toResponse(Squad s, long memberCount) {
    return new SquadResponse(
        s.getId(),
        s.getName(),
        s.getEmoji(),
        s.getInviteCode(),
        s.getOwnerUserId(),
        (int) memberCount,
        s.getCurrentStreak() == null ? 0 : s.getCurrentStreak(),
        s.getLongestStreak() == null ? 0 : s.getLongestStreak(),
        s.getLastActiveDay(),
        s.getTimezone(),
        s.getCreatedAt()
    );
  }

  public static SquadMemberSummary toMemberSummary(SquadMember m) {
    return new SquadMemberSummary(m.getUserId(), m.getRole(), m.getJoinedAt());
  }

  public static List<SquadMemberSummary> toMemberSummaries(List<SquadMember> members) {
    return members.stream().map(SquadMapper::toMemberSummary).toList();
  }
}
