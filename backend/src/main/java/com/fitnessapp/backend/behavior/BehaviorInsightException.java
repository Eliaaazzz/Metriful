package com.fitnessapp.backend.behavior;

import com.fitnessapp.backend.api.common.ErrorCode;
import lombok.Getter;

/**
 * Domain exception for Behavior Insights. Mapped to {@code ApiEnvelope} via the
 * {@code GlobalExceptionHandler}.
 */
@Getter
public class BehaviorInsightException extends RuntimeException {

  private final ErrorCode errorCode;

  public BehaviorInsightException(ErrorCode errorCode) {
    super(errorCode.getMessage());
    this.errorCode = errorCode;
  }

  public BehaviorInsightException(ErrorCode errorCode, String message) {
    super(message);
    this.errorCode = errorCode;
  }
}
