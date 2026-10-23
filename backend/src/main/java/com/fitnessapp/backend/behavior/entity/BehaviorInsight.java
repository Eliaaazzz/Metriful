package com.fitnessapp.backend.behavior.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "behavior_insights")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BehaviorInsight {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
  private UUID userId;

  @Column(name = "behavior_key", nullable = false, length = 64)
  private String behaviorKey;

  @Column(name = "delta_score", nullable = false, precision = 6, scale = 2)
  private BigDecimal deltaScore;

  @Column(name = "cohens_d", nullable = false, precision = 6, scale = 3)
  private BigDecimal cohensD;

  @Column(name = "p_value", nullable = false, precision = 7, scale = 4)
  private BigDecimal pValue;

  @Column(name = "sample_yes", nullable = false)
  private Integer sampleYes;

  @Column(name = "sample_no", nullable = false)
  private Integer sampleNo;

  @Column(nullable = false, length = 8)
  private String confidence; // 'high' | 'med' | 'low'

  @Column(name = "computed_at", nullable = false)
  private OffsetDateTime computedAt;

  @Column(nullable = false)
  @Builder.Default
  private boolean pinned = false;

  @Column(name = "dismissed_until")
  private LocalDate dismissedUntil;
}
