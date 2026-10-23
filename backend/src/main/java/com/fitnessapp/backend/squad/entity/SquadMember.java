package com.fitnessapp.backend.squad.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "squad_members")
@IdClass(SquadMemberId.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SquadMember {

  @Id
  @Column(name = "squad_id", nullable = false, columnDefinition = "uuid")
  private UUID squadId;

  @Id
  @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
  private UUID userId;

  @Column(nullable = false, length = 16)
  @Builder.Default
  private String role = "member";

  @Column(name = "joined_at", insertable = false, updatable = false)
  private OffsetDateTime joinedAt;
}
