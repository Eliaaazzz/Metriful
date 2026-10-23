package com.fitnessapp.backend.squad.entity;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
public class SquadMemberId implements Serializable {
  private UUID squadId;
  private UUID userId;

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof SquadMemberId that)) return false;
    return Objects.equals(squadId, that.squadId) && Objects.equals(userId, that.userId);
  }

  @Override
  public int hashCode() {
    return Objects.hash(squadId, userId);
  }
}
