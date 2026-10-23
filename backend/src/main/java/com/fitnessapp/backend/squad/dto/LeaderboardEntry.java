package com.fitnessapp.backend.squad.dto;

import java.util.UUID;

public record LeaderboardEntry(
    UUID userId,
    int rank,
    long mealsLogged,
    long daysActive,
    boolean warmingUp
) {}
