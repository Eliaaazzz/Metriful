package com.fitnessapp.backend.squad.entity;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
public class MealLogKudosId implements Serializable {
  private Long mealLogId;
  private UUID userId;

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof MealLogKudosId that)) return false;
    return Objects.equals(mealLogId, that.mealLogId) && Objects.equals(userId, that.userId);
  }

  @Override
  public int hashCode() {
    return Objects.hash(mealLogId, userId);
  }
}
