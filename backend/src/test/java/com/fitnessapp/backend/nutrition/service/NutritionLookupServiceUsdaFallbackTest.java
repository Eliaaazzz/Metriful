package com.fitnessapp.backend.nutrition.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fitnessapp.backend.nutrition.dto.NutritionInfo;
import com.fitnessapp.backend.nutrition.entity.FoodNutrition;
import com.fitnessapp.backend.nutrition.repository.FoodNutritionRepository;
import com.fitnessapp.backend.nutrition.service.core.FoodKeyNormalizer;
import com.fitnessapp.backend.nutrition.service.core.NutritionLookupService;
import com.fitnessapp.backend.nutrition.service.usda.UsdaFoodDataClient;
import com.fitnessapp.backend.nutrition.service.usda.UsdaNutritionCache;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NutritionLookupServiceUsdaFallbackTest {

    @Mock
    private FoodNutritionRepository foodNutritionRepository;

    @Mock
    private FoodKeyNormalizer foodKeyNormalizer;

    @Mock
    private UsdaFoodDataClient usdaClient;

    private NutritionLookupService nutritionLookupService;

    @BeforeEach
    void setUp() {
        UsdaNutritionCache usdaCache = new UsdaNutritionCache(
                null,
                2_000,
                Duration.ofHours(12),
                Duration.ofDays(7));
        nutritionLookupService = new NutritionLookupService(
                foodNutritionRepository,
                foodKeyNormalizer,
                usdaClient,
                usdaCache);
    }

    @Test
    void localMissReturnsUsdaFallback() {
        NutritionInfo usdaNutrition = NutritionInfo.builder()
                .calories(new BigDecimal("60"))
                .protein(new BigDecimal("1"))
                .fat(new BigDecimal("0.4"))
                .carbs(new BigDecimal("14"))
                .fiber(new BigDecimal("3"))
                .sugar(new BigDecimal("8"))
                .build();

        when(foodKeyNormalizer.normalize("dragon fruit")).thenReturn("dragon_fruit");
        when(foodNutritionRepository.findByFoodKeyAndIsActiveTrue("dragon_fruit")).thenReturn(Optional.empty());
        when(foodNutritionRepository.findByFoodKeySimilar("dragon_fruit", 1)).thenReturn(List.of());
        when(foodNutritionRepository.findByDisplayNameSimilar("dragon_fruit", 1)).thenReturn(List.of());
        when(foodNutritionRepository.searchByKeyword("dragon_fruit")).thenReturn(List.of());
        when(usdaClient.isAvailable()).thenReturn(true);
        when(usdaClient.search("dragon_fruit")).thenReturn(Optional.of(usdaNutrition));

        NutritionInfo result = nutritionLookupService.lookupNutrition("dragon fruit");

        assertThat(result).isSameAs(usdaNutrition);
        verify(usdaClient).search("dragon_fruit");
    }

    @Test
    void localHitDoesNotInvokeUsdaClient() {
        when(foodKeyNormalizer.normalize("chicken")).thenReturn("chicken");
        when(foodNutritionRepository.findByFoodKeyAndIsActiveTrue("chicken"))
                .thenReturn(Optional.of(food("chicken", 165, 31, 3.6, 0)));

        NutritionInfo result = nutritionLookupService.lookupNutrition("chicken");

        assertThat(result.getCalories()).isEqualByComparingTo(new BigDecimal("165"));
        verify(usdaClient, never()).isAvailable();
        verify(usdaClient, never()).search(anyString());
    }

    private FoodNutrition food(String key, double calories, double protein, double fat, double carbs) {
        return FoodNutrition.builder()
                .foodKey(key)
                .displayName(key)
                .calories(BigDecimal.valueOf(calories))
                .protein(BigDecimal.valueOf(protein))
                .fat(BigDecimal.valueOf(fat))
                .carbs(BigDecimal.valueOf(carbs))
                .isActive(true)
                .build();
    }
}
