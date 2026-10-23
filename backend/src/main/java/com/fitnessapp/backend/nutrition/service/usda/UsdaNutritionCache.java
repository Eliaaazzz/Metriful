package com.fitnessapp.backend.nutrition.service.usda;

import com.fitnessapp.backend.nutrition.dto.NutritionInfo;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.stats.CacheStats;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class UsdaNutritionCache {

    private static final String REDIS_KEY_PREFIX = "usda:v1:";

    private final Cache<String, NutritionInfo> l1Cache;
    private final RedisTemplate<String, NutritionInfo> redisTemplate;
    private final Duration l2Ttl;

    public UsdaNutritionCache(
            @Autowired(required = false) RedisTemplate<String, NutritionInfo> redisTemplate,
            @Value("${usda.cache.l1.maximum-size:2000}") long l1MaximumSize,
            @Value("${usda.cache.l1.expire-after-write:12h}") Duration l1Ttl,
            @Value("${usda.cache.l2.ttl:7d}") Duration l2Ttl) {
        this.redisTemplate = redisTemplate;
        this.l2Ttl = l2Ttl;
        this.l1Cache = Caffeine.newBuilder()
                .maximumSize(l1MaximumSize)
                .expireAfterWrite(l1Ttl)
                .recordStats()
                .build();
    }

    public NutritionInfo get(String key, Supplier<Optional<NutritionInfo>> loader) {
        String normalizedKey = normalizeKey(key);
        if (normalizedKey.isBlank()) {
            return null;
        }

        NutritionInfo l1Value = l1Cache.getIfPresent(normalizedKey);
        if (l1Value != null) {
            return l1Value;
        }

        String redisKey = REDIS_KEY_PREFIX + normalizedKey;
        NutritionInfo l2Value = getFromRedis(redisKey);
        if (l2Value != null) {
            l1Cache.put(normalizedKey, l2Value);
            return l2Value;
        }

        Optional<NutritionInfo> loaded = loader.get();
        if (loaded.isEmpty()) {
            return null;
        }

        NutritionInfo value = loaded.get();
        l1Cache.put(normalizedKey, value);
        putInRedis(redisKey, value);
        return value;
    }

    public CacheStats stats() {
        return l1Cache.stats();
    }

    private NutritionInfo getFromRedis(String redisKey) {
        if (redisTemplate == null) {
            return null;
        }
        try {
            return redisTemplate.opsForValue().get(redisKey);
        } catch (Exception ex) {
            log.debug("USDA Redis L2 read failed for {}", redisKey, ex);
            return null;
        }
    }

    private void putInRedis(String redisKey, NutritionInfo value) {
        if (redisTemplate == null) {
            return;
        }
        try {
            redisTemplate.opsForValue().set(redisKey, value, l2Ttl);
        } catch (Exception ex) {
            log.debug("USDA Redis L2 write failed for {}", redisKey, ex);
        }
    }

    private String normalizeKey(String key) {
        return key == null ? "" : key.trim().toLowerCase(Locale.ROOT);
    }
}
