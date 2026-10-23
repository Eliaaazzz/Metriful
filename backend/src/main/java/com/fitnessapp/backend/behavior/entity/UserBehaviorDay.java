package com.fitnessapp.backend.behavior.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "user_behavior_days")
@IdClass(UserBehaviorDayId.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserBehaviorDay {

  @Id
  @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
  private UUID userId;

  @Id
  @Column(nullable = false)
  private LocalDate day;

  @Id
  @Column(name = "behavior_key", nullable = false, length = 64)
  private String behaviorKey;

  @Column(nullable = false)
  private boolean observed;

  @Column(name = "daily_score")
  private Short dailyScore;
}
