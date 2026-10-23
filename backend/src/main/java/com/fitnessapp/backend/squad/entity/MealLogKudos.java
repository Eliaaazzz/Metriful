package com.fitnessapp.backend.squad.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "meal_log_kudos")
@IdClass(MealLogKudosId.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MealLogKudos {

  @Id
  @Column(name = "meal_log_id", nullable = false)
  private Long mealLogId;

  @Id
  @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
  private UUID userId;

  @Column(name = "created_at", insertable = false, updatable = false)
  private OffsetDateTime createdAt;
}
