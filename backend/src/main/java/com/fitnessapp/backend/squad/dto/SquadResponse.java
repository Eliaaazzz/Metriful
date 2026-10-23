package com.fitnessapp.backend.squad.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record SquadResponse(
    UUID id,
    String name,
    String emoji,
    String inviteCode,
    UUID ownerUserId,
    int memberCount,
    int currentStreak,
    int longestStreak,
    LocalDate lastActiveDay,
    String timezone,
    OffsetDateTime createdAt
) {}
