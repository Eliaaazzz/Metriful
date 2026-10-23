package com.fitnessapp.backend.behavior.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record InsightResponse(
    Long id,
    String behaviorKey,
    String label,
    BigDecimal deltaScore,
    BigDecimal cohensD,
    BigDecimal pValue,
    int sampleYes,
    int sampleNo,
    String confidence,         // 'high' | 'med' | 'low'
    boolean positive,          // delta > 0
    String sentence,           // pre-formatted, ready to render
    String disclaimer,         // "AI-generated — verify with a healthcare professional."
    OffsetDateTime computedAt,
    boolean pinned
) {}
