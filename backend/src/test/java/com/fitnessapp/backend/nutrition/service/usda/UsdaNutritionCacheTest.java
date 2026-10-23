package com.fitnessapp.backend.nutrition.service.usda;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.fitnessapp.backend.nutrition.dto.NutritionInfo;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

@ExtendWith(MockitoExtension.class)
class UsdaNutritionCacheTest {

    @Mock
    private RedisTemplate<String, NutritionInfo> redisTemplate;

    @Mock
    private ValueOperations<String, NutritionInfo> valueOperations;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Test
    void l1HitReturnsCachedValueWithoutCallingLoaderAgain() {
        UsdaNutritionCache cache = cacheWithoutRedis();
        AtomicInteger loaderCalls = new AtomicInteger();
        NutritionInfo loaded = nutrition(52);

        NutritionInfo first = cache.get("apple", () -> {
            loaderCalls.incrementAndGet();
            return Optional.of(loaded);
        });
        NutritionInfo second = cache.get("apple", () -> {
            loaderCalls.incrementAndGet();
            return Optional.of(nutrition(99));
        });

        assertThat(first).isSameAs(loaded);
        assertThat(second).isSameAs(loaded);
        assertThat(loaderCalls).hasValue(1);
        assertThat(cache.stats().hitCount()).isEqualTo(1);
    }

    @Test
    void l2HitPopulatesL1() {
        UsdaNutritionCache cache = cacheWithRedis();
        NutritionInfo cached = nutrition(89);
        when(valueOperations.get("usda:v1:banana")).thenReturn(cached);

        NutritionInfo first = cache.get("banana", Optional::empty);
        NutritionInfo second = cache.get("banana", Optional::empty);

        assertThat(first).isSameAs(cached);
        assertThat(second).isSameAs(cached);
        verify(valueOperations).get("usda:v1:banana");
        verifyNoMoreInteractions(valueOperations);
        assertThat(cache.stats().hitCount()).isEqualTo(1);
    }

    @Test
    void fullMissCallsLoaderOnceAndPopulatesBothLevels() {
        UsdaNutritionCache cache = cacheWithRedis();
        AtomicInteger loaderCalls = new AtomicInteger();
        NutritionInfo loaded = nutrition(57);
        when(valueOperations.get("usda:v1:pear")).thenReturn(null);

        NutritionInfo first = cache.get("pear", () -> {
            loaderCalls.incrementAndGet();
            return Optional.of(loaded);
        });
        NutritionInfo second = cache.get("pear", () -> {
            loaderCalls.incrementAndGet();
            return Optional.of(nutrition(100));
        });

        assertThat(first).isSameAs(loaded);
        assertThat(second).isSameAs(loaded);
        assertThat(loaderCalls).hasValue(1);
        verify(valueOperations).set(eq("usda:v1:pear"), eq(loaded), eq(Duration.ofDays(7)));
    }

    @Test
    void nullRedisTemplateStillUsesLoaderAndL1() {
        UsdaNutritionCache cache = cacheWithoutRedis();
        AtomicInteger loaderCalls = new AtomicInteger();
        NutritionInfo loaded = nutrition(47);

        NutritionInfo first = cache.get("orange", () -> {
            loaderCalls.incrementAndGet();
            return Optional.of(loaded);
        });
        NutritionInfo second = cache.get("orange", () -> {
            loaderCalls.incrementAndGet();
            return Optional.empty();
        });

        assertThat(first).isSameAs(loaded);
        assertThat(second).isSameAs(loaded);
        assertThat(loaderCalls).hasValue(1);
    }

    private UsdaNutritionCache cacheWithRedis() {
        return new UsdaNutritionCache(redisTemplate, 2_000, Duration.ofHours(12), Duration.ofDays(7));
    }

    private UsdaNutritionCache cacheWithoutRedis() {
        return new UsdaNutritionCache(null, 2_000, Duration.ofHours(12), Duration.ofDays(7));
    }

    private NutritionInfo nutrition(int calories) {
        return NutritionInfo.builder()
                .calories(BigDecimal.valueOf(calories))
                .protein(BigDecimal.ONE)
                .fat(BigDecimal.ONE)
                .carbs(BigDecimal.ONE)
                .fiber(BigDecimal.ZERO)
                .sugar(BigDecimal.ZERO)
                .build();
    }
}
