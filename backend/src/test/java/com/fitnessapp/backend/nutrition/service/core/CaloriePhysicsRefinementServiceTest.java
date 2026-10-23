package com.fitnessapp.backend.nutrition.service.core;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fitnessapp.backend.nutrition.dto.FoodRecognitionRequestMetadata;
import com.fitnessapp.backend.nutrition.dto.FoodRecognitionResult;
import com.fitnessapp.backend.nutrition.dto.NutritionInfo;
import com.fitnessapp.backend.nutrition.dto.RecognizedFood;

@DisplayName("CaloriePhysicsRefinementService Tests")
class CaloriePhysicsRefinementServiceTest {

    // Plain 50:50 geomean with a neutral fusion bias — keeps the long-standing math expectations
    // below independent of the learned-fusion defaults (covered by their own tests).
    private final CaloriePhysicsRefinementService service =
            new CaloriePhysicsRefinementService(new FoodCategoryClassifier(), true, 0.5, 1.0, 1.32, 0.4, 2.5);

    // Learned-fusion production defaults (application.yml): w=0.75 on flash, e^b=0.862.
    private final CaloriePhysicsRefinementService learned =
            new CaloriePhysicsRefinementService(new FoodCategoryClassifier(), true, 0.75, 0.862, 1.32, 0.4, 2.5);

    // --- helpers ---
    private static RecognizedFood food(String name, int grams, int kcal) {
        return RecognizedFood.builder()
                .displayName(name)
                .estimatedGrams(grams)
                .nutrition(NutritionInfo.builder()
                        .calories(BigDecimal.valueOf(kcal))
                        .protein(BigDecimal.valueOf(10))
                        .carbs(BigDecimal.valueOf(20))
                        .fat(BigDecimal.valueOf(5))
                        .build())
                .build();
    }

    private static FoodRecognitionResult result(RecognizedFood... items) {
        return FoodRecognitionResult.builder().items(List.of(items)).sceneType("single_dish").build();
    }

    private static FoodRecognitionRequestMetadata volume(Double cm3) {
        FoodRecognitionRequestMetadata m = new FoodRecognitionRequestMetadata();
        m.setVolumeCm3(cm3);
        return m;
    }

    private static int kcal(RecognizedFood f) {
        return f.getNutrition().getCalories().intValue();
    }

    // --- no-op safety ---

    @Test
    @DisplayName("no-op when metadata carries no volume")
    void noOpWithoutVolume() {
        FoodRecognitionResult r = result(food("Steak", 200, 400));
        FoodRecognitionResult out = service.refine(r, new FoodRecognitionRequestMetadata());
        assertThat(kcal(out.getItems().get(0))).isEqualTo(400);
        assertThat(out.getItems().get(0).getEstimatedGrams()).isEqualTo(200);
    }

    @Test
    @DisplayName("no-op returns the same instance for null metadata")
    void noOpWithNullMetadata() {
        FoodRecognitionResult r = result(food("Steak", 200, 400));
        assertThat(service.refine(r, null)).isSameAs(r);
        assertThat(kcal(r.getItems().get(0))).isEqualTo(400);
    }

    @Test
    @DisplayName("no-op when disabled by config")
    void noOpWhenDisabled() {
        CaloriePhysicsRefinementService disabled =
                new CaloriePhysicsRefinementService(new FoodCategoryClassifier(), false, 0.5, 1.0, 1.32, 0.4, 2.5);
        FoodRecognitionResult r = result(food("Steak", 200, 400));
        assertThat(kcal(disabled.refine(r, volume(100.0)).getItems().get(0))).isEqualTo(400);
    }

    @Test
    @DisplayName("no-op on non-positive volume")
    void noOpOnZeroVolume() {
        FoodRecognitionResult r = result(food("Steak", 200, 400));
        assertThat(kcal(service.refine(r, volume(0.0)).getItems().get(0))).isEqualTo(400);
    }

    @Test
    @DisplayName("no-op on an implausibly tiny volume reading (noise)")
    void noOpOnTinyVolume() {
        FoodRecognitionResult r = result(food("Steak", 200, 400));
        FoodRecognitionResult out = service.refine(r, volume(0.001));
        assertThat(kcal(out.getItems().get(0))).isEqualTo(400);
        assertThat(out.getItems().get(0).getEstimatedGrams()).isEqualTo(200);
    }

    // --- immutability (Gemini review: refine must not mutate the provider's output) ---

    @Test
    @DisplayName("does NOT mutate the input result; returns a new scaled copy")
    void doesNotMutateOriginal() {
        FoodRecognitionResult r = result(food("Grilled steak", 200, 400));
        RecognizedFood originalItem = r.getItems().get(0);
        FoodRecognitionResult out = service.refine(r, volume(100.0));
        // original untouched
        assertThat(kcal(originalItem)).isEqualTo(400);
        assertThat(originalItem.getEstimatedGrams()).isEqualTo(200);
        // returned copy is scaled and is a different object
        assertThat(out).isNotSameAs(r);
        assertThat(kcal(out.getItems().get(0))).isEqualTo(249);
    }

    // --- correction math ---

    @Test
    @DisplayName("scales DOWN when the model over-estimates portion (small volume)")
    void scalesDownOnOverEstimate() {
        // Steak (density 1.02), flash 200g/400kcal (2.0 kcal/g), volume 100cm3.
        // volCorr=75.76, mass=77.27, physKcal=154.55, blend=sqrt(400*154.55)=248.6, scale=0.6216.
        FoodRecognitionResult out = service.refine(result(food("Grilled steak", 200, 400)), volume(100.0));
        assertThat(kcal(out.getItems().get(0))).isEqualTo(249);
        assertThat(out.getItems().get(0).getEstimatedGrams()).isEqualTo(124);
    }

    @Test
    @DisplayName("scales UP when the model under-estimates portion (large volume)")
    void scalesUpOnUnderEstimate() {
        // Rice (density 0.55), flash 100g/100kcal (1.0 kcal/g), volume 500cm3.
        FoodRecognitionResult out = service.refine(result(food("Jasmine rice", 100, 100)), volume(500.0));
        assertThat(kcal(out.getItems().get(0))).isEqualTo(144);
        assertThat(out.getItems().get(0).getEstimatedGrams()).isEqualTo(144);
    }

    @Test
    @DisplayName("per-food density changes the correction (salad vs steak at same volume)")
    void densityAffectsCorrection() {
        int salad = kcal(service.refine(result(food("Garden salad", 200, 400)), volume(300.0)).getItems().get(0));
        int steak = kcal(service.refine(result(food("Ribeye steak", 200, 400)), volume(300.0)).getItems().get(0));
        assertThat(salad).isLessThan(steak);
    }

    @Test
    @DisplayName("extreme volume is clamped by max-scale")
    void clampsRunawayScale() {
        FoodRecognitionResult out = service.refine(result(food("Cake", 100, 100)), volume(100000.0));
        assertThat(kcal(out.getItems().get(0))).isEqualTo(250);
        assertThat(out.getItems().get(0).getEstimatedGrams()).isEqualTo(250);
    }

    @Test
    @DisplayName("inconsistent clamp config (min > max) resets to safe defaults")
    void hardensInvalidClampConfig() {
        CaloriePhysicsRefinementService bad =
                new CaloriePhysicsRefinementService(new FoodCategoryClassifier(), true, 0.5, 1.0, 1.32, 3.0, 2.0);
        FoodRecognitionResult out = bad.refine(result(food("Cake", 100, 100)), volume(100000.0));
        assertThat(kcal(out.getItems().get(0))).isEqualTo(250);
    }

    @Test
    @DisplayName("multi-item scenes scale uniformly, preserving per-item ratios")
    void multiItemPreservesRatios() {
        FoodRecognitionResult out =
                service.refine(result(food("Steak", 200, 400), food("Rice", 100, 100)), volume(200.0));
        int a = kcal(out.getItems().get(0));
        int b = kcal(out.getItems().get(1));
        assertThat((double) a / b).isCloseTo(4.0, org.assertj.core.data.Offset.offset(0.05));
    }

    @Test
    @DisplayName("robust to items with null nutrition or missing grams")
    void robustToPartialItems() {
        RecognizedFood noNutrition = RecognizedFood.builder().displayName("Garnish").estimatedGrams(5).build();
        RecognizedFood valid = food("Steak", 200, 400);
        FoodRecognitionResult r = FoodRecognitionResult.builder()
                .items(List.of(noNutrition, valid)).sceneType("multi_dish").build();
        FoodRecognitionResult out = service.refine(r, volume(100.0)); // must not throw
        assertThat(kcal(out.getItems().get(1))).isEqualTo(249);
    }

    // --- learned fusion (w=0.75, e^b=0.862; docs/calorie-accuracy-roadmap-25-to-15.md §12) ---

    @Test
    @DisplayName("learned fusion: flash-heavy weight plus bias intercept")
    void learnedFusionDefaults() {
        // Steak 200g/400kcal, volume 100cm³: physicsKcal=154.55,
        // blended = 0.862 × 400^0.75 × 154.55^0.25 = 271.8 → scale 0.6796.
        FoodRecognitionResult out = learned.refine(result(food("Grilled steak", 200, 400)), volume(100.0));
        assertThat(kcal(out.getItems().get(0))).isEqualTo(272);
        assertThat(out.getItems().get(0).getEstimatedGrams()).isEqualTo(136);
    }

    @Test
    @DisplayName("learned fusion corrects less aggressively toward physics than 50:50")
    void learnedFusionIsFlashHeavier() {
        FoodRecognitionResult in = result(food("Grilled steak", 200, 400));
        int fifty = kcal(service.refine(in, volume(100.0)).getItems().get(0));   // 249
        int learnedKcal = kcal(learned.refine(in, volume(100.0)).getItems().get(0)); // 272
        assertThat(learnedKcal).isGreaterThan(fifty).isLessThan(400);
    }

    @Test
    @DisplayName("out-of-band fusion-bias falls back to neutral 1.0, not the learned default")
    void hardensInvalidFusionBias() {
        for (double bad : new double[]{0.0, -1.0, 0.2, 5.0, Double.NaN, Double.POSITIVE_INFINITY}) {
            CaloriePhysicsRefinementService s =
                    new CaloriePhysicsRefinementService(new FoodCategoryClassifier(), true, 0.5, bad, 1.32, 0.4, 2.5);
            FoodRecognitionResult out = s.refine(result(food("Grilled steak", 200, 400)), volume(100.0));
            assertThat(kcal(out.getItems().get(0))).as("bias=%s", bad).isEqualTo(249); // same as neutral
        }
    }

    @Test
    @DisplayName("weight=1.0 keeps the model estimate (pure flash), weight=0.0 is pure physics")
    void blendWeightExtremes() {
        CaloriePhysicsRefinementService pureFlash =
                new CaloriePhysicsRefinementService(new FoodCategoryClassifier(), true, 1.0, 1.0, 1.32, 0.1, 5.0);
        assertThat(kcal(pureFlash.refine(result(food("Steak", 200, 400)), volume(100.0)).getItems().get(0)))
                .isEqualTo(400); // unchanged

        CaloriePhysicsRefinementService purePhysics =
                new CaloriePhysicsRefinementService(new FoodCategoryClassifier(), true, 0.0, 1.0, 1.32, 0.1, 5.0);
        assertThat(kcal(purePhysics.refine(result(food("Steak", 200, 400)), volume(100.0)).getItems().get(0)))
                .isEqualTo(155); // physicsKcal ≈ 154.5 → 155
    }
}
