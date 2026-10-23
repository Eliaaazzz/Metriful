package com.fitnessapp.backend.coach;

import java.math.BigDecimal;

public interface CoachNutritionTotals {
  Long getMealCount();
  Long getCalories();
  BigDecimal getProtein();
  BigDecimal getCarbs();
  BigDecimal getFat();
}
