package com.fitnessapp.backend.api.common;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Application error codes organized by domain.
 *
 * <p>Code ranges:
 * <ul>
 *   <li>200: Success</li>
 *   <li>2xxx: User/Entity errors</li>
 *   <li>3xxx: AI/Vision service errors</li>
 *   <li>4xxx: Nutrition data errors</li>
 *   <li>5xxx: Generic/System errors</li>
 *   <li>6xxx: Recommendation errors</li>
 * </ul>
 */
@Getter
public enum ErrorCode {
    // Success
    SUCCESS(200, "Success", HttpStatus.OK),

    // Authentication errors (1xxx)
    UNAUTHORIZED(1001, "Authentication required", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(1002, "Access denied", HttpStatus.FORBIDDEN),

    // User/Entity errors (2xxx)
    USER_NOT_FOUND(2001, "User not found", HttpStatus.NOT_FOUND),
    MEAL_NOT_FOUND(2002, "Meal not found", HttpStatus.NOT_FOUND),
    PROFILE_NOT_FOUND(2003, "User profile not found", HttpStatus.NOT_FOUND),

    // Squad errors (2010-2019) — see com.fitnessapp.backend.squad
    SQUAD_NOT_FOUND(2010, "Squad not found", HttpStatus.NOT_FOUND),
    SQUAD_FULL(2011, "Squad has reached the 10-member limit", HttpStatus.CONFLICT),
    SQUAD_LIMIT_REACHED(2012, "You are already in the maximum number of squads", HttpStatus.CONFLICT),
    SQUAD_INVITE_CODE_INVALID(2013, "Invite code is invalid or expired", HttpStatus.NOT_FOUND),
    SQUAD_ACCESS_DENIED(2014, "You are not a member of this squad", HttpStatus.FORBIDDEN),
    SQUAD_ALREADY_MEMBER(2015, "You are already a member of this squad", HttpStatus.CONFLICT),
    KUDOS_FORBIDDEN(2016, "You cannot give kudos to this meal", HttpStatus.FORBIDDEN),
    KUDOS_SELF_FORBIDDEN(2017, "You cannot give kudos to your own meal", HttpStatus.BAD_REQUEST),

    // AI/Vision errors (3xxx)
    AI_SERVICE_UNAVAILABLE(3001, "AI service temporarily unavailable", HttpStatus.SERVICE_UNAVAILABLE),
    AI_RECOGNITION_FAILED(3002, "Food recognition failed", HttpStatus.BAD_REQUEST),
    AI_INVALID_IMAGE(3003, "Invalid image format", HttpStatus.BAD_REQUEST),
    AI_TIMEOUT(3004, "AI analysis timeout", HttpStatus.REQUEST_TIMEOUT),

    // Nutrition errors (4xxx)
    NUTRITION_DATA_NOT_FOUND(4001, "Nutrition data not found", HttpStatus.NOT_FOUND),
    INVALID_FOOD_DATA(4002, "Invalid food data", HttpStatus.BAD_REQUEST),

    // Generic errors (5xxx)
    INTERNAL_ERROR(5000, "Internal server error", HttpStatus.INTERNAL_SERVER_ERROR),
    VALIDATION_ERROR(5001, "Validation error", HttpStatus.BAD_REQUEST),
    INVALID_REQUEST(5002, "Invalid request", HttpStatus.BAD_REQUEST),

    // Recommendation errors (6xxx)
    RECOMMENDATION_PROFILE_MISSING(6001, "User profile is required for recommendations", HttpStatus.BAD_REQUEST),
    RECOMMENDATION_GOALS_MISSING(6002, "At least one fitness goal is required", HttpStatus.BAD_REQUEST),
    RECOMMENDATION_SERVICE_ERROR(6003, "Recommendation service temporarily unavailable", HttpStatus.SERVICE_UNAVAILABLE),
    RECOMMENDATION_EMBEDDING_FAILED(6004, "Failed to generate content embeddings", HttpStatus.INTERNAL_SERVER_ERROR),
    RECOMMENDATION_NO_RESULTS(6005, "No recommendations found matching your criteria", HttpStatus.OK);

    private final int code;
    private final String message;
    private final HttpStatus httpStatus;

    ErrorCode(int code, String message, HttpStatus httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }

    /**
     * Legacy constructor for backward compatibility.
     * Defaults to INTERNAL_SERVER_ERROR for unmapped statuses.
     */
    ErrorCode(int code, String message) {
        this(code, message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}