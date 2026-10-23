package com.fitnessapp.backend.squad.controller;

import com.fitnessapp.backend.security.CurrentUser;
import com.fitnessapp.backend.squad.dto.CreateSquadRequest;
import com.fitnessapp.backend.squad.dto.JoinSquadRequest;
import com.fitnessapp.backend.squad.dto.LeaderboardEntry;
import com.fitnessapp.backend.squad.dto.SquadDetailResponse;
import com.fitnessapp.backend.squad.dto.SquadResponse;
import com.fitnessapp.backend.squad.service.SquadService;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/squads")
@Validated
@RequiredArgsConstructor
public class SquadController {

  private final CurrentUser currentUser;
  private final SquadService squadService;

  @PostMapping
  public ResponseEntity<SquadResponse> create(@Valid @RequestBody CreateSquadRequest request) {
    UUID userId = currentUser.requireUserId();
    SquadResponse response = squadService.create(userId, request.name(), request.emoji(), request.timezone());
    return ResponseEntity.ok(response);
  }

  @PostMapping("/join")
  public ResponseEntity<SquadResponse> join(@Valid @RequestBody JoinSquadRequest request) {
    UUID userId = currentUser.requireUserId();
    SquadResponse response = squadService.joinByCode(userId, request.inviteCode());
    return ResponseEntity.ok(response);
  }

  @GetMapping
  public ResponseEntity<List<SquadResponse>> list() {
    UUID userId = currentUser.requireUserId();
    return ResponseEntity.ok(squadService.listForUser(userId));
  }

  @GetMapping("/{squadId}")
  public ResponseEntity<SquadDetailResponse> detail(@PathVariable UUID squadId) {
    UUID userId = currentUser.requireUserId();
    return ResponseEntity.ok(squadService.getDetail(userId, squadId));
  }

  @PostMapping("/{squadId}/leave")
  public ResponseEntity<Void> leave(@PathVariable UUID squadId) {
    UUID userId = currentUser.requireUserId();
    squadService.leave(userId, squadId);
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/{squadId}/members/{targetUserId}")
  public ResponseEntity<Void> removeMember(@PathVariable UUID squadId, @PathVariable UUID targetUserId) {
    UUID userId = currentUser.requireUserId();
    squadService.removeMember(userId, squadId, targetUserId);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/{squadId}/leaderboard")
  public ResponseEntity<List<LeaderboardEntry>> leaderboard(@PathVariable UUID squadId) {
    UUID userId = currentUser.requireUserId();
    return ResponseEntity.ok(squadService.leaderboard(userId, squadId));
  }
}
