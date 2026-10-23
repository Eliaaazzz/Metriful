package com.fitnessapp.backend.behavior.dto;

import com.fitnessapp.backend.behavior.entity.BehaviorInsight;
import com.fitnessapp.backend.behavior.predicate.BehaviorPredicateRegistry;

/**
 * Maps {@link BehaviorInsight} entities to API DTOs and composes the
 * user-facing sentence + AI disclaimer (per CLAUDE.md policy).
 */
public final class InsightMapper {

  /** Per CLAUDE.md: every AI-generated surface must show this. */
  public static final String AI_DISCLAIMER =
      "AI-generated — verify with a healthcare professional.";

  private InsightMapper() {}

  public static InsightResponse toResponse(BehaviorInsight insight, BehaviorPredicateRegistry registry) {
    String label = registry.find(insight.getBehaviorKey())
        .map(p -> p.label())
        .orElse(insight.getBehaviorKey());

    boolean positive = insight.getDeltaScore().signum() > 0;
    String direction = positive ? "higher" : "lower";
    double absDelta = Math.abs(insight.getDeltaScore().doubleValue());

    String sentence = String.format(
        "On days you %s, your Daily Score is %.1f points %s (n=%d).",
        label.toLowerCase(),
        absDelta,
        direction,
        insight.getSampleYes() + insight.getSampleNo()
    );

    return new InsightResponse(
        insight.getId(),
        insight.getBehaviorKey(),
        label,
        insight.getDeltaScore(),
        insight.getCohensD(),
        insight.getPValue(),
        insight.getSampleYes(),
        insight.getSampleNo(),
        insight.getConfidence(),
        positive,
        sentence,
        AI_DISCLAIMER,
        insight.getComputedAt(),
        insight.isPinned()
    );
  }
}
