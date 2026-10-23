package com.fitnessapp.backend.nutrition.service.usda;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fitnessapp.backend.nutrition.dto.NutritionInfo;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import okhttp3.ConnectionPool;
import okhttp3.Dispatcher;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class UsdaFoodDataClient {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(2);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(4);

    private final ObjectMapper objectMapper;
    private final OkHttpClient httpClient;
    private final boolean enabled;
    private final String apiKey;
    private final String searchUrl;

    public UsdaFoodDataClient(
            ObjectMapper objectMapper,
            @Value("${usda.enabled:true}") boolean enabled,
            @Value("${usda.api-key:}") String apiKey,
            @Value("${usda.base-url:https://api.nal.usda.gov/fdc}") String baseUrl) {
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.searchUrl = buildSearchUrl(baseUrl);
        this.httpClient = buildHttpClient();
    }

    public boolean isAvailable() {
        return enabled && !apiKey.isBlank();
    }

    public Optional<NutritionInfo> search(String food) {
        if (!isAvailable() || food == null || food.isBlank()) {
            return Optional.empty();
        }

        HttpUrl parsedUrl = HttpUrl.parse(searchUrl);
        if (parsedUrl == null) {
            log.warn("USDA base URL is invalid: {}", searchUrl);
            return Optional.empty();
        }

        HttpUrl url = parsedUrl.newBuilder()
                .addQueryParameter("query", food)
                .addQueryParameter("pageSize", "1")
                .addQueryParameter("api_key", apiKey)
                .build();

        Request request = new Request.Builder()
                .url(url)
                .get()
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            String responseBody = response.body() != null ? response.body().string() : "";
            if (!response.isSuccessful()) {
                log.debug("USDA FoodData Central returned status {} for {}", response.code(), food);
                return Optional.empty();
            }
            return parseNutritionInfo(responseBody, objectMapper);
        } catch (Exception ex) {
            log.debug("USDA FoodData Central lookup failed for {}", food, ex);
            return Optional.empty();
        }
    }

    static Optional<NutritionInfo> parseNutritionInfo(String json, ObjectMapper objectMapper) {
        if (json == null || json.isBlank()) {
            return Optional.empty();
        }

        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode foods = root.path("foods");
            if (!foods.isArray() || foods.isEmpty()) {
                return Optional.empty();
            }

            JsonNode nutrients = foods.get(0).path("foodNutrients");
            if (!nutrients.isArray() || nutrients.isEmpty()) {
                return Optional.empty();
            }

            BigDecimal calories = null;
            BigDecimal protein = null;
            BigDecimal fat = null;
            BigDecimal carbs = null;
            BigDecimal fiber = null;
            BigDecimal sugar = null;

            for (JsonNode nutrient : nutrients) {
                BigDecimal value = readBigDecimal(nutrient.path("value"));
                if (value == null) {
                    continue;
                }

                int nutrientId = nutrient.path("nutrientId").asInt(-1);
                String nutrientName = nutrient.path("nutrientName").asText("").toLowerCase(Locale.ROOT);

                if (nutrientId == 1008 || nutrientName.equals("energy")) {
                    calories = value;
                } else if (nutrientId == 1003 || nutrientName.contains("protein")) {
                    protein = value;
                } else if (nutrientId == 1004
                        || nutrientName.contains("total fat")
                        || nutrientName.contains("total lipid")) {
                    fat = value;
                } else if (nutrientId == 1005 || nutrientName.startsWith("carbohydrate")) {
                    carbs = value;
                } else if (nutrientId == 1079 || nutrientName.contains("fiber")) {
                    fiber = value;
                } else if (nutrientId == 2000 || nutrientName.contains("sugar")) {
                    sugar = value;
                }
            }

            if (calories == null && protein == null && fat == null && carbs == null && fiber == null && sugar == null) {
                return Optional.empty();
            }

            return Optional.of(NutritionInfo.builder()
                    .calories(valueOrZero(calories))
                    .protein(valueOrZero(protein))
                    .fat(valueOrZero(fat))
                    .carbs(valueOrZero(carbs))
                    .fiber(valueOrZero(fiber))
                    .sugar(valueOrZero(sugar))
                    .build());
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private static BigDecimal readBigDecimal(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (node.isNumber()) {
            return node.decimalValue();
        }
        if (node.isTextual() && !node.asText().isBlank()) {
            try {
                return new BigDecimal(node.asText().trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static BigDecimal valueOrZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private static String buildSearchUrl(String baseUrl) {
        String normalizedBase = (baseUrl == null || baseUrl.isBlank())
                ? "https://api.nal.usda.gov/fdc"
                : baseUrl.trim();
        while (normalizedBase.endsWith("/")) {
            normalizedBase = normalizedBase.substring(0, normalizedBase.length() - 1);
        }
        if (normalizedBase.endsWith("/v1/foods/search")) {
            return normalizedBase;
        }
        if (normalizedBase.endsWith("/v1")) {
            return normalizedBase + "/foods/search";
        }
        return normalizedBase + "/v1/foods/search";
    }

    private static OkHttpClient buildHttpClient() {
        Dispatcher dispatcher = new Dispatcher();
        dispatcher.setMaxRequests(64);
        dispatcher.setMaxRequestsPerHost(16);
        return new OkHttpClient.Builder()
                .dispatcher(dispatcher)
                .connectionPool(new ConnectionPool(16, 5, TimeUnit.MINUTES))
                .connectTimeout(CONNECT_TIMEOUT)
                .readTimeout(READ_TIMEOUT)
                .writeTimeout(READ_TIMEOUT)
                .build();
    }
}
