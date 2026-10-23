package com.fitnessapp.backend.squad.controller;

import com.fitnessapp.backend.security.CurrentUser;
import com.fitnessapp.backend.squad.dto.KudosResponse;
import com.fitnessapp.backend.squad.service.KudosService;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/meal-logs/{mealLogId}/kudos")
@RequiredArgsConstructor
public class KudosController {

  private final CurrentUser currentUser;
  private final KudosService kudosService;

  /** Toggle kudos. Body-less — server flips the existing state. */
  @PostMapping
  public ResponseEntity<KudosResponse> toggle(@PathVariable Long mealLogId) {
    UUID userId = currentUser.requireUserId();
    return ResponseEntity.ok(kudosService.toggle(userId, mealLogId));
  }
}
