package com.fitnessapp.backend.squad.dto;

public record KudosResponse(
    long mealLogId,
    long kudosCount,
    boolean kudoed
) {}
