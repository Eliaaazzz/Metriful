package com.fitnessapp.backend.nutrition.service.core;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import com.fitnessapp.backend.nutrition.enums.FoodDensityCategory;

@DisplayName("FoodCategoryClassifier Tests")
class FoodCategoryClassifierTest {

    private final FoodCategoryClassifier classifier = new FoodCategoryClassifier();

    @ParameterizedTest
    @DisplayName("classifies common foods into the right density category")
    @CsvSource({
        "Caesar salad, LEAFY_VEG",
        "Steamed white rice, CARB_STAPLE",
        "Whole wheat bagel, CARB_STAPLE",
        "Grilled chicken breast, MEAT_MAIN",
        "Salmon fillet, MEAT_MAIN",
        "Beef stew, LIQUID_SOUP",
        "Chicken noodle soup, LIQUID_SOUP",
        "Olive oil drizzle, FATS_DRESSING",
        "Ranch dressing, FATS_DRESSING",
        "Fresh strawberries, FRUIT",
        "Greek yogurt, DAIRY",
        "Potato chips, SNACK",
        "Almond handful, SNACK",
        "Orange juice, BEVERAGE",
        "Minced garlic, GARNISH",
        "Fried rice, MIXED_DISH",
        "Butterfly shrimp, MEAT_MAIN",
        "Grapefruit half, FRUIT",
        "Blueberries, FRUIT",
        "Chicken nuggets, MEAT_MAIN"
    })
    void classifiesCommonFoods(String name, String expected) {
        assertThat(classifier.classify(name)).isEqualTo(FoodDensityCategory.valueOf(expected));
    }

    @Test
    @DisplayName("whole-word matching avoids substring false positives")
    void avoidsSubstringFalsePositives() {
        // "butter" must not fire on "butterfly"; "steak" must not fire on the "tea" cue.
        assertThat(classifier.classify("butterfly shrimp")).isEqualTo(FoodDensityCategory.MEAT_MAIN);
        assertThat(classifier.classify("grilled steak")).isEqualTo(FoodDensityCategory.MEAT_MAIN);
        assertThat(classifier.classify("steamed white rice")).isEqualTo(FoodDensityCategory.CARB_STAPLE);
        // regular plurals still match their singular cue
        assertThat(classifier.classify("potato chips")).isEqualTo(FoodDensityCategory.SNACK);
        assertThat(classifier.classify("scrambled eggs")).isEqualTo(FoodDensityCategory.MEAT_MAIN);
    }

    @Test
    @DisplayName("compound cues win over the staples they contain (fried rice != rice)")
    void compoundCuesTakePrecedence() {
        assertThat(classifier.classify("fried rice")).isEqualTo(FoodDensityCategory.MIXED_DISH);
        assertThat(classifier.classify("chicken curry")).isEqualTo(FoodDensityCategory.MIXED_DISH);
        // plain rice still resolves to the staple
        assertThat(classifier.classify("jasmine rice")).isEqualTo(FoodDensityCategory.CARB_STAPLE);
    }

    @Test
    @DisplayName("snacks/proteins beat incidental dairy/fruit words; meat beats snack")
    void compositePrecedenceOverIngredientWords() {
        // Gemini review: a snack keyed on its snack noun must beat an incidental dairy/fruit word.
        assertThat(classifier.classify("cheese crackers")).isEqualTo(FoodDensityCategory.SNACK);
        assertThat(classifier.classify("cheese puffs")).isEqualTo(FoodDensityCategory.SNACK);
        assertThat(classifier.classify("apple chips")).isEqualTo(FoodDensityCategory.SNACK);
        // but plain dairy/fruit still resolve correctly
        assertThat(classifier.classify("cheddar cheese")).isEqualTo(FoodDensityCategory.DAIRY);
        assertThat(classifier.classify("sliced apple")).isEqualTo(FoodDensityCategory.FRUIT);
        // and MEAT stays ahead of SNACK for savoury cake/roll items
        assertThat(classifier.classify("crab cake")).isEqualTo(FoodDensityCategory.MEAT_MAIN);
        assertThat(classifier.classify("egg roll")).isEqualTo(FoodDensityCategory.MEAT_MAIN);
    }

    @Test
    @DisplayName("unknown / null / blank names fall back to GENERIC")
    void unknownFallsBackToGeneric() {
        assertThat(classifier.classify(null)).isEqualTo(FoodDensityCategory.GENERIC);
        assertThat(classifier.classify("")).isEqualTo(FoodDensityCategory.GENERIC);
        assertThat(classifier.classify("   ")).isEqualTo(FoodDensityCategory.GENERIC);
        assertThat(classifier.classify("zorblax surprise")).isEqualTo(FoodDensityCategory.GENERIC);
    }

    @Test
    @DisplayName("densityGramsPerCm3 mirrors the classified category's density")
    void densityMirrorsCategory() {
        assertThat(classifier.densityGramsPerCm3("Caesar salad"))
            .isEqualTo(FoodDensityCategory.LEAFY_VEG.getGramsPerCm3());
        assertThat(classifier.densityGramsPerCm3("mystery goo"))
            .isEqualTo(FoodDensityCategory.GENERIC.getGramsPerCm3());
    }
}
