
package com.fitnessapp.backend.nutrition.service.ai;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InterruptedIOException;
import java.math.BigDecimal;
import java.net.ConnectException;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.MemoryCacheImageOutputStream;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fitnessapp.backend.nutrition.dto.FoodRecognitionResult;
import com.fitnessapp.backend.nutrition.dto.FoodRecognitionRequestMetadata;
import com.fitnessapp.backend.nutrition.dto.NutritionInfo;
import com.fitnessapp.backend.nutrition.dto.RecognizedFood;
import com.fitnessapp.backend.nutrition.exception.FoodRecognitionException;
import com.google.auth.oauth2.GoogleCredentials;

import lombok.extern.slf4j.Slf4j;
import okhttp3.ConnectionPool;
import okhttp3.Dispatcher;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * Gemini 3 Pro Food Recognition Provider
 * 
 * Implements FoodRecognitionProvider for strategy pattern.
 * Uses Gemini 3 Pro for AI-powered food recognition and nutrition analysis.
 */
@Slf4j
@Service
public class GeminiMealAnalysisService implements FoodRecognitionProvider {

    static {
        ImageIO.setUseCache(false);
    }

    private static final String PROVIDER_NAME = "gemini";
    // Benchmarked on Nutrition5k: gemini-2.5-flash with reasoning disabled roughly halves calorie
    // error vs 2.0-flash/flash-lite (~51%→~34% median) at the SAME ~4s latency — see
    // docs/calorie-accuracy-investigation.md §7 rec #1. 2.5 thinking-on bought latency, not accuracy.
    private static final String DEFAULT_MODEL = "gemini-2.5-flash";

    // Must be large enough for multi-dish scenes with many items; truncated JSON causes parse failures.
    private static final int MAX_OUTPUT_TOKENS = 4096;
    // Meal capture is an interactive UX path — target <10s total response.
    // Aggressive timeouts: fail fast and retry quickly rather than stalling.
    private static final int PRIMARY_TIMEOUT_SECONDS = 8;
    private static final int RETRY_TIMEOUT_SECONDS = 6;
    private static final int MAX_ATTEMPTS = 2;
    private static final long TRANSIENT_RETRY_DELAY_MS = 200L;
    // Hedged request: if primary doesn't respond within this time, fire a parallel request.
    // Most Gemini calls return in <2s; hedging at 2s catches tail latency without wasting API calls.
    private static final long HEDGE_DELAY_MS = 2000L;
    private static final long MAX_IMAGE_SIZE = 10L * 1024 * 1024;
    private static final Set<String> SUPPORTED_IMAGE_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/heic",
            "image/heif"
    );
    private static final Set<String> IMAGEIO_UNSUPPORTED_BUT_GEMINI_SUPPORTED_TYPES = Set.of(
            "image/heic",
            "image/heif"
    );

    // Capture-quality thresholds (Apple/Google "assess capture quality before inference" best practice).
    // Heuristic and intentionally conservative; they only attach a hint to the prompt — never hard-reject.
    private static final int LOW_LIGHT_BRIGHTNESS_THRESHOLD = 55;   // mean luma, 0-255
    private static final double BLUR_SHARPNESS_THRESHOLD = 80.0;    // Laplacian variance on sampled luma

    // Controlled-generation schema (Google Vertex AI "structured output" best practice).
    // Guarantees well-typed JSON and — via propertyOrdering — a stable field order on every call,
    // which removes the output drift that previously varied with lighting / camera angle.
    // Package-private (not private) so same-package unit tests can assert the schema is well-formed.
    static final String RESPONSE_SCHEMA = """
            {
              "type": "OBJECT",
              "properties": {
                "scene_type": {"type": "STRING", "enum": ["countable", "single_dish", "multi_dish"]},
                "foods": {
                  "type": "ARRAY",
                  "items": {
                    "type": "OBJECT",
                    "properties": {
                      "name": {"type": "STRING"},
                      "confidence": {"type": "NUMBER"},
                      "quantity": {"type": "NUMBER"},
                      "unit": {"type": "STRING", "enum": ["piece", "serving", "g", "bowl", "cup", "slice"]},
                      "weight_g": {"type": "NUMBER"},
                      "calories": {"type": "NUMBER"},
                      "protein_g": {"type": "NUMBER"},
                      "carbs_g": {"type": "NUMBER"},
                      "fat_g": {"type": "NUMBER"},
                      "fiber_g": {"type": "NUMBER"},
                      "estimated_gi": {"type": "NUMBER"}
                    },
                    "required": ["name", "confidence", "quantity", "unit", "weight_g", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "estimated_gi"],
                    "propertyOrdering": ["name", "confidence", "quantity", "unit", "weight_g", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "estimated_gi"]
                  }
                }
              },
              "required": ["scene_type", "foods"],
              "propertyOrdering": ["scene_type", "foods"]
            }""";

    private final OkHttpClient httpClient;
    private final OkHttpClient retryHttpClient;
    private final ExecutorService hedgeExecutor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "gemini-hedge");
        t.setDaemon(true);
        return t;
    });
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;
    private final String geminiApiUrl;
    private final boolean useVertexAi;
    private final String gcpProjectId;
    private final String gcpRegion;
    private final boolean useStructuredOutput;
    // Gemini 2.5 "thinking" budget in tokens; 0 disables reasoning (fast path for the <5s interactive
    // budget). Only emitted for 2.5-family models — 2.0 rejects thinkingConfig. Configurable so a
    // future async "refine" path could raise it without a code change.
    private final int thinkingBudget;

    public GeminiMealAnalysisService(
            ObjectMapper objectMapper,
            @Value("${app.gemini.api-key:}") String apiKey,
            @Value("${app.gemini.model:gemini-2.5-flash}") String model,
            @Value("${app.gemini.use-vertex-ai:true}") boolean useVertexAi,
            @Value("${app.gemini.gcp-project-id:gen-lang-client-0295973830}") String gcpProjectId,
            @Value("${app.gemini.gcp-region:australia-southeast2}") String gcpRegion,
            @Value("${app.gemini.structured-output:true}") boolean useStructuredOutput,
            @Value("${app.gemini.thinking-budget:0}") int thinkingBudget
    ) {
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = (model == null || model.isBlank()) ? DEFAULT_MODEL : model.trim();
        this.useVertexAi = useVertexAi;
        this.gcpProjectId = gcpProjectId;
        this.gcpRegion = gcpRegion;
        this.useStructuredOutput = useStructuredOutput;
        this.thinkingBudget = thinkingBudget;

        if (useVertexAi) {
            // Vertex AI: uses Application Default Credentials (Cloud Run service account)
            // No API key needed — bills directly from GCP billing account
            this.geminiApiUrl = "https://" + gcpRegion + "-aiplatform.googleapis.com/v1/projects/"
                    + gcpProjectId + "/locations/" + gcpRegion
                    + "/publishers/google/models/" + this.model + ":generateContent";
            log.info("✅ GeminiMealAnalysisService initialized (Vertex AI): {} in {}", this.model, gcpRegion);
        } else {
            this.geminiApiUrl =
                    "https://generativelanguage.googleapis.com/v1beta/models/" + this.model + ":generateContent";
            if (apiKey == null || apiKey.isBlank()) {
                log.warn("⚠️ Gemini API key not configured");
            } else {
                log.info("✅ GeminiMealAnalysisService initialized (AI Studio): {}", this.model);
            }
        }

        this.httpClient = buildHttpClient(PRIMARY_TIMEOUT_SECONDS);
        this.retryHttpClient = buildHttpClient(RETRY_TIMEOUT_SECONDS);
    }

    // ==================== FoodRecognitionProvider Interface ====================

    @Override
    public String getProviderName() {
        return PROVIDER_NAME;
    }

    @Override
    public String getModelName() {
        return model;
    }

    @Override
    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public int getPriority() {
        return 10; // Highest priority - primary provider
    }

    @Override
    public FoodRecognitionResult recognizeFoods(MultipartFile image, FoodRecognitionRequestMetadata metadata) throws IOException {
        if (!isAvailable()) {
            throw new FoodRecognitionException("Gemini API key not configured");
        }

        if (image.getSize() > MAX_IMAGE_SIZE) {
            throw new IllegalArgumentException("Image too large. Max 10MB");
        }

        String contentType = normalizeContentType(image.getContentType());
        if (contentType == null || !SUPPORTED_IMAGE_TYPES.contains(contentType)) {
            String inferredContentType = inferContentTypeFromFilename(image.getOriginalFilename());
            if (SUPPORTED_IMAGE_TYPES.contains(inferredContentType)) {
                log.warn("Falling back to filename-inferred image type '{}' for upload '{}'",
                        inferredContentType, image.getOriginalFilename());
                contentType = inferredContentType;
            }
        }
        if (contentType == null || !SUPPORTED_IMAGE_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Unsupported image type: " + contentType);
        }

        long start = System.nanoTime();
        log.info("Gemini analyze start: imageBytes={}, contentType={}", image.getSize(), contentType);

        String base64Image = Base64.getEncoder().encodeToString(image.getBytes());
        long encodeMs = (System.nanoTime() - start) / 1_000_000;
        log.info("Gemini stage=base64_encode latencyMs={}, base64Chars={}", encodeMs, base64Image.length());

        FoodRecognitionResult result = recognizeFoods(base64Image, contentType, metadata);
        long totalMs = (System.nanoTime() - start) / 1_000_000;
        log.info("Gemini analyze completed totalLatencyMs={}", totalMs);
        return result;
    }

    @Override
    public FoodRecognitionResult recognizeFoods(String base64Image, String mediaType, FoodRecognitionRequestMetadata metadata) {
        long start = System.nanoTime();

        // Optimize image (resize + EXIF-orientation normalization) and assess capture quality
        // before sending to Gemini. Normalizing orientation makes the analysis invariant to the
        // angle the photo was taken at; the quality signal lets the model stay conservative on
        // dark/blurry frames instead of guessing.
        long compressStart = System.nanoTime();
        String normalizedMediaType = normalizeContentType(mediaType);
        OptimizedImage optimized = optimizeImage(base64Image, normalizedMediaType);
        long compressMs = (System.nanoTime() - compressStart) / 1_000_000;
        log.info("Gemini stage=image_optimize latencyMs={}, originalChars={}, optimizedChars={}, quality={}",
                compressMs, base64Image.length(), optimized.base64().length(), optimized.quality());

        try {
            return retryApiCall(optimized.base64(), optimized.mediaType(), metadata, optimized.quality(), 1, start).join();
        } catch (CompletionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof FoodRecognitionException fre) {
                throw fre;
            }
            throw new FoodRecognitionException("Failed after retries", cause);
        }
    }

    /**
     * Hedged request pattern (Google "The Tail at Scale"):
     * 1. Fire primary request immediately
     * 2. If no response after HEDGE_DELAY_MS, fire a parallel hedge request
     * 3. First to respond wins, other is cancelled
     *
     * This catches tail latency (slow node / GC / network jitter) by "re-rolling the dice"
     * on a different server-side node. Only ~5% extra API calls, but P99 latency drops 50%+.
     */
    private CompletableFuture<FoodRecognitionResult> retryApiCall(
            String image, String mediaType, FoodRecognitionRequestMetadata metadata,
            QualitySignal quality, int attempt, long startNanos) {

        AtomicBoolean settled = new AtomicBoolean(false);

        // Primary request
        CompletableFuture<FoodRecognitionResult> primary = CompletableFuture.supplyAsync(() -> {
            try {
                return executeApiCall(image, mediaType, metadata, quality, false);
            } catch (Exception e) {
                throw new CompletionException(e);
            }
        }, hedgeExecutor);

        // Hedged request: fires after HEDGE_DELAY_MS if primary hasn't returned.
        // Only hedges on slow responses (tail latency). If primary fails with 429
        // (rate limit), hedging would make it worse — so the hedge checks settled flag.
        CompletableFuture<FoodRecognitionResult> hedge = CompletableFuture
                .supplyAsync(() -> null,
                        CompletableFuture.delayedExecutor(HEDGE_DELAY_MS, TimeUnit.MILLISECONDS))
                .thenApplyAsync(v -> {
                    if (settled.get()) return null; // primary already done or failed with 429, skip
                    log.info("Gemini hedged request fired (primary slow after {}ms)", HEDGE_DELAY_MS);
                    try {
                        return executeApiCall(image, mediaType, metadata, quality, true);
                    } catch (Exception e) {
                        throw new CompletionException(e);
                    }
                }, hedgeExecutor);

        // Race: first to complete wins
        return primary.applyToEither(hedge, result -> {
            settled.set(true);
            long totalMs = (System.nanoTime() - startNanos) / 1_000_000;
            log.info("Gemini stage=complete totalLatencyMs={}", totalMs);
            return result;
        }).exceptionally(ex -> {
            Throwable cause = ex instanceof CompletionException ? ex.getCause() : ex;
            String msg = cause != null ? cause.getMessage() : "unknown";
            boolean isRateLimit = msg != null && msg.contains("429");

            // On 429: cancel hedge, don't retry — rate limiting means STOP sending requests.
            // Tell user to wait and try again.
            if (isRateLimit) {
                settled.set(true); // prevent hedge from firing
                log.warn("Gemini rate-limited (429). NOT retrying — hedging would make it worse.");
                throw new CompletionException(
                        new FoodRecognitionException("Rate limited by AI provider. Please wait a moment and try again.", cause));
            }

            boolean retryable = (cause instanceof Exception) && isRetryableException((Exception) cause);
            log.warn("Gemini hedged requests both failed (retryable={}): {}", retryable, msg);
            if (!retryable || attempt >= MAX_ATTEMPTS) {
                throw new CompletionException(
                        new FoodRecognitionException("Failed after " + attempt + " attempt(s)", cause));
            }
            // Last resort: one serial retry after short delay
            try { Thread.sleep(TRANSIENT_RETRY_DELAY_MS); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
            try {
                FoodRecognitionResult result = executeApiCall(image, mediaType, metadata, quality, true);
                long totalMs = (System.nanoTime() - startNanos) / 1_000_000;
                log.info("Gemini stage=complete (fallback retry) totalLatencyMs={}", totalMs);
                return result;
            } catch (Exception e2) {
                throw new CompletionException(
                        new FoodRecognitionException("Failed after " + (attempt + 1) + " attempt(s)", e2));
            }
        });
    }

    /**
     * Optimize the image for Gemini and assess capture quality. Best-effort: any failure falls
     * back to forwarding the original bytes, so behaviour is never worse than before.
     * Steps: (1) normalize EXIF orientation so results are invariant to camera angle;
     * (2) downscale to max 1024px for faster API calls; (3) score brightness + sharpness.
     * Gemini doesn't need full resolution for food recognition.
     * 
     * IMPORTANT: Java ImageIO does not decode HEIC/HEIF out of the box.
     * Gemini supports those MIME types directly, so we bypass local optimization for them.
     * For other formats we keep the whole transcode path in memory to avoid Cloud Run temp-file
     * cache issues inside ImageIO.
     */
    OptimizedImage optimizeImage(String base64Image, String mediaType) {
        if (mediaType != null && IMAGEIO_UNSUPPORTED_BUT_GEMINI_SUPPORTED_TYPES.contains(mediaType)) {
            log.info("Skipping backend image optimization for {} and forwarding original bytes to Gemini", mediaType);
            return new OptimizedImage(base64Image, mediaType, null);
        }

        try {
            byte[] imageBytes = Base64.getDecoder().decode(base64Image);
            log.info("🖼️ Attempting to decode image: {} bytes", imageBytes.length);

            BufferedImage decoded = decodeImage(imageBytes);
            if (decoded == null) {
                // ImageIO.read() returns null for unsupported formats (HEIC, some iPhone JPEGs)
                log.warn("⚠️ ImageIO.read() returned null - unsupported image format! " +
                        "This usually means HEIC format or corrupted image. " +
                        "First 4 bytes (magic number): {}", bytesToHex(imageBytes, 4));
                log.warn("Forwarding original bytes to Gemini because local optimization could not decode the image");
                return new OptimizedImage(base64Image, mediaType, null);
            }

            // 1) Normalize EXIF orientation so the analysis is invariant to the camera angle the
            //    photo was taken at (ImageIO ignores EXIF orientation by default). No-op for orientation 1.
            int orientation = readExifOrientation(imageBytes);
            BufferedImage upright = applyOrientation(decoded, orientation);

            int ow = upright.getWidth();
            int oh = upright.getHeight();
            int maxDim = 1024;

            // 2) Target dimensions — downscale only, preserve aspect ratio.
            int tw = ow;
            int th = oh;
            if (ow > maxDim || oh > maxDim) {
                if (ow >= oh) {
                    tw = maxDim;
                    th = Math.max(1, (int) Math.round(oh * ((double) maxDim / ow)));
                } else {
                    th = maxDim;
                    tw = Math.max(1, (int) Math.round(ow * ((double) maxDim / oh)));
                }
            }

            // Fast path: no rotation and no downscale needed — keep original bytes, just score quality.
            if (orientation == 1 && tw == ow && th == oh) {
                log.info("🖼️ Image already optimal size: {}x{}", ow, oh);
                return new OptimizedImage(base64Image, mediaType, assessQuality(upright));
            }

            BufferedImage out = new BufferedImage(tw, th, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = out.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(upright, 0, 0, tw, th, null);
            g.dispose();

            // 3) Score capture quality (brightness + sharpness) as a hint for the model.
            QualitySignal quality = assessQuality(out);
            byte[] optimizedBytes = encodeJpeg(out);
            String optimized = Base64.getEncoder().encodeToString(optimizedBytes);

            log.info("🗜️ Image optimized: {}x{} -> {}x{}, {} KB -> {} KB, exifOrientation={}, quality=[{}]",
                    decoded.getWidth(), decoded.getHeight(), tw, th,
                    imageBytes.length / 1024, optimizedBytes.length / 1024, orientation, quality);

            return new OptimizedImage(optimized, "image/jpeg", quality);

        } catch (Exception e) {
            log.error("Image optimization failed, using original", e);
            return new OptimizedImage(base64Image, mediaType, null);
        }
    }

    /**
     * Estimate capture quality from a decoded image: mean brightness (0-255) and sharpness
     * (variance of the Laplacian over a sampled luma grid). Sampling caps the cost regardless of
     * resolution. This is a hint only — it never rejects an image.
     */
    QualitySignal assessQuality(BufferedImage img) {
        try {
            int w = img.getWidth();
            int h = img.getHeight();
            if (w < 3 || h < 3) {
                return null;
            }
            int step = Math.max(1, Math.max(w, h) / 256);
            int gw = (w + step - 1) / step;
            int gh = (h + step - 1) / step;
            int[][] gray = new int[gh][gw];
            long sum = 0;
            int count = 0;
            for (int gy = 0, y = 0; gy < gh && y < h; gy++, y += step) {
                for (int gx = 0, x = 0; gx < gw && x < w; gx++, x += step) {
                    int rgb = img.getRGB(x, y);
                    int r = (rgb >> 16) & 0xFF;
                    int gC = (rgb >> 8) & 0xFF;
                    int b = rgb & 0xFF;
                    int lum = (int) Math.round(0.299 * r + 0.587 * gC + 0.114 * b);
                    gray[gy][gx] = lum;
                    sum += lum;
                    count++;
                }
            }
            int brightness = count > 0 ? (int) (sum / count) : 0;

            double lapSum = 0;
            double lapSqSum = 0;
            int lapN = 0;
            for (int y = 1; y < gh - 1; y++) {
                for (int x = 1; x < gw - 1; x++) {
                    int lap = gray[y - 1][x] + gray[y + 1][x] + gray[y][x - 1] + gray[y][x + 1] - 4 * gray[y][x];
                    lapSum += lap;
                    lapSqSum += (double) lap * lap;
                    lapN++;
                }
            }
            double sharpness = 0.0;
            if (lapN > 0) {
                double mean = lapSum / lapN;
                sharpness = (lapSqSum / lapN) - (mean * mean);
            }
            boolean lowLight = brightness < LOW_LIGHT_BRIGHTNESS_THRESHOLD;
            boolean blurry = sharpness < BLUR_SHARPNESS_THRESHOLD;
            return new QualitySignal(brightness, sharpness, lowLight, blurry);
        } catch (Exception e) {
            log.warn("Quality assessment failed (non-fatal): {}", e.getMessage());
            return null;
        }
    }

    /**
     * Reorient a decoded image to upright given an EXIF orientation (1-8) using an exact integer
     * pixel remap (validated against the standard EXIF transpose for all 8 orientations).
     */
    BufferedImage applyOrientation(BufferedImage src, int o) {
        if (o <= 1 || o > 8) {
            return src;
        }
        int w = src.getWidth();
        int h = src.getHeight();
        boolean swap = o >= 5;
        int dw = swap ? h : w;
        int dh = swap ? w : h;
        BufferedImage dst = new BufferedImage(dw, dh, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int nx = x;
                int ny = y;
                switch (o) {
                    case 2 -> { nx = w - 1 - x; ny = y; }
                    case 3 -> { nx = w - 1 - x; ny = h - 1 - y; }
                    case 4 -> { nx = x;         ny = h - 1 - y; }
                    case 5 -> { nx = y;         ny = x; }
                    case 6 -> { nx = h - 1 - y; ny = x; }
                    case 7 -> { nx = h - 1 - y; ny = w - 1 - x; }
                    case 8 -> { nx = y;         ny = w - 1 - x; }
                    default -> { }
                }
                dst.setRGB(nx, ny, src.getRGB(x, y));
            }
        }
        return dst;
    }

    /** Read the EXIF orientation tag (0x0112) from JPEG bytes; returns 1 (normal) if absent/unreadable. */
    int readExifOrientation(byte[] data) {
        try {
            if (data == null || data.length < 4) return 1;
            if ((data[0] & 0xFF) != 0xFF || (data[1] & 0xFF) != 0xD8) return 1; // not a JPEG
            int offset = 2;
            int len = data.length;
            while (offset + 4 <= len) {
                if ((data[offset] & 0xFF) != 0xFF) { offset++; continue; }
                int marker = data[offset + 1] & 0xFF;
                if (marker == 0xD9 || marker == 0xDA) break;                 // EOI / start of scan
                if (marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {  // standalone markers, no length
                    offset += 2;
                    continue;
                }
                int segLen = ((data[offset + 2] & 0xFF) << 8) | (data[offset + 3] & 0xFF);
                if (segLen < 2) return 1;
                int segStart = offset + 4;
                if (marker == 0xE1 && segStart + 6 <= len
                        && data[segStart] == 'E' && data[segStart + 1] == 'x'
                        && data[segStart + 2] == 'i' && data[segStart + 3] == 'f'
                        && data[segStart + 4] == 0) {
                    return parseExifOrientation(data, segStart + 6);
                }
                offset += 2 + segLen;
            }
        } catch (Exception ignored) {
            // any malformed metadata → treat as normal orientation
        }
        return 1;
    }

    private int parseExifOrientation(byte[] d, int tiff) {
        if (tiff + 8 > d.length) return 1;
        boolean little;
        int b0 = d[tiff] & 0xFF;
        int b1 = d[tiff + 1] & 0xFF;
        if (b0 == 0x49 && b1 == 0x49) little = true;        // 'II' little-endian
        else if (b0 == 0x4D && b1 == 0x4D) little = false;  // 'MM' big-endian
        else return 1;
        int ifd = tiff + readInt32(d, tiff + 4, little);
        if (ifd < tiff || ifd + 2 > d.length) return 1;
        int entries = readInt16(d, ifd, little);
        int p = ifd + 2;
        for (int i = 0; i < entries && p + 12 <= d.length; i++, p += 12) {
            int tag = readInt16(d, p, little);
            if (tag == 0x0112) { // Orientation
                int value = readInt16(d, p + 8, little);
                return (value >= 1 && value <= 8) ? value : 1;
            }
        }
        return 1;
    }

    private int readInt16(byte[] d, int o, boolean little) {
        int a = d[o] & 0xFF;
        int b = d[o + 1] & 0xFF;
        return little ? (b << 8) | a : (a << 8) | b;
    }

    private int readInt32(byte[] d, int o, boolean little) {
        int a = d[o] & 0xFF;
        int b = d[o + 1] & 0xFF;
        int c = d[o + 2] & 0xFF;
        int e = d[o + 3] & 0xFF;
        return little ? (e << 24) | (c << 16) | (b << 8) | a
                      : (a << 24) | (b << 16) | (c << 8) | e;
    }

    /** Capture-quality signal attached to the prompt so the model can react to poor frames. */
    record QualitySignal(int brightness, double sharpness, boolean lowLight, boolean blurry) {
        boolean lowQuality() {
            return lowLight || blurry;
        }

        @Override
        public String toString() {
            return String.format("brightness=%d sharpness=%.0f lowLight=%b blurry=%b",
                    brightness, sharpness, lowLight, blurry);
        }
    }

    /** Result of {@link #optimizeImage}: optimized bytes + media type + optional quality signal. */
    record OptimizedImage(String base64, String mediaType, QualitySignal quality) {}

    private BufferedImage decodeImage(byte[] imageBytes) throws IOException {
        try (ByteArrayInputStream inputStream = new ByteArrayInputStream(imageBytes)) {
            return ImageIO.read(inputStream);
        }
    }

    private byte[] encodeJpeg(BufferedImage image) throws IOException {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpg");
        if (!writers.hasNext()) {
            throw new IOException("JPEG writer not available");
        }

        ImageWriter writer = writers.next();
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                MemoryCacheImageOutputStream imageOutput = new MemoryCacheImageOutputStream(outputStream)) {
            writer.setOutput(imageOutput);

            ImageWriteParam params = writer.getDefaultWriteParam();
            if (params.canWriteCompressed()) {
                params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                params.setCompressionQuality(0.82f);
            }

            writer.write(null, new IIOImage(image, null, null), params);
            imageOutput.flush();
            return outputStream.toByteArray();
        } finally {
            writer.dispose();
        }
    }

    static String normalizeContentType(String mediaType) {
        if (mediaType == null || mediaType.isBlank()) {
            return null;
        }
        String normalized = mediaType.split(";")[0].trim().toLowerCase();
        return switch (normalized) {
            case "image/jpg", "image/pjpeg" -> "image/jpeg";
            case "image/x-png" -> "image/png";
            default -> normalized;
        };
    }

    static String inferContentTypeFromFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return null;
        }

        String normalized = filename.toLowerCase().trim();
        if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (normalized.endsWith(".png")) {
            return "image/png";
        }
        if (normalized.endsWith(".gif")) {
            return "image/gif";
        }
        if (normalized.endsWith(".webp")) {
            return "image/webp";
        }
        if (normalized.endsWith(".heic")) {
            return "image/heic";
        }
        if (normalized.endsWith(".heif")) {
            return "image/heif";
        }
        return null;
    }

    // ==================== API Implementation ====================

    private FoodRecognitionResult executeApiCall(
            String base64Image,
            String mediaType,
            FoodRecognitionRequestMetadata metadata,
            QualitySignal quality,
            boolean retryAttempt
    ) throws IOException {
        long start = System.nanoTime();
        String requestBody = buildRequestBody(base64Image, mediaType, metadata, quality);
        OkHttpClient client = retryAttempt ? retryHttpClient : httpClient;

        Request.Builder reqBuilder = new Request.Builder()
                .addHeader("content-type", "application/json")
                .post(RequestBody.create(requestBody, MediaType.parse("application/json")));

        if (useVertexAi) {
            // Vertex AI: OAuth2 Bearer token from Application Default Credentials
            try {
                GoogleCredentials credentials = GoogleCredentials.getApplicationDefault()
                        .createScoped("https://www.googleapis.com/auth/cloud-platform");
                credentials.refreshIfExpired();
                reqBuilder.url(geminiApiUrl)
                        .addHeader("Authorization", "Bearer " + credentials.getAccessToken().getTokenValue());
            } catch (IOException e) {
                throw new FoodRecognitionException("Failed to get GCP credentials", e);
            }
        } else {
            // AI Studio: API key as query parameter
            reqBuilder.url(geminiApiUrl + "?key=" + apiKey);
        }

        Request request = reqBuilder.build();

        try (Response response = client.newCall(request).execute()) {
            String responseBody = response.body() != null ? response.body().string() : "";
            long latencyMs = (System.nanoTime() - start) / 1_000_000;
            log.info("Gemini stage=api_call status={}, latencyMs={}, responseChars={}",
                    response.code(), latencyMs, responseBody.length());
            if (log.isDebugEnabled()) {
                String preview = responseBody.length() > 400 ? responseBody.substring(0, 400) + "..." : responseBody;
                log.debug("Gemini response preview: {}", preview);
            }

            if (!response.isSuccessful()) {
                log.error("Gemini API error ({}): {}", response.code(), responseBody);
                if (response.code() == 408 || response.code() == 429 || response.code() >= 500) {
                    throw new RetryableGeminiException("Transient Gemini API error: " + response.code());
                }
                // Extract meaningful error message from Gemini response for better diagnostics
                String detail = extractGeminiErrorMessage(responseBody);
                throw new FoodRecognitionException(
                        detail != null ? "Gemini error " + response.code() + ": " + detail
                                       : "API error: " + response.code());
            }

            long parseStart = System.nanoTime();
            FoodRecognitionResult parsed = parseResponse(responseBody);
            long parseMs = (System.nanoTime() - parseStart) / 1_000_000;
            log.info("Gemini stage=parse latencyMs={}, items={}",
                    parseMs, parsed.getItems() != null ? parsed.getItems().size() : 0);
            return parsed;
        }
    }

    String buildRequestBody(String base64Image, String mediaType, FoodRecognitionRequestMetadata metadata, QualitySignal quality) {
        String contextBlock = buildContextBlock(metadata, quality);

        // Compact prompt for low latency. The output STRUCTURE is enforced by responseSchema
        // (controlled generation), so we intentionally do NOT duplicate the schema here —
        // duplicating it lowers output quality per Google's structured-output guidance.
        // Keys must be English; values can match user language.
        String prompt = String.format("""
            You are a food-vision nutrition estimator.
            Return STRICT JSON only (no markdown, no prose) matching the provided response schema.
            Context: %s

            Rules:
            - Scale: when img_w_cm is present use it as the real-world image width to size portions;
              otherwise assume a 28cm plate width. Judge portions from physical scale, NOT from how
              much of the frame the food fills, so estimates stay stable across camera angle/distance.
            - Lighting: mentally white-balance and ignore shadows, color casts, plate glare and
              background; identify food by shape/texture, not color alone, so results stay stable
              across lighting.
            - If image_quality.low_quality is true (dark or blurry), be conservative and lower
              confidence instead of guessing.
            - scene_type:
              countable = mostly piece-count items (e.g. sushi/dumplings/wings)
              single_dish = one mixed dish, split into ingredients
              multi_dish = multiple distinct dishes, do not split each dish into ingredients
            - Do not include quantity text in name.
            - confidence in [0.0, 1.0].
            - unit: piece for countable, g for ingredient-level outputs, otherwise serving.
            - Nutrition should reflect visible oils/sauces (restaurant/oily food included).

            Analyze now.
            """, contextBlock);

        // Controlled generation: responseSchema guarantees a well-typed, stably-ordered JSON object
        // (Google Vertex AI structured-output best practice). Kept behind a config flag so it can be
        // disabled without a code change if a future model ever rejects it.
        String responseSchemaField = useStructuredOutput
                ? "\"responseSchema\": " + RESPONSE_SCHEMA + ",\n        "
                : "";

        // Disable Gemini 2.5 "thinking" for the interactive path: it added latency (~11s, breaks the
        // <5s budget) without improving calorie accuracy on this task. Only valid on 2.5-family models.
        String thinkingConfigField = isThinkingCapable(model)
                ? "\"thinkingConfig\": {\"thinkingBudget\": " + thinkingBudget + "},\n        "
                : "";

        // Flash model with deterministic generation (temperature 0) for stable JSON.
        return String.format("""
            {
              "contents": [{"parts": [
                {"inline_data": {"mime_type": "%s", "data": "%s"}},
                {"text": "%s"}
              ]}],
              "generationConfig": {
                "responseMimeType": "application/json",
                %s%s"maxOutputTokens": %d,
                "temperature": 0.0,
                "topP": 0.95,
                "topK": 40
              }
            }
            """, mediaType, base64Image, escapeJson(prompt), responseSchemaField, thinkingConfigField, MAX_OUTPUT_TOKENS);
    }

    /** thinkingConfig is only accepted by Gemini 2.5-family models; 2.0/1.5 reject it with HTTP 400. */
    static boolean isThinkingCapable(String model) {
        return model != null && model.contains("2.5");
    }

    /** Build the JSON context block (real-world scale hint + optional capture-quality signal). */
    String buildContextBlock(FoodRecognitionRequestMetadata metadata, QualitySignal quality) {
        StringBuilder sb = new StringBuilder("{");
        Double imgWcm = metadata != null ? metadata.resolveImageWidthCm() : null;
        boolean first = true;
        if (imgWcm != null) {
            // Locale.ROOT: this string is JSON sent to the API — a comma-decimal locale would
            // otherwise emit "img_w_cm": 35,5 and corrupt the request body.
            sb.append(String.format(java.util.Locale.ROOT, "\"img_w_cm\": %.1f", imgWcm));
            first = false;
        }
        if (quality != null) {
            if (!first) {
                sb.append(", ");
            }
            sb.append(String.format(java.util.Locale.ROOT,
                    "\"image_quality\": {\"brightness\": %d, \"sharpness\": %.0f, \"low_quality\": %b}",
                    quality.brightness(), quality.sharpness(), quality.lowQuality()));
        }
        sb.append("}");
        return sb.toString();
    }

    private FoodRecognitionResult parseResponse(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode candidates = root.path("candidates");

            if (!candidates.isArray() || candidates.isEmpty()) {
                log.error("Invalid Gemini response - no candidates. Full response: {}", responseBody);
                throw new FoodRecognitionException("Invalid Gemini response");
            }

            // Check finishReason for safety blocks or other issues
            JsonNode firstCandidate = candidates.get(0);
            String finishReason = firstCandidate.path("finishReason").asText("UNKNOWN");
            log.info("🤖 Gemini finishReason: {}", finishReason);
            
            if ("SAFETY".equals(finishReason)) {
                log.error("⚠️ Gemini blocked response due to SAFETY filter! " +
                        "The image may contain content the AI flagged as inappropriate.");
                throw new FoodRecognitionException("AI safety filter triggered - please try a different image");
            } else if ("RECITATION".equals(finishReason)) {
                log.warn("⚠️ Gemini blocked due to RECITATION (copyright concerns)");
            } else if (!"STOP".equals(finishReason) && !"UNKNOWN".equals(finishReason)) {
                log.warn("⚠️ Unexpected finishReason: {}", finishReason);
            }

            JsonNode parts = firstCandidate.path("content").path("parts");
            StringBuilder textBuilder = new StringBuilder();
            for (JsonNode part : parts) {
                if (part.has("text")) {
                    textBuilder.append(part.get("text").asText());
                }
            }

            String rawText = textBuilder.toString().trim();
            if (log.isDebugEnabled()) {
                String rawPreview = rawText.length() > 400 ? rawText.substring(0, 400) + "..." : rawText;
                log.debug("Gemini raw text preview: {}", rawPreview);
            }

            String json = extractJson(rawText);
            if (log.isDebugEnabled()) {
                String jsonPreview = json.length() > 400 ? json.substring(0, 400) + "..." : json;
                log.debug("Gemini extracted JSON preview: {}", jsonPreview);
            }

            JsonNode data = objectMapper.readTree(json);

            List<RecognizedFood> items = new ArrayList<>();
            String sceneType = data.path("scene_type").isTextual() ? data.path("scene_type").asText() : null;
            JsonNode foods = data.path("foods");
            log.debug("Foods node type={}, isEmpty={}", foods.getNodeType(), foods.isEmpty());
            
            int index = 0;
            for (JsonNode food : foods) {
                // Parse Smart Splitting format with intuitive units
                String name = food.path("name").asText("Unknown");
                int quantity = food.path("quantity").asInt(1);
                String unit = food.path("unit").asText("serving");
                int calories = food.path("calories").asInt(0);
                int weightG = food.path("weight_g").asInt(
                        food.path("grams").asInt(100)); // Fallback for legacy format
                int protein = food.path("protein_g").asInt(
                        food.path("protein").asInt(0));
                int carbs = food.path("carbs_g").asInt(
                        food.path("carbs").asInt(0));
                int fat = food.path("fat_g").asInt(
                        food.path("fat").asInt(0));
                int fiber = food.path("fiber_g").asInt(
                        food.path("fiber").asInt(0));
                int estimatedGi = food.path("estimated_gi").asInt(50);
                // Glycemic Load = (GI × net carbs per serving) / 100
                int netCarbs = Math.max(0, carbs - fiber);
                double glycemicLoad = (estimatedGi * netCarbs) / 100.0;
                double confidence = food.path("confidence").asDouble(0.85);
                boolean isRestaurantStyle = food.path("is_restaurant_style").asBoolean(false);
                String cookingNote = food.path("cooking_note").asText(null);
                String cookingMethod = food.path("cooking_method").asText(null);

                NutritionInfo nutrition = NutritionInfo.builder()
                        .calories(BigDecimal.valueOf(calories))
                        .protein(BigDecimal.valueOf(protein))
                        .carbs(BigDecimal.valueOf(carbs))
                        .fat(BigDecimal.valueOf(fat))
                        .fiber(BigDecimal.valueOf(fiber))
                        .glycemicIndex(estimatedGi)
                        .glycemicLoad(BigDecimal.valueOf(glycemicLoad).setScale(1, java.math.RoundingMode.HALF_UP))
                        .build();

                // Keep displayName clean - no quantity suffix!
                // Frontend will show "12 pieces" separately in the UI
                String displayName = name;

                RecognizedFood item = RecognizedFood.builder()
                        .foodKey(toFoodKey(name, index))
                        .displayName(displayName)
                        .estimatedGrams(weightG)
                        .unit(unit)
                        .quantity(quantity)  // Pass quantity to frontend!
                        .cookingMethod(cookingMethod)
                        .confidence(confidence)
                        .nutrition(nutrition)
                        .build();
                
                items.add(item);
                log.debug("Found: {} (qty={}, unit={}, {}g, {}kcal, restaurant={})", 
                        name, quantity, unit, weightG, calories, isRestaurantStyle);
                index++;
            }

            return FoodRecognitionResult.builder()
                    .items(items)
                    .sceneType(sceneType)
                    .build();

        } catch (IOException e) {
            log.error("Failed to parse Gemini response", e);
            throw new FoodRecognitionException("Parse error", e);
        }
    }

    private String extractJson(String text) {
        if (text == null) return "{}";
        text = text.trim();
        if (text.startsWith("```json")) text = text.substring(7);
        else if (text.startsWith("```")) text = text.substring(3);
        if (text.endsWith("```")) text = text.substring(0, text.length() - 3);
        text = text.trim();
        int start = text.indexOf("{");
        int end = text.lastIndexOf("}");
        if (start >= 0 && end > start) text = text.substring(start, end + 1);
        return text;
    }

    /**
     * Convert first N bytes to hex string for debugging image format.
     * Common magic numbers:
     * - JPEG: FF D8 FF
     * - PNG: 89 50 4E 47
     * - HEIC/HEIF: 00 00 00 xx 66 74 79 70 (ftyp at offset 4)
     * - WebP: 52 49 46 46 (RIFF)
     */
    private String bytesToHex(byte[] bytes, int maxBytes) {
        StringBuilder sb = new StringBuilder();
        int len = Math.min(bytes.length, maxBytes);
        for (int i = 0; i < len; i++) {
            sb.append(String.format("%02X ", bytes[i] & 0xFF));
        }
        return sb.toString().trim();
    }

    private String escapeJson(String text) {
        return text.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    private String toFoodKey(String name, int index) {
        String base = name == null ? "food" : name.toLowerCase()
                .trim()
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
        if (base.isBlank()) {
            base = "food";
        }
        return base + "_" + index;
    }

    private boolean isRetryableException(Exception exception) {
        Throwable current = exception;
        while (current != null) {
            if (current instanceof RetryableGeminiException
                    || current instanceof SocketTimeoutException
                    || current instanceof ConnectException
                    || current instanceof SocketException
                    || current instanceof UnknownHostException
                    || current instanceof InterruptedIOException) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    /**
     * Extract a human-readable error message from a Gemini API error response body.
     */
    private String extractGeminiErrorMessage(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode error = root.path("error");
            if (!error.isMissingNode()) {
                String message = error.path("message").asText(null);
                if (message != null && !message.isBlank()) {
                    return message;
                }
            }
        } catch (Exception ignored) {
            // Fall through
        }
        return null;
    }

    private static final class RetryableGeminiException extends IOException {
        private RetryableGeminiException(String message) {
            super(message);
        }
    }

    private OkHttpClient buildHttpClient(int timeoutSeconds) {
        // Raise OkHttp's dispatcher ceilings: the default maxRequestsPerHost=5 would throttle
        // concurrent calls to the single Gemini host under load (hedging doubles in-flight calls),
        // serializing requests and inflating tail latency. Reuse connections via a larger pool.
        Dispatcher dispatcher = new Dispatcher();
        dispatcher.setMaxRequests(256);
        dispatcher.setMaxRequestsPerHost(128);
        return new OkHttpClient.Builder()
                .dispatcher(dispatcher)
                .connectionPool(new ConnectionPool(64, 5, TimeUnit.MINUTES))
                .connectTimeout(Duration.ofSeconds(timeoutSeconds))
                .readTimeout(Duration.ofSeconds(timeoutSeconds))
                .writeTimeout(Duration.ofSeconds(timeoutSeconds))
                .build();
    }
}
