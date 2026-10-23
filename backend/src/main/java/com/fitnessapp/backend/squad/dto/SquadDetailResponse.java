package com.fitnessapp.backend.squad.dto;

import java.util.List;

public record SquadDetailResponse(
    SquadResponse squad,
    List<SquadMemberSummary> members
) {}
