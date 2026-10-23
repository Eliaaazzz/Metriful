package com.fitnessapp.backend.squad;

import com.fitnessapp.backend.api.common.ErrorCode;
import lombok.Getter;

/**
 * Domain exception for the Squads feature. Carries an {@link ErrorCode} so
 * {@code GlobalExceptionHandler} can map it to a consistent {@code ApiEnvelope}
 * response with the correct HTTP status.
 */
@Getter
public class SquadException extends RuntimeException {

  private final ErrorCode errorCode;

  public SquadException(ErrorCode errorCode) {
    super(errorCode.getMessage());
    this.errorCode = errorCode;
  }

  public SquadException(ErrorCode errorCode, String message) {
    super(message);
    this.errorCode = errorCode;
  }
}
