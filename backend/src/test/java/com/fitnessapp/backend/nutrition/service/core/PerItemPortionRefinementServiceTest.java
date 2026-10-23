package com.fitnessapp.backend.nutrition.service.core;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fitnessapp.backend.nutrition.dto.BoundingBox;
import com.fitnessapp.backend.nutrition.dto.DepthItem;
import com.fitnessapp.backend.nutrition.dto.FoodRecognitionRequestMetadata;
import com.fitnessapp.backend.nutrition.dto.FoodRecognitionResult;
import com.fitnessapp.backend.nutrition.dto.NutritionInfo;
import com.fitnessapp.backend.nutrition.dto.RecognizedFood;

@DisplayName("PerItemPortionRefinementService Tests")
class PerItemPortionRefinementServiceTest {

    private final FoodCategoryClassifier classifier = new FoodCategoryClassifier();
    private final CaloriePhysicsRefinementService scene =
            new CaloriePhysicsRefinementService(classifier, true, 0.5, 1.0, 1.32, 0.4, 2.5);
    // Default production-like config: per-item on, blend 0.5, bias 1.32, clamp [0.4, 2.5].
    private final PerItemPortionRefinementService service =
            new PerItemPortionRefinementService(classifier, scene, true, true, 0.5, 1.32, 0.4, 2.5);

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

    /** Same as {@link #food} but localized with a normalized bounding box. */
    private static RecognizedFood boxed(String name, int grams, int kcal,
                                        double x, double y, double w, double h) {
        return food(name, grams, kcal).toBuilder()
                .boundingBox(BoundingBox.builder().x(x).y(y).w(w).h(h).build())
                .build();
    }

    private static DepthItem mask(double volumeCm3, double cx, double cy) {
        return DepthItem.builder().volumeCm3(volumeCm3).centroidX(cx).centroidY(cy).build();
    }

    private static FoodRecognitionResult result(RecognizedFood... items) {
        return FoodRecognitionResult.builder().items(List.of(items)).sceneType("multi_dish").build();
    }

    private static FoodRecognitionRequestMetadata meta(Double sceneVolumeCm3, DepthItem... items) {
        return FoodRecognitionRequestMetadata.builder()
                .volumeCm3(sceneVolumeCm3)
                .items(List.of(items))
                .build();
    }

    private static int kcal(RecognizedFood f) {
        return f.getNutrition().getCalories().intValue();
    }

    private static RecognizedFood byName(FoodRecognitionResult r, String name) {
        return r.getItems().stream().filter(f -> f.getDisplayName().equals(name)).findFirst().orElseThrow();
    }

    // --- the headline: per-item corrects two foods in OPPOSITE directions in one pass ---

    @Test
    @DisplayName("mixed plate: dense over-estimate scales DOWN while bulky under-estimate scales UP")
    void oppositeDirectionsPerItem() {
        // Steak (ρ=1.02) left, small mask (100cm³) → over-estimated → scale down.
        // Rice  (ρ=0.55) right, big  mask (500cm³) → under-estimated → scale up.
        RecognizedFood steak = boxed("Grilled steak", 200, 400, 0.0, 0.0, 0.5, 1.0); // center (0.25, 0.5)
        RecognizedFood rice = boxed("Jasmine rice", 100, 100, 0.5, 0.0, 0.5, 1.0);   // center (0.75, 0.5)
        FoodRecognitionResult out = service.refine(
                result(steak, rice),
                meta(null, mask(100.0, 0.25, 0.5), mask(500.0, 0.75, 0.5)));

        assertThat(kcal(byName(out, "Grilled steak"))).isEqualTo(249); // down from 400
        assertThat(byName(out, "Grilled steak").getEstimatedGrams()).isEqualTo(124);
        assertThat(kcal(byName(out, "Jasmine rice"))).isEqualTo(144);  // up from 100
        assertThat(byName(out, "Jasmine rice").getEstimatedGrams()).isEqualTo(144);
    }

    @Test
    @DisplayName("per-item differs from scene-level on the SAME mixed plate (proves decomposition)")
    void perItemBeatsSceneLevel() {
        RecognizedFood steak = boxed("Grilled steak", 200, 400, 0.0, 0.0, 0.5, 1.0);
        RecognizedFood rice = boxed("Jasmine rice", 100, 100, 0.5, 0.0, 0.5, 1.0);
        FoodRecognitionRequestMetadata m = meta(600.0, mask(100.0, 0.25, 0.5), mask(500.0, 0.75, 0.5));

        int steakPerItem = kcal(byName(service.refine(result(steak, rice), m), "Grilled steak"));
        // Scene-level (per-item disabled) blends one volume+density → scales BOTH the same way.
        PerItemPortionRefinementService sceneOnly =
                new PerItemPortionRefinementService(classifier, scene, true, false, 0.5, 1.32, 0.4, 2.5);
        int steakScene = kcal(byName(sceneOnly.refine(result(steak, rice), m), "Grilled steak"));

        assertThat(steakPerItem).isEqualTo(249);  // per-item: steak scaled DOWN
        assertThat(steakScene).isEqualTo(457);     // scene: steak dragged UP by the bulky rice
        assertThat(steakPerItem).isNotEqualTo(steakScene);
    }

    // --- assignment behaviours ---

    @Test
    @DisplayName("over-segmentation: several masks on one food sum to its volume")
    void overSegmentationSums() {
        RecognizedFood steak = boxed("Grilled steak", 200, 400, 0.0, 0.0, 1.0, 1.0);
        FoodRecognitionResult twoMasks = service.refine(
                result(steak), meta(null, mask(50.0, 0.4, 0.5), mask(50.0, 0.6, 0.5)));
        // 50 + 50 = 100cm³ → identical to a single 100cm³ mask.
        assertThat(kcal(twoMasks.getItems().get(0))).isEqualTo(249);
        assertThat(twoMasks.getItems().get(0).getEstimatedGrams()).isEqualTo(124);
    }

    @Test
    @DisplayName("a localized food with no mask assigned is left untouched")
    void unassignedFoodUntouched() {
        RecognizedFood steak = boxed("Grilled steak", 200, 400, 0.0, 0.0, 0.5, 1.0);
        RecognizedFood rice = boxed("Jasmine rice", 100, 100, 0.5, 0.0, 0.5, 1.0);
        // Only one mask, over the steak.
        FoodRecognitionResult out = service.refine(
                result(steak, rice), meta(null, mask(100.0, 0.25, 0.5)));
        assertThat(kcal(byName(out, "Grilled steak"))).isEqualTo(249); // corrected
        assertThat(kcal(byName(out, "Jasmine rice"))).isEqualTo(100);  // untouched (no mask)
    }

    @Test
    @DisplayName("mask outside every box is assigned to the nearest localized food")
    void maskOutsideBoxesGoesToNearest() {
        RecognizedFood steak = boxed("Grilled steak", 200, 400, 0.0, 0.0, 0.2, 0.2); // center (0.1, 0.1)
        FoodRecognitionResult out = service.refine(
                result(steak), meta(null, mask(100.0, 0.9, 0.9))); // far corner, but only box present
        assertThat(kcal(out.getItems().get(0))).isEqualTo(249);
    }

    // --- fallback to scene-level ---

    @Test
    @DisplayName("depth masks but NO localized foods → scene-level fallback on the summed volume")
    void fallsBackToSceneWhenNoBoxes() {
        // No bounding boxes → cannot assign → scene-level using Σ mask volumes (=100cm³).
        RecognizedFood steak = food("Grilled steak", 200, 400);
        FoodRecognitionResult out = service.refine(
                result(steak), meta(null, mask(100.0, 0.5, 0.5)));
        assertThat(kcal(out.getItems().get(0))).isEqualTo(249); // still corrected, via scene path
        assertThat(out.getItems().get(0).getEstimatedGrams()).isEqualTo(124);
    }

    @Test
    @DisplayName("per-item disabled by config → scene-level path")
    void perItemDisabledUsesScene() {
        PerItemPortionRefinementService disabled =
                new PerItemPortionRefinementService(classifier, scene, true, false, 0.5, 1.32, 0.4, 2.5);
        RecognizedFood steak = boxed("Grilled steak", 200, 400, 0.0, 0.0, 1.0, 1.0);
        FoodRecognitionResult out = disabled.refine(
                result(steak), meta(100.0, mask(100.0, 0.5, 0.5)));
        assertThat(kcal(out.getItems().get(0))).isEqualTo(249); // scene == per-item for a single item
    }

    // --- no-op safety (mirrors the scene refiner's contract) ---

    @Test
    @DisplayName("no-op returns the same instance for null metadata")
    void noOpNullMetadata() {
        FoodRecognitionResult r = result(food("Steak", 200, 400));
        assertThat(service.refine(r, null)).isSameAs(r);
    }

    @Test
    @DisplayName("no-op when the whole refiner is disabled")
    void noOpWhenDisabled() {
        PerItemPortionRefinementService off =
                new PerItemPortionRefinementService(classifier, scene, false, true, 0.5, 1.32, 0.4, 2.5);
        RecognizedFood steak = boxed("Grilled steak", 200, 400, 0.0, 0.0, 1.0, 1.0);
        assertThat(kcal(off.refine(result(steak), meta(null, mask(100.0, 0.5, 0.5))).getItems().get(0)))
                .isEqualTo(400);
    }

    @Test
    @DisplayName("no-op when there is no depth geometry at all")
    void noOpWithoutGeometry() {
        RecognizedFood steak = boxed("Grilled steak", 200, 400, 0.0, 0.0, 1.0, 1.0);
        FoodRecognitionResult out =
                service.refine(result(steak), new FoodRecognitionRequestMetadata());
        assertThat(kcal(out.getItems().get(0))).isEqualTo(400);
        assertThat(out.getItems().get(0).getEstimatedGrams()).isEqualTo(200);
    }

    @Test
    @DisplayName("noise-level per-item volume is ignored, then falls back to scene (no volume) → no-op")
    void ignoresNoiseVolume() {
        RecognizedFood steak = boxed("Grilled steak", 200, 400, 0.0, 0.0, 1.0, 1.0);
        // Mask below MIN_VOLUME_CM3 → not corrected per-item; no scene volume → no-op.
        FoodRecognitionResult out = service.refine(
                result(steak), meta(null, mask(0.5, 0.5, 0.5)));
        assertThat(kcal(out.getItems().get(0))).isEqualTo(400);
    }

    // --- immutability ---

    @Test
    @DisplayName("does NOT mutate the input; returns new scaled copies")
    void doesNotMutateOriginal() {
        RecognizedFood steak = boxed("Grilled steak", 200, 400, 0.0, 0.0, 1.0, 1.0);
        FoodRecognitionResult r = result(steak);
        RecognizedFood original = r.getItems().get(0);
        FoodRecognitionResult out = service.refine(r, meta(null, mask(100.0, 0.5, 0.5)));
        assertThat(out).isNotSameAs(r);
        assertThat(kcal(original)).isEqualTo(400);               // original untouched
        assertThat(original.getEstimatedGrams()).isEqualTo(200);
        assertThat(kcal(out.getItems().get(0))).isEqualTo(249);  // copy corrected
    }
}
