package com.fitnessapp.backend.behavior.dto;

import java.util.List;

public record ScoreSplit(
    List<Integer> onYesDays,
    List<Integer> onNoDays
) {}
