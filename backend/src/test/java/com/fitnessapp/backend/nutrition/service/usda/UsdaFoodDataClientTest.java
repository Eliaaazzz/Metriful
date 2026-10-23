package com.fitnessapp.backend.nutrition.service.usda;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fitnessapp.backend.nutrition.dto.NutritionInfo;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class UsdaFoodDataClientTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void parseNutritionInfoReadsTopFoodNutrientsPer100g() {
        String json = """
                {
                  "totalHits": 1,
                  "foods": [
                    {
                      "fdcId": 1102644,
                      "description": "Apple, raw",
                      "foodNutrients": [
                        {"nutrientId": 1008, "nutrientName": "Energy", "unitName": "KCAL", "value": 52},
                        {"nutrientId": 1003, "nutrientName": "Protein", "unitName": "G", "value": 0.26},
                        {"nutrientId": 1004, "nutrientName": "Total lipid (fat)", "unitName": "G", "value": 0.17},
                        {"nutrientId": 1005, "nutrientName": "Carbohydrate, by difference", "unitName": "G", "value": 13.81},
                        {"nutrientId": 1079, "nutrientName": "Fiber, total dietary", "unitName": "G", "value": 2.4},
                        {"nutrientId": 2000, "nutrientName": "Sugars, total including NLEA", "unitName": "G", "value": 10.39}
                      ]
                    }
                  ]
                }
                """;

        Optional<NutritionInfo> result = UsdaFoodDataClient.parseNutritionInfo(json, objectMapper);

        assertThat(result).isPresent();
        NutritionInfo nutrition = result.orElseThrow();
        assertThat(nutrition.getCalories()).isEqualByComparingTo(new BigDecimal("52"));
        assertThat(nutrition.getProtein()).isEqualByComparingTo(new BigDecimal("0.26"));
        assertThat(nutrition.getFat()).isEqualByComparingTo(new BigDecimal("0.17"));
        assertThat(nutrition.getCarbs()).isEqualByComparingTo(new BigDecimal("13.81"));
        assertThat(nutrition.getFiber()).isEqualByComparingTo(new BigDecimal("2.4"));
        assertThat(nutrition.getSugar()).isEqualByComparingTo(new BigDecimal("10.39"));
    }

    @Test
    void parseNutritionInfoReturnsEmptyForMalformedOrEmptyJson() {
        assertThat(UsdaFoodDataClient.parseNutritionInfo("", objectMapper)).isEmpty();
        assertThat(UsdaFoodDataClient.parseNutritionInfo("{not-json", objectMapper)).isEmpty();
        assertThat(UsdaFoodDataClient.parseNutritionInfo("{\"foods\":[]}", objectMapper)).isEmpty();
    }
}
