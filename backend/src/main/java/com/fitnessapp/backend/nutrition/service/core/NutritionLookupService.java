package com.fitnessapp.backend.nutrition.service.core;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fitnessapp.backend.nutrition.dto.FoodMetadata;
import com.fitnessapp.backend.nutrition.dto.NutritionInfo;
import com.fitnessapp.backend.nutrition.entity.FoodNutrition;
import com.fitnessapp.backend.nutrition.enums.CookingMethod;
import com.fitnessapp.backend.nutrition.repository.FoodNutritionRepository;
import com.fitnessapp.backend.nutrition.service.usda.UsdaFoodDataClient;
import com.fitnessapp.backend.nutrition.service.usda.UsdaNutritionCache;

import lombok.extern.slf4j.Slf4j;

/**
 * Service for looking up food nutrition data from the database.
 *
 * <p>Note: The USDA and food synonym tables were removed in V44, so lookups are now performed
 * against {@code food_nutrition} only (exact match, trigram similarity when available, and
 * keyword fallback).
 */
@Slf4j
@Service
public class NutritionLookupService {

    private final FoodNutritionRepository foodNutritionRepository;
    private final FoodKeyNormalizer foodKeyNormalizer;
    private final UsdaFoodDataClient usdaFoodDataClient;
    private final UsdaNutritionCache usdaNutritionCache;

    // Default nutrition for unknown foods (per 100g)
    private static final NutritionInfo DEFAULT_NUTRITION = NutritionInfo.builder()
            .calories(new java.math.BigDecimal("150.0"))
            .protein(new java.math.BigDecimal("8.0"))
            .fat(new java.math.BigDecimal("6.0"))
            .carbs(new java.math.BigDecimal("15.0"))
            .build();

    public NutritionLookupService(FoodNutritionRepository foodNutritionRepository,
                                  FoodKeyNormalizer foodKeyNormalizer) {
        this(foodNutritionRepository,
                foodKeyNormalizer,
                (UsdaFoodDataClient) null,
                (UsdaNutritionCache) null);
    }

    @Autowired
    public NutritionLookupService(FoodNutritionRepository foodNutritionRepository,
                                  FoodKeyNormalizer foodKeyNormalizer,
                                  ObjectProvider<UsdaFoodDataClient> usdaFoodDataClientProvider,
                                  ObjectProvider<UsdaNutritionCache> usdaNutritionCacheProvider) {
        this(foodNutritionRepository,
                foodKeyNormalizer,
                usdaFoodDataClientProvider.getIfAvailable(),
                usdaNutritionCacheProvider.getIfAvailable());
    }

    public NutritionLookupService(FoodNutritionRepository foodNutritionRepository,
                                  FoodKeyNormalizer foodKeyNormalizer,
                                  UsdaFoodDataClient usdaFoodDataClient,
                                  UsdaNutritionCache usdaNutritionCache) {
        this.foodNutritionRepository = foodNutritionRepository;
        this.foodKeyNormalizer = foodKeyNormalizer;
        this.usdaFoodDataClient = usdaFoodDataClient;
        this.usdaNutritionCache = usdaNutritionCache;
    }

    /**
     * Look up nutrition by food key with fallback strategies:
     * 1. NLP normalization and phrase mapping
     * 2. Exact match on food_key
     * 3. Fuzzy match on food_key (pg_trgm, with fallback to LIKE)
     * 4. Fuzzy match on display name (pg_trgm, with fallback to LIKE)
     * 5. USDA FoodData Central fallback
     * 6. Default nutrition
     */
    @Transactional(readOnly = true)
    public NutritionInfo lookupNutrition(String foodKey) {
        // Step 0: Use NLP normalizer for intelligent text processing
        String normalizedKey = foodKeyNormalizer.normalize(foodKey);
        log.debug("Looking up nutrition for: {} (normalized: {})", foodKey, normalizedKey);

        // Strategy 1: Exact match on food_key
        Optional<FoodNutrition> exactMatch = foodNutritionRepository.findByFoodKeyAndIsActiveTrue(normalizedKey);
        if (exactMatch.isPresent()) {
            log.debug("Found exact match for food_key: {}", normalizedKey);
            return toNutritionInfo(exactMatch.get());
        }

        // Strategy 2: Fuzzy match on food_key (with fallback)
        List<FoodNutrition> fuzzyMatches = findFoodKeySimilarSafe(normalizedKey, 1);
        if (!fuzzyMatches.isEmpty()) {
            FoodNutrition match = fuzzyMatches.get(0);
            log.info("Found fuzzy match for {}: {}", normalizedKey, match.getFoodKey());
            return toNutritionInfo(match);
        }

        // Strategy 3: Fuzzy match on display name (with fallback)
        List<FoodNutrition> fuzzyNameMatches = findDisplayNameSimilarSafe(normalizedKey, 1);
        if (!fuzzyNameMatches.isEmpty()) {
            FoodNutrition match = fuzzyNameMatches.get(0);
            log.info("Found fuzzy name match for {}: {}", normalizedKey, match.getFoodKey());
            return toNutritionInfo(match);
        }

        // Strategy 4: Keyword fallback (case-insensitive LIKE)
        List<FoodNutrition> keywordMatches = foodNutritionRepository.searchByKeyword(normalizedKey);
        if (!keywordMatches.isEmpty()) {
            return toNutritionInfo(keywordMatches.get(0));
        }

        // Strategy 5: USDA FoodData Central fallback
        Optional<NutritionInfo> usdaNutrition = lookupUsdaNutrition(normalizedKey);
        if (usdaNutrition.isPresent()) {
            log.info("Found USDA FoodData Central fallback for {}", normalizedKey);
            return usdaNutrition.get();
        }

        // Strategy 6: Default
        log.warn("No nutrition data found for: {}, using default", foodKey);
        return DEFAULT_NUTRITION;
    }

    /**
     * Look up nutrition using structured metadata from AI.
     * Uses dynamic search strategy with cooking method multipliers.
     * 
     * @param metadata Structured food metadata
     * @return Nutrition info with applied cooking multipliers if needed
     */
    @Transactional(readOnly = true)
    public NutritionInfo lookupNutritionWithMetadata(FoodMetadata metadata) {
        if (metadata == null) {
            log.warn("Null metadata provided, using default nutrition");
            return DEFAULT_NUTRITION;
        }

        log.debug("Looking up nutrition with metadata: base={}, form={}, method={}", 
                metadata.getBaseIngredient(), metadata.getForm(), metadata.getCookingMethodStr());

        List<String> searchCandidates = buildSearchCandidates(metadata);
        for (String candidate : searchCandidates) {
            Optional<NutritionInfo> candidateNutrition = lookupNutritionOptional(candidate);
            if (candidateNutrition.isEmpty()) {
                continue;
            }

            NutritionInfo nutrition = candidateNutrition.get();
            CookingMethod method = metadata.getCookingMethod();
            if (method != null && method != CookingMethod.UNKNOWN) {
                return applyCookingMethodMultiplier(nutrition, method);
            }

            return nutrition;
        }

        for (String candidate : searchCandidates) {
            String normalizedKey = foodKeyNormalizer.normalize(candidate);
            Optional<NutritionInfo> usdaNutrition = lookupUsdaNutrition(normalizedKey);
            if (usdaNutrition.isEmpty()) {
                continue;
            }

            NutritionInfo nutrition = usdaNutrition.get();
            CookingMethod method = metadata.getCookingMethod();
            if (method != null && method != CookingMethod.UNKNOWN) {
                return applyCookingMethodMultiplier(nutrition, method);
            }

            return nutrition;
        }

        return DEFAULT_NUTRITION;
    }

    private List<String> buildSearchCandidates(FoodMetadata metadata) {
        Set<String> candidates = new LinkedHashSet<>();

        if (metadata.getSearchTerms() != null) {
            for (String term : metadata.getSearchTerms()) {
                if (term != null && !term.trim().isEmpty()) {
                    candidates.add(term.trim());
                }
            }
        }

        if (metadata.getBaseIngredient() != null && !metadata.getBaseIngredient().trim().isEmpty()) {
            candidates.add(metadata.getBaseIngredient().trim());
        }

        if (metadata.getForm() != null && !metadata.getForm().trim().isEmpty()) {
            candidates.add(metadata.getForm().trim());
        }

        return new ArrayList<>(candidates);
    }

    private Optional<NutritionInfo> lookupNutritionOptional(String foodKey) {
        String normalizedKey = foodKeyNormalizer.normalize(foodKey);

        Optional<FoodNutrition> exactMatch = foodNutritionRepository.findByFoodKeyAndIsActiveTrue(normalizedKey);
        if (exactMatch.isPresent()) {
            return Optional.of(toNutritionInfo(exactMatch.get()));
        }

        List<FoodNutrition> fuzzyKeyMatches = findFoodKeySimilarSafe(normalizedKey, 1);
        if (!fuzzyKeyMatches.isEmpty()) {
            return Optional.of(toNutritionInfo(fuzzyKeyMatches.get(0)));
        }

        List<FoodNutrition> fuzzyNameMatches = findDisplayNameSimilarSafe(normalizedKey, 1);
        if (!fuzzyNameMatches.isEmpty()) {
            return Optional.of(toNutritionInfo(fuzzyNameMatches.get(0)));
        }

        List<FoodNutrition> keywordMatches = foodNutritionRepository.searchByKeyword(normalizedKey);
        if (!keywordMatches.isEmpty()) {
            return Optional.of(toNutritionInfo(keywordMatches.get(0)));
        }

        return Optional.empty();
    }

    private Optional<NutritionInfo> lookupUsdaNutrition(String normalizedKey) {
        if (normalizedKey == null || normalizedKey.isBlank()
                || usdaFoodDataClient == null
                || usdaNutritionCache == null
                || !usdaFoodDataClient.isAvailable()) {
            return Optional.empty();
        }

        NutritionInfo nutrition = usdaNutritionCache.get(
                normalizedKey,
                () -> usdaFoodDataClient.search(normalizedKey));
        return Optional.ofNullable(nutrition);
    }

    /**
     * Apply cooking method multiplier to base nutrition values.
     * Used when only raw/uncooked data is available.
     */
    private NutritionInfo applyCookingMethodMultiplier(NutritionInfo baseNutrition, CookingMethod method) {
        double multiplier = method.getCalorieMultiplier();
        
        log.info("Applying cooking method multiplier: {} ({}x)", method.getDisplayName(), multiplier);

        BigDecimal mult = BigDecimal.valueOf(multiplier);
        
        return NutritionInfo.builder()
                .calories(baseNutrition.getCalories().multiply(mult))
                .protein(baseNutrition.getProtein()) // Protein doesn't change much
                .fat(baseNutrition.getFat().multiply(mult)) // Fat increases with frying
                .carbs(baseNutrition.getCarbs().multiply(mult)) // Carbs can increase with breading
                .fiber(baseNutrition.getFiber())
                .sugar(baseNutrition.getSugar())
                .build();
    }

    /**
     * Fuzzy search food_key with fallback to LIKE query
     */
    private List<FoodNutrition> findFoodKeySimilarSafe(String query, int limit) {
        try {
            return foodNutritionRepository.findByFoodKeySimilar(query, limit);
        } catch (Exception e) {
            // pg_trgm not available (e.g., H2 in tests), fall back to LIKE search
            log.debug("Trigram search not available, using LIKE fallback: {}", e.getMessage());
            return foodNutritionRepository.searchByKeyword(query).stream()
                    .limit(limit)
                    .toList();
        }
    }

    /**
     * Fuzzy search display_name with fallback
     */
    private List<FoodNutrition> findDisplayNameSimilarSafe(String query, int limit) {
        try {
            return foodNutritionRepository.findByDisplayNameSimilar(query, limit);
        } catch (Exception e) {
            log.debug("Trigram search not available for display name, using LIKE fallback: {}", e.getMessage());
            return foodNutritionRepository.searchByKeyword(query).stream()
                    .limit(limit)
                    .toList();
        }
    }

    /**
     * Resolve food key to canonical form using synonyms
     * Returns original key if no synonym found
     */
    @Transactional(readOnly = true)
    public String resolveCanonicalKey(String foodKey) {
        return foodKeyNormalizer.normalize(foodKey);
    }

    /**
     * Check if nutrition exists for a food key (including synonyms)
     */
    @Transactional(readOnly = true)
    public boolean hasNutrition(String foodKey) {
        String normalizedKey = foodKeyNormalizer.normalize(foodKey);
        return foodNutritionRepository.findByFoodKeyAndIsActiveTrue(normalizedKey).isPresent();
    }

    /**
     * Get all food items (for admin)
     */
    @Transactional(readOnly = true)
    public List<FoodNutrition> getAllFoods() {
        return foodNutritionRepository.findByIsActiveTrueOrderByFoodKey();
    }

    /**
     * Search foods by keyword
     */
    @Transactional(readOnly = true)
    public List<FoodNutrition> searchFoods(String keyword) {
        return foodNutritionRepository.searchByKeyword(keyword);
    }

    /**
     * Get distinct categories
     */
    @Transactional(readOnly = true)
    public List<String> getCategories() {
        return foodNutritionRepository.findDistinctCategories();
    }

    /**
     * Convert entity to DTO
     */
    private NutritionInfo toNutritionInfo(FoodNutrition entity) {
        return NutritionInfo.builder()
                .calories(entity.getCalories() != null ? entity.getCalories() : java.math.BigDecimal.ZERO)
                .protein(entity.getProtein() != null ? entity.getProtein() : java.math.BigDecimal.ZERO)
                .fat(entity.getFat() != null ? entity.getFat() : java.math.BigDecimal.ZERO)
                .carbs(entity.getCarbs() != null ? entity.getCarbs() : java.math.BigDecimal.ZERO)
                .fiber(entity.getFiber() != null ? entity.getFiber() : java.math.BigDecimal.ZERO)
                .sugar(entity.getSugar() != null ? entity.getSugar() : java.math.BigDecimal.ZERO)
                .build();
    }

}
