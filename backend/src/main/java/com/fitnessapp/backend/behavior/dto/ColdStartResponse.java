package com.fitnessapp.backend.behavior.dto;

public record ColdStartResponse(
    long daysLogged,
    int target,
    boolean unlocked
) {}
