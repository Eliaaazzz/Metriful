package com.fitnessapp.backend.coach;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public record CoachRequest(
    @NotBlank @Size(max = 2000) String message,
    @NotNull LocalDate date,
    @NotBlank @Size(max = 80) String timeZone,
    @Size(max = 6) List<@Valid Message> history,
    boolean shareHealth,
    @Valid HealthSnapshot health) {

  public record Message(@NotBlank @Pattern(regexp = "user|assistant") String role,
                        @NotBlank @Size(max = 4000) String content) {}

  public record HealthSnapshot(
      @NotNull LocalDate date,
      @NotBlank @Size(max = 80) String timeZone,
      @NotNull OffsetDateTime capturedAt,
      @DecimalMin("0") @DecimalMax("200000") Double steps,
      @DecimalMin("0") @DecimalMax("20000") Double activeEnergyKcal,
      @DecimalMin("0") @DecimalMax("1500") Double exerciseMinutes,
      @DecimalMin("0") @DecimalMax("1500") Double sleepMinutes,
      @DecimalMin(value = "0", inclusive = false) @DecimalMax("700") Double weightKg) {}
}
