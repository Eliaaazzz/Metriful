package com.fitnessapp.backend.behavior.dto;

import java.time.LocalDate;

public record BehaviorDayPoint(
    LocalDate day,
    boolean observed,
    Short dailyScore
) {}
