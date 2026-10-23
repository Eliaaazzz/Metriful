package com.fitnessapp.backend.nutrition.service.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

import javax.imageio.ImageIO;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.mock.web.MockMultipartFile;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fitnessapp.backend.nutrition.dto.FoodRecognitionRequestMetadata;
import com.fitnessapp.backend.nutrition.dto.FoodRecognitionResult;
import com.fitnessapp.backend.nutrition.exception.FoodRecognitionException;

/**
 * Unit tests for GeminiMealAnalysisService.
 *
 * Tests the AI-native meal analysis using Gemini. Capture-quality / EXIF-orientation /
 * structured-output behaviour lives in {@link GeminiCaptureQualityTest}.
 */
class GeminiServiceTest {

    private static final String DEFAULT_MODEL = "gemini-2.5-flash";
    private static final String TEST_PROJECT_ID = "test-project";
    private static final String TEST_REGION = "australia-southeast2";

    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
    }

    @Test
    void testServiceNotAvailableWithoutApiKey() {
        GeminiMealAnalysisService service = newService("");
        assertThat(service.isAvailable()).isFalse();
    }

    @Test
    void testServiceAvailableWithApiKey() {
        GeminiMealAnalysisService service = newService("test-api-key");
        assertThat(service.isAvailable()).isTrue();
    }

    @Test
    void testProviderInterface() {
        GeminiMealAnalysisService service = newService("test-api-key");
        assertThat(service.getProviderName()).isEqualTo("gemini");
        assertThat(service.getModelName()).isEqualTo(DEFAULT_MODEL);
        assertThat(service.getPriority()).isEqualTo(10);
    }

    @Test
    void testModelIsHardcoded() {
        GeminiMealAnalysisService service = newService("test-api-key");
        assertThat(service.getModelName()).isEqualTo(DEFAULT_MODEL);
    }

    @Test
    void testRecognizeFoodsThrowsWhenNotConfigured() {
        GeminiMealAnalysisService service = newService("");
        assertThrows(FoodRecognitionException.class, () -> {
            service.recognizeFoods("base64image", "image/jpeg");
        });
    }

    @Test
    void testOptimizeImageBypassesHeicOptimization() {
        GeminiMealAnalysisService service = newService("test-api-key");
        String base64Image = Base64.getEncoder().encodeToString("fake-heic".getBytes());

        // HEIC isn't decodable by ImageIO; the service must forward the original bytes untouched.
        var optimized = service.optimizeImage(base64Image, "image/heic");

        assertThat(optimized.base64()).isEqualTo(base64Image);
        assertThat(optimized.mediaType()).isEqualTo("image/heic");
        assertThat(optimized.quality()).isNull();
    }

    @Test
    void testOptimizeImageConvertsLargePngToJpeg() throws Exception {
        GeminiMealAnalysisService service = newService("test-api-key");
        BufferedImage image = new BufferedImage(2000, 1200, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        String base64Image = Base64.getEncoder().encodeToString(output.toByteArray());

        var optimized = service.optimizeImage(base64Image, "image/png");
        byte[] optimizedBytes = Base64.getDecoder().decode(optimized.base64());

        assertThat(optimized.base64()).isNotEqualTo(base64Image);
        assertThat(optimized.mediaType()).isEqualTo("image/jpeg");
        assertThat(optimizedBytes)
                .hasSizeGreaterThan(3)
                .startsWith((byte) 0xFF, (byte) 0xD8, (byte) 0xFF);
        // Downscaled to <=1024 on the long edge while keeping aspect ratio.
        BufferedImage decoded = ImageIO.read(new java.io.ByteArrayInputStream(optimizedBytes));
        assertThat(decoded.getWidth()).isEqualTo(1024);
        assertThat(decoded.getHeight()).isEqualTo(614);
    }

    @Test
    void testNormalizeContentTypeStripsParametersAndAliasesJpg() {
        assertThat(GeminiMealAnalysisService.normalizeContentType("image/jpg; charset=binary"))
                .isEqualTo("image/jpeg");
        assertThat(GeminiMealAnalysisService.normalizeContentType("image/x-png"))
                .isEqualTo("image/png");
    }

    @Test
    void testInferContentTypeFromFilenameSupportsCommonExtensions() {
        assertThat(GeminiMealAnalysisService.inferContentTypeFromFilename("meal.HEIC"))
                .isEqualTo("image/heic");
        assertThat(GeminiMealAnalysisService.inferContentTypeFromFilename("plate.jpeg"))
                .isEqualTo("image/jpeg");
        assertThat(GeminiMealAnalysisService.inferContentTypeFromFilename("unknown.bin"))
                .isNull();
    }

    /**
     * Integration test - only runs when GEMINI_API_KEY is set
     */
    @Test
    @EnabledIfEnvironmentVariable(named = "GEMINI_API_KEY", matches = ".+")
    void testRealApiIntegration() {
        String apiKey = System.getenv("GEMINI_API_KEY");
        GeminiMealAnalysisService service = newService(apiKey);

        assertThat(service.isAvailable()).isTrue();
        assertThat(service.getProviderName()).isEqualTo("gemini");
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "GEMINI_API_KEY", matches = ".+")
    @EnabledIfEnvironmentVariable(named = "TEST_MEAL_IMAGE", matches = ".+")
    void testRealImageRecognition() throws Exception {
        GeminiMealAnalysisService service = newService(System.getenv("GEMINI_API_KEY"));
        Path imagePath = Path.of(System.getenv("TEST_MEAL_IMAGE"));
        byte[] imageBytes = Files.readAllBytes(imagePath);

        MockMultipartFile image = new MockMultipartFile(
                "image",
                imagePath.getFileName().toString(),
                "image/jpeg",
                imageBytes);

        FoodRecognitionResult result = service.recognizeFoods(
                image,
                FoodRecognitionRequestMetadata.builder().imageWidthCm(35.5).build());

        assertThat(result).isNotNull();
        assertThat(result.getItems()).isNotNull().isNotEmpty();
    }

    private GeminiMealAnalysisService newService(String apiKey) {
        // 7th arg: structured-output enabled (matches production default).
        // 8th arg: thinking-budget 0 = reasoning disabled (fast interactive path).
        return new GeminiMealAnalysisService(
                objectMapper,
                apiKey,
                "",
                false,
                TEST_PROJECT_ID,
                TEST_REGION,
                true,
                0);
    }
}
