package com.fitnessapp.backend.squad.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateSquadRequest(
    @NotBlank @Size(max = 30) String name,
    @NotBlank @Size(max = 8)  String emoji,
    @Size(max = 64)           String timezone
) {}
