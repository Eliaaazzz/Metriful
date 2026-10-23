package com.fitnessapp.backend.nutrition.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Result from AI food recognition
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class FoodRecognitionResult {
  @JsonProperty("scene_type")
  private String sceneType;
  private List<RecognizedFood> items;
}
