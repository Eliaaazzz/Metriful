package com.fitnessapp.backend.nutrition.service.core;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.fitnessapp.backend.nutrition.dto.BoundingBox;
import com.fitnessapp.backend.nutrition.dto.DepthItem;
import com.fitnessapp.backend.nutrition.dto.FoodRecognitionRequestMetadata;
import com.fitnessapp.backend.nutrition.dto.FoodRecognitionResult;
import com.fitnessapp.backend.nutrition.dto.RecognizedFood;

import lombok.extern.slf4j.Slf4j;

/**
 * Per-item (mixed-plate) portion refinement — the full physics decomposition the roadmap's §10 path
 * implies, and the single entry point the recognition pipeline calls.
 *
 * <p>Where {@link CaloriePhysicsRefinementService} applies ONE scene-level scale from ONE scene
 * volume, this assigns each on-device depth mask ({@link DepthItem}) to the vision model's matching
 * food (by normalized geometry) and corrects each food independently with ITS OWN volume and ITS
 * OWN bulk density:
 * <pre>
 *   mass_i   = (volume_i / volumeBias) × density(food_i)
 *   kcal_i   = mass_i × energyDensity_i            // energyDensity_i = flashKcal_i / flashGrams_i
 *   blend_i  = flashKcal_i^w × kcal_i^(1-w)         // per-item geometric mean, w = blendWeight
 *   scale_i  = clamp(blend_i / flashKcal_i, minScale, maxScale)
 * </pre>
 * Per-item density is exactly what lets a big low-density salad and a small dense steak on the same
 * plate be corrected in <em>opposite</em> directions — impossible with a single scene scale, and
 * the reason whole-plate correction stalls on mixed plates.
 *
 * <p><b>When the per-item path activates.</b> Only when the client supplies per-item depth masks
 * AND the vision model localized at least one food (a {@link BoundingBox}) so masks can be assigned.
 * Otherwise it delegates to {@link CaloriePhysicsRefinementService}, which still benefits from the
 * segmentation-cleaned, food-only total volume (Σ per-item volumes). In the degenerate single-item
 * single-mask case the two paths compute the same scale.
 *
 * <p><b>Default OFF — measured worse than whole-plate.</b> An offline eval on Nutrition5k mixed
 * plates (n=100, docs/calorie-accuracy-roadmap-25-to-15.md §11) found per-item ≈ 23% vs whole-plate
 * geomean ≈ 16% median calorie APE — per-item loses in every item-count bucket, because the per-food
 * energy-density multiply amplifies partition/assignment noise (a fatty item at ~5 kcal/g blows up)
 * while the whole-plate blended density averages it out. So {@code per-item-enabled} defaults
 * {@code false}: the vertical is kept behind the flag for the clean-instance-mask + well-separated
 * plate case it was designed for, but is not the shipped default.
 *
 * <p><b>Safety.</b> Strict no-op when disabled, when there is no usable geometry/identity, or when
 * no item actually changes — behaviour is never worse than the model alone. It shares
 * volumeBias/blendWeight/clamp semantics (and config keys) with the scene refiner, and never
 * mutates the provider's result (returns scaled copies).
 */
@Slf4j
@Service
public class PerItemPortionRefinementService {

    private final FoodCategoryClassifier classifier;
    private final CaloriePhysicsRefinementService sceneRefiner;
    private final boolean enabled;
    private final boolean perItemEnabled;
    private final double blendWeight;   // weight on the model's own calorie estimate, in [0, 1]
    private final double volumeBias;    // geometric-volume → true-volume divisor (>0)
    private final double minScale;
    private final double maxScale;

    /** Below this relative change, keep the model's item to avoid needless rounding churn. */
    private static final double SCALE_EPSILON = 0.005;

    /** A per-item mask volume below this (cm³) is treated as a noise reading and skipped. */
    private static final double MIN_VOLUME_CM3 = 2.0;

    public PerItemPortionRefinementService(
            FoodCategoryClassifier classifier,
            CaloriePhysicsRefinementService sceneRefiner,
            @Value("${app.nutrition.physics-refine.enabled:true}") boolean enabled,
            @Value("${app.nutrition.physics-refine.per-item-enabled:false}") boolean perItemEnabled,
            @Value("${app.nutrition.physics-refine.blend-weight:0.5}") double blendWeight,
            @Value("${app.nutrition.physics-refine.volume-bias:1.32}") double volumeBias,
            @Value("${app.nutrition.physics-refine.min-scale:0.4}") double minScale,
            @Value("${app.nutrition.physics-refine.max-scale:2.5}") double maxScale) {
        this.classifier = classifier;
        this.sceneRefiner = sceneRefiner;
        this.enabled = enabled;
        this.perItemEnabled = perItemEnabled;
        this.blendWeight = Double.isFinite(blendWeight) ? clamp(blendWeight, 0.0, 1.0) : 0.5;
        this.volumeBias = (Double.isFinite(volumeBias) && volumeBias > 0) ? volumeBias : 1.32;
        double lo = (Double.isFinite(minScale) && minScale > 0) ? minScale : 0.4;
        double hi = (Double.isFinite(maxScale) && maxScale > 0) ? maxScale : 2.5;
        if (hi < lo) { // inconsistent pair (e.g. min=3, max=2) → reset both to safe defaults
            lo = 0.4;
            hi = 2.5;
        }
        this.minScale = lo;
        this.maxScale = hi;
    }

    /**
     * Return a portion-refined copy of {@code result}: per-item when depth masks and localized foods
     * are present, else the scene-level refinement, else {@code result} unchanged.
     */
    public FoodRecognitionResult refine(FoodRecognitionResult result, FoodRecognitionRequestMetadata metadata) {
        if (!enabled || result == null || metadata == null) {
            return result;
        }
        List<RecognizedFood> foods = result.getItems();
        if (foods == null || foods.isEmpty()) {
            return result;
        }
        List<DepthItem> depthItems = metadata.resolveDepthItems();

        // Per-item path needs segmented volumes AND at least one localized food to assign them to.
        if (perItemEnabled && !depthItems.isEmpty() && anyFoodLocalized(foods)) {
            FoodRecognitionResult perItem = refinePerItem(result, foods, depthItems);
            if (perItem != null) {
                return perItem;
            }
        }
        // Fallback: scene-level correction, using a segmentation-cleaned total volume when the
        // client sent per-item masks but no explicit scene volume.
        return sceneRefiner.refine(result, sceneMetadata(metadata, depthItems));
    }

    private FoodRecognitionResult refinePerItem(FoodRecognitionResult result,
                                                List<RecognizedFood> foods,
                                                List<DepthItem> depthItems) {
        // 1) Assign each mask to the food it falls inside (or is nearest to); sum per food so an
        //    over-segmented food (several masks) accumulates its full volume.
        double[] volPerFood = new double[foods.size()];
        for (DepthItem di : depthItems) {
            if (!di.hasPositiveVolume() || !di.hasCentroid()) {
                continue;
            }
            int idx = assign(foods, di.getCentroidX(), di.getCentroidY());
            if (idx >= 0) {
                volPerFood[idx] += di.getVolumeCm3();
            }
        }

        // 2) Correct each assigned food independently with its own volume + density.
        List<RecognizedFood> out = new ArrayList<>(foods.size());
        int corrected = 0;
        for (int i = 0; i < foods.size(); i++) {
            RecognizedFood f = foods.get(i);
            double volume = volPerFood[i];
            double grams = grams(f);
            double kcal = calories(f);
            if (volume >= MIN_VOLUME_CM3 && grams > 0 && kcal > 0) {
                double energyDensity = kcal / grams;                 // kcal/g — the model's strength
                double density = classifier.densityGramsPerCm3(displayName(f)); // g/cm³ — food-intrinsic
                double physicsMass = (volume / volumeBias) * density;
                double physicsKcal = physicsMass * energyDensity;
                if (physicsKcal > 0) {
                    double blended = Math.exp(blendWeight * Math.log(kcal)
                            + (1.0 - blendWeight) * Math.log(physicsKcal));
                    double scale = clamp(blended / kcal, minScale, maxScale);
                    if (Math.abs(scale - 1.0) >= SCALE_EPSILON) {
                        out.add(PortionScaling.scaledCopy(f, scale));
                        corrected++;
                        continue;
                    }
                }
            }
            out.add(f); // no assigned mask / partial data / negligible change → keep the model's item
        }

        if (corrected == 0) {
            return null; // nothing corrected here → let the caller fall back to scene-level
        }
        log.info("Per-item portion-refine: corrected {}/{} items from {} depth masks",
                corrected, foods.size(), depthItems.size());
        // New result with scaled copies; never mutate the provider's output.
        return result.toBuilder().items(out).build();
    }

    /** Index of the food whose box contains (cx,cy); else the nearest localized food; else -1. */
    private static int assign(List<RecognizedFood> foods, double cx, double cy) {
        int nearest = -1;
        double bestDist = Double.MAX_VALUE;
        for (int i = 0; i < foods.size(); i++) {
            RecognizedFood f = foods.get(i);
            BoundingBox box = f == null ? null : f.getBoundingBox();
            if (box == null || !box.isValid()) {
                continue;
            }
            if (box.contains(cx, cy)) {
                return i; // inside a box → unambiguous assignment
            }
            double dx = cx - box.centerX();
            double dy = cy - box.centerY();
            double d = dx * dx + dy * dy;
            if (d < bestDist) {
                bestDist = d;
                nearest = i;
            }
        }
        return nearest;
    }

    private static boolean anyFoodLocalized(List<RecognizedFood> foods) {
        for (RecognizedFood f : foods) {
            if (f != null && f.getBoundingBox() != null && f.getBoundingBox().isValid()) {
                return true;
            }
        }
        return false;
    }

    /**
     * Metadata for the scene fallback: the original when it already carries a scene volume, else a
     * synthetic one whose volume is the sum of the per-item masks (food-only, so no plate/table).
     * Returns the original unchanged when there is no geometry at all (scene refiner then no-ops).
     */
    private static FoodRecognitionRequestMetadata sceneMetadata(FoodRecognitionRequestMetadata metadata,
                                                                List<DepthItem> depthItems) {
        if (metadata.resolveVolumeCm3() != null || depthItems.isEmpty()) {
            return metadata;
        }
        double total = 0.0;
        for (DepthItem di : depthItems) {
            if (di.hasPositiveVolume()) {
                total += di.getVolumeCm3();
            }
        }
        if (total <= 0) {
            return metadata;
        }
        return FoodRecognitionRequestMetadata.builder().volumeCm3(total).build();
    }

    // --- value helpers (mirror the scene refiner) ---

    private static double grams(RecognizedFood item) {
        Integer g = item == null ? null : item.getEstimatedGrams();
        return g != null && g > 0 ? g : 0.0;
    }

    private static double calories(RecognizedFood item) {
        if (item == null || item.getNutrition() == null || item.getNutrition().getCalories() == null) {
            return 0.0;
        }
        double c = item.getNutrition().getCalories().doubleValue();
        return c > 0 ? c : 0.0;
    }

    private static String displayName(RecognizedFood item) {
        return item == null ? null : item.getDisplayName();
    }

    private static double clamp(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
