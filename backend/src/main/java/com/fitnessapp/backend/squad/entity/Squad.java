package com.fitnessapp.backend.squad.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "squads")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Squad {

  @Id
  @Column(columnDefinition = "uuid")
  @GeneratedValue
  private UUID id;

  @Column(nullable = false, length = 30)
  private String name;

  @Column(nullable = false, length = 8)
  private String emoji;

  @Column(name = "invite_code", nullable = false, unique = true, length = 6)
  private String inviteCode;

  @Column(name = "owner_user_id", nullable = false, columnDefinition = "uuid")
  private UUID ownerUserId;

  @Column(name = "current_streak", nullable = false)
  @Builder.Default
  private Integer currentStreak = 0;

  @Column(name = "longest_streak", nullable = false)
  @Builder.Default
  private Integer longestStreak = 0;

  @Column(name = "last_active_day")
  private LocalDate lastActiveDay;

  @Column(nullable = false, length = 64)
  @Builder.Default
  private String timezone = "UTC";

  @Column(name = "created_at", insertable = false, updatable = false)
  private OffsetDateTime createdAt;
}
