package com.fitnessapp.backend.nutrition.enums;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * Unit tests for FoodDensityCategory enum and density matrix calculation
 */
@DisplayName("FoodDensityCategory Tests")
class FoodDensityCategoryTest {

    @Test
    @DisplayName("LEAFY_VEG should have correct gram values (50/100/200)")
    void leafyVegHasCorrectGrams() {
        assertThat(FoodDensityCategory.LEAFY_VEG.getSmallGrams()).isEqualTo(50);
        assertThat(FoodDensityCategory.LEAFY_VEG.getMediumGrams()).isEqualTo(100);
        assertThat(FoodDensityCategory.LEAFY_VEG.getLargeGrams()).isEqualTo(200);
    }

    @Test
    @DisplayName("CARB_STAPLE should have correct gram values (100/200/350)")
    void carbStapleHasCorrectGrams() {
        assertThat(FoodDensityCategory.CARB_STAPLE.getSmallGrams()).isEqualTo(100);
        assertThat(FoodDensityCategory.CARB_STAPLE.getMediumGrams()).isEqualTo(200);
        assertThat(FoodDensityCategory.CARB_STAPLE.getLargeGrams()).isEqualTo(350);
    }

    @Test
    @DisplayName("MEAT_MAIN should have correct gram values (120/200/350)")
    void meatMainHasCorrectGrams() {
        assertThat(FoodDensityCategory.MEAT_MAIN.getSmallGrams()).isEqualTo(120);
        assertThat(FoodDensityCategory.MEAT_MAIN.getMediumGrams()).isEqualTo(200);
        assertThat(FoodDensityCategory.MEAT_MAIN.getLargeGrams()).isEqualTo(350);
    }

    @Test
    @DisplayName("LIQUID_SOUP should have correct gram values (200/350/500)")
    void liquidSoupHasCorrectGrams() {
        assertThat(FoodDensityCategory.LIQUID_SOUP.getSmallGrams()).isEqualTo(200);
        assertThat(FoodDensityCategory.LIQUID_SOUP.getMediumGrams()).isEqualTo(350);
        assertThat(FoodDensityCategory.LIQUID_SOUP.getLargeGrams()).isEqualTo(500);
    }

    @Test
    @DisplayName("FATS_DRESSING should have correct gram values (10/20/40)")
    void fatsDressingHasCorrectGrams() {
        assertThat(FoodDensityCategory.FATS_DRESSING.getSmallGrams()).isEqualTo(10);
        assertThat(FoodDensityCategory.FATS_DRESSING.getMediumGrams()).isEqualTo(20);
        assertThat(FoodDensityCategory.FATS_DRESSING.getLargeGrams()).isEqualTo(40);
    }

    @Test
    @DisplayName("GENERIC should have correct gram values (100/200/300)")
    void genericHasCorrectGrams() {
        assertThat(FoodDensityCategory.GENERIC.getSmallGrams()).isEqualTo(100);
        assertThat(FoodDensityCategory.GENERIC.getMediumGrams()).isEqualTo(200);
        assertThat(FoodDensityCategory.GENERIC.getLargeGrams()).isEqualTo(300);
    }

    @ParameterizedTest
    @DisplayName("getGramsForPortion should return correct values for each category")
    @CsvSource({
        "LEAFY_VEG, SMALL, 50",
        "LEAFY_VEG, MEDIUM, 100",
        "LEAFY_VEG, LARGE, 200",
        "CARB_STAPLE, SMALL, 100",
        "CARB_STAPLE, MEDIUM, 200",
        "CARB_STAPLE, LARGE, 350",
        "MEAT_MAIN, SMALL, 120",
        "MEAT_MAIN, MEDIUM, 200",
        "MEAT_MAIN, LARGE, 350",
        "LIQUID_SOUP, SMALL, 200",
        "LIQUID_SOUP, MEDIUM, 350",
        "LIQUID_SOUP, LARGE, 500",
        "FATS_DRESSING, SMALL, 10",
        "FATS_DRESSING, MEDIUM, 20",
        "FATS_DRESSING, LARGE, 40",
        "GARNISH, SMALL, 3",
        "GARNISH, MEDIUM, 10",
        "GARNISH, LARGE, 20",
        "MIXED_DISH, SMALL, 150",
        "MIXED_DISH, MEDIUM, 300",
        "MIXED_DISH, LARGE, 450",
        "FRUIT, SMALL, 80",
        "FRUIT, MEDIUM, 150",
        "FRUIT, LARGE, 250",
        "DAIRY, SMALL, 100",
        "DAIRY, MEDIUM, 200",
        "DAIRY, LARGE, 300",
        "SNACK, SMALL, 30",
        "SNACK, MEDIUM, 60",
        "SNACK, LARGE, 100",
        "BEVERAGE, SMALL, 200",
        "BEVERAGE, MEDIUM, 350",
        "BEVERAGE, LARGE, 500",
        "GENERIC, SMALL, 100",
        "GENERIC, MEDIUM, 200",
        "GENERIC, LARGE, 300"
    })
    void getGramsForPortionReturnsCorrectValues(String categoryStr, String portionStr, int expectedGrams) {
        FoodDensityCategory category = FoodDensityCategory.valueOf(categoryStr);
        PortionSize portion = PortionSize.valueOf(portionStr);

        assertThat(category.getGramsForPortion(portion)).isEqualTo(expectedGrams);
    }

    @Test
    @DisplayName("getGramsForPortion should return medium when portion is null")
    void getGramsForPortionReturnsDefaultOnNull() {
        assertThat(FoodDensityCategory.MEAT_MAIN.getGramsForPortion(null)).isEqualTo(200);
        assertThat(FoodDensityCategory.FATS_DRESSING.getGramsForPortion(null)).isEqualTo(20);
    }

    @ParameterizedTest
    @DisplayName("fromString should parse category names correctly")
    @CsvSource({
        "leafy_veg, LEAFY_VEG",
        "LEAFY_VEG, LEAFY_VEG",
        "carb_staple, CARB_STAPLE",
        "meat_main, MEAT_MAIN",
        "liquid_soup, LIQUID_SOUP",
        "fats_dressing, FATS_DRESSING",
        "garnish, GARNISH",
        "mixed_dish, MIXED_DISH",
        "fruit, FRUIT",
        "dairy, DAIRY",
        "snack, SNACK",
        "beverage, BEVERAGE",
        "generic, GENERIC"
    })
    void fromStringParsesCorrectly(String input, String expectedCategory) {
        assertThat(FoodDensityCategory.fromString(input))
            .isEqualTo(FoodDensityCategory.valueOf(expectedCategory));
    }

    @Test
    @DisplayName("fromString should return GENERIC for null or blank")
    void fromStringReturnsGenericForInvalid() {
        assertThat(FoodDensityCategory.fromString(null)).isEqualTo(FoodDensityCategory.GENERIC);
        assertThat(FoodDensityCategory.fromString("")).isEqualTo(FoodDensityCategory.GENERIC);
        assertThat(FoodDensityCategory.fromString("   ")).isEqualTo(FoodDensityCategory.GENERIC);
        assertThat(FoodDensityCategory.fromString("unknown_category")).isEqualTo(FoodDensityCategory.GENERIC);
    }

    @Test
    @DisplayName("fromString should handle hyphens and spaces")
    void fromStringHandlesVariations() {
        assertThat(FoodDensityCategory.fromString("leafy-veg")).isEqualTo(FoodDensityCategory.LEAFY_VEG);
        assertThat(FoodDensityCategory.fromString("leafy veg")).isEqualTo(FoodDensityCategory.LEAFY_VEG);
        assertThat(FoodDensityCategory.fromString("carb-staple")).isEqualTo(FoodDensityCategory.CARB_STAPLE);
    }

    @Test
    @DisplayName("getGramRange should return formatted string")
    void getGramRangeReturnsFormattedString() {
        assertThat(FoodDensityCategory.LEAFY_VEG.getGramRange()).isEqualTo("50g - 200g");
        assertThat(FoodDensityCategory.MEAT_MAIN.getGramRange()).isEqualTo("120g - 350g");
        assertThat(FoodDensityCategory.FATS_DRESSING.getGramRange()).isEqualTo("10g - 40g");
    }

    @Test
    @DisplayName("getGramsPerCm3 returns physically sensible bulk densities")
    void gramsPerCm3AreSensible() {
        // Every category's bulk density is in a physically plausible food range.
        for (FoodDensityCategory c : FoodDensityCategory.values()) {
            assertThat(c.getGramsPerCm3())
                .as("density of %s", c)
                .isGreaterThan(0.0)
                .isLessThanOrEqualTo(1.1);
        }
        // Airy foods are far less dense than dense proteins/liquids.
        assertThat(FoodDensityCategory.LEAFY_VEG.getGramsPerCm3())
            .isLessThan(FoodDensityCategory.MEAT_MAIN.getGramsPerCm3());
        assertThat(FoodDensityCategory.SNACK.getGramsPerCm3())
            .isLessThan(FoodDensityCategory.DAIRY.getGramsPerCm3());
        // GENERIC matches the ~0.6 g/cm³ measured median across the benchmarks.
        assertThat(FoodDensityCategory.GENERIC.getGramsPerCm3()).isEqualTo(0.60);
    }

    @Test
    @DisplayName("Density categories should have sensible size differences")
    void densityCategoriesHaveSensibleDifferences() {
        // Fats should be much smaller than meats
        assertThat(FoodDensityCategory.FATS_DRESSING.getLargeGrams())
            .isLessThan(FoodDensityCategory.MEAT_MAIN.getSmallGrams());

        // Leafy veg large should be smaller than meat large
        assertThat(FoodDensityCategory.LEAFY_VEG.getLargeGrams())
            .isLessThan(FoodDensityCategory.MEAT_MAIN.getLargeGrams());

        // Soup should have the largest portions
        assertThat(FoodDensityCategory.LIQUID_SOUP.getLargeGrams())
            .isEqualTo(500);
    }
}
