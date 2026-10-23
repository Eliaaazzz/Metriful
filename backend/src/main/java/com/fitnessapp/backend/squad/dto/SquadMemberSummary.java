package com.fitnessapp.backend.squad.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record SquadMemberSummary(
    UUID userId,
    String role,
    OffsetDateTime joinedAt
) {}
