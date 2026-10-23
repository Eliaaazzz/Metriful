package com.fitnessapp.backend.coach;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import com.fitnessapp.backend.security.AuthenticatedUser;
import com.fitnessapp.backend.api.common.ApiEnvelope;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/coach/runs")
@RequiredArgsConstructor
public class CoachController {
  private final CoachGateway gateway;

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<ApiEnvelope<Void>> failure(ResponseStatusException exception) {
    return ResponseEntity.status(exception.getStatusCode()).body(ApiEnvelope.<Void>builder()
        .success(false).code(exception.getStatusCode().value()).message(exception.getReason())
        .timestamp(System.currentTimeMillis()).build());
  }

  @PostMapping
  public CoachGateway.Response run(@AuthenticationPrincipal AuthenticatedUser user,
                                  @Valid @RequestBody CoachRequest request) {
    if (user == null || user.userId() == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to use Coach");
    }
    return gateway.run(user.userId(), request);
  }
}
