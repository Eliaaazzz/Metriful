package com.fitnessapp.backend.squad.repository;

import com.fitnessapp.backend.squad.entity.MealLogKudos;
import com.fitnessapp.backend.squad.entity.MealLogKudosId;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MealLogKudosRepository extends JpaRepository<MealLogKudos, MealLogKudosId> {

  long countByMealLogId(Long mealLogId);

  boolean existsByMealLogIdAndUserId(Long mealLogId, UUID userId);

  void deleteByMealLogIdAndUserId(Long mealLogId, UUID userId);
}
