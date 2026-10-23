package com.fitnessapp.backend.nutrition.service.core;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.fitnessapp.backend.nutrition.enums.FoodDensityCategory;

/**
 * Maps a free-text food name to a {@link FoodDensityCategory} via keyword matching.
 *
 * <p>Deterministic and side-effect free so it is trivially unit-testable and adds zero latency.
 * It exists to supply a per-food bulk density (g/cm³) for the geometric portion refinement
 * ({@code CaloriePhysicsRefinementService}) without an extra model call — the research
 * (docs/calorie-accuracy-roadmap-25-to-15.md §10) showed a single global density fails and a
 * per-food density is what makes volume→mass work. First keyword hit wins; order matters, so
 * more specific/compound cues (e.g. "fried rice" → mixed dish) are checked before generic ones
 * (e.g. "rice" → carb staple). Unknown foods fall back to {@link FoodDensityCategory#GENERIC}.
 */
@Component
public class FoodCategoryClassifier {

    /**
     * Ordered keyword table. Earlier entries take precedence, so place compound/specific
     * cues (mixed dishes, dressings) ahead of the single-ingredient staples they contain.
     */
    private static final List<Map.Entry<FoodDensityCategory, List<String>>> KEYWORDS = List.of(
            Map.entry(FoodDensityCategory.FATS_DRESSING, List.of(
                    "olive oil", "butter", "margarine", "mayo", "mayonnaise", "dressing",
                    "vinaigrette", "gravy", "ghee", "lard", "aioli")),
            Map.entry(FoodDensityCategory.MIXED_DISH, List.of(
                    "fried rice", "stir fry", "buddha bowl", "poke bowl", "bento",
                    "burrito", "wrap", "casserole", "paella", "risotto", "biryani", "pilaf",
                    "jambalaya", "curry", "hash")),
            Map.entry(FoodDensityCategory.LIQUID_SOUP, List.of(
                    "soup", "stew", "broth", "chowder", "bisque", "ramen", "pho", "congee", "porridge")),
            Map.entry(FoodDensityCategory.LEAFY_VEG, List.of(
                    "salad", "lettuce", "spinach", "kale", "arugula", "greens", "coleslaw", "slaw",
                    "cabbage", "broccoli", "cauliflower")),
            Map.entry(FoodDensityCategory.GARNISH, List.of(
                    "garlic", "ginger", "cilantro", "parsley", "scallion", "green onion", "chive",
                    "herb", "chili", "chilli", "basil", "mint", "sprinkle", "garnish")),
            Map.entry(FoodDensityCategory.BEVERAGE, List.of(
                    "juice", "smoothie", "latte", "coffee", "espresso", "soda", "cola", "tea",
                    "cocktail", "beer", "wine", "lemonade", "shake")),
            // Protein mains and snacks are checked before dairy/fruit so a composite name keyed on
            // its snack/protein noun wins over an incidental dairy/fruit ingredient word — e.g.
            // "cheese crackers" -> SNACK (not DAIRY) and "apple chips" -> SNACK (not FRUIT), while
            // MEAT stays ahead of SNACK so "crab cake"/"egg roll" -> MEAT (not SNACK).
            Map.entry(FoodDensityCategory.MEAT_MAIN, List.of(
                    "chicken", "beef", "steak", "pork", "bacon", "sausage", "ham", "turkey",
                    "lamb", "fish", "salmon", "tuna", "shrimp", "prawn", "crab", "tofu", "egg",
                    "meatloaf", "meatball", "nugget", "fillet", "filet")),
            Map.entry(FoodDensityCategory.SNACK, List.of(
                    "chip", "crisp", "cracker", "puff", "nut", "almond", "cashew", "peanut", "cookie",
                    "biscuit", "muffin", "croissant", "donut", "doughnut", "pastry", "popcorn",
                    "pretzel", "granola", "bar", "cake", "brownie", "roll")),
            Map.entry(FoodDensityCategory.DAIRY, List.of(
                    "milk", "yogurt", "yoghurt", "cheese", "cream cheese", "cottage")),
            Map.entry(FoodDensityCategory.FRUIT, List.of(
                    "apple", "banana", "berry", "strawberry", "blueberry", "raspberry", "grape",
                    "grapefruit", "melon", "watermelon", "orange", "peach", "pear", "mango",
                    "pineapple", "kiwi", "plum", "cherry", "avocado", "fruit")),
            Map.entry(FoodDensityCategory.CARB_STAPLE, List.of(
                    "rice", "pasta", "noodle", "spaghetti", "bread", "toast", "bagel", "bun",
                    "potato", "fries", "mashed", "tortilla", "pancake", "waffle", "oatmeal",
                    "cereal", "quinoa", "couscous", "dumpling")));

    /**
     * Classify a food name into a density category.
     *
     * @param foodName free-text food name (nullable)
     * @return the best-matching category, or {@link FoodDensityCategory#GENERIC} if none match
     */
    public FoodDensityCategory classify(String foodName) {
        if (foodName == null || foodName.isBlank()) {
            return FoodDensityCategory.GENERIC;
        }
        // Normalize hyphens to spaces so "stir-fry" matches the "stir fry" cue.
        String name = foodName.toLowerCase().trim().replace('-', ' ');
        String[] tokens = name.split("[^a-z]+");
        for (Map.Entry<FoodDensityCategory, List<String>> entry : KEYWORDS) {
            for (String cue : entry.getValue()) {
                // Multi-word cues ("olive oil", "fried rice") match as a substring; single-word cues
                // match on WHOLE words only, so "butter" doesn't fire on "butterfly" and "tea" doesn't
                // hide inside "steak". Regular plurals are handled so "chip"→"chips" etc. still match.
                boolean hit = cue.indexOf(' ') >= 0 ? name.contains(cue) : matchesWord(tokens, cue);
                if (hit) {
                    return entry.getKey();
                }
            }
        }
        return FoodDensityCategory.GENERIC;
    }

    /** True if any token equals the cue or a regular plural of it (cats, boxes, berries, fries). */
    private static boolean matchesWord(String[] tokens, String cue) {
        for (String t : tokens) {
            if (t.isEmpty()) {
                continue;
            }
            if (t.equals(cue) || t.equals(cue + "s") || t.equals(cue + "es")) {
                return true;
            }
            if (cue.endsWith("y") && t.equals(cue.substring(0, cue.length() - 1) + "ies")) {
                return true; // berry→berries, cherry→cherries, fry→fries
            }
        }
        return false;
    }

    /**
     * Bulk density (g/cm³) for a food name via its category.
     */
    public double densityGramsPerCm3(String foodName) {
        return classify(foodName).getGramsPerCm3();
    }
}
