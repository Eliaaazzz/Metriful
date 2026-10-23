package com.fitnessapp.backend.behavior.dto;

import java.util.List;

public record InsightDetailResponse(
    InsightResponse insight,
    List<BehaviorDayPoint> calendar,
    ScoreSplit scoreSplit
) {}
