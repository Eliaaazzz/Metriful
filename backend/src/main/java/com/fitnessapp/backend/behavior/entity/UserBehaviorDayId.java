package com.fitnessapp.backend.behavior.entity;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
public class UserBehaviorDayId implements Serializable {
  private UUID userId;
  private LocalDate day;
  private String behaviorKey;

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof UserBehaviorDayId that)) return false;
    return Objects.equals(userId, that.userId)
        && Objects.equals(day, that.day)
        && Objects.equals(behaviorKey, that.behaviorKey);
  }

  @Override
  public int hashCode() {
    return Objects.hash(userId, day, behaviorKey);
  }
}
