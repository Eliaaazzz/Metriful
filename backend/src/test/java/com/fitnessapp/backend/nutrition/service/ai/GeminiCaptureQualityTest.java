package com.fitnessapp.backend.nutrition.service.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.HashSet;
import java.util.Set;

import javax.imageio.ImageIO;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fitnessapp.backend.nutrition.dto.FoodRecognitionRequestMetadata;
import com.fitnessapp.backend.nutrition.service.ai.GeminiMealAnalysisService.QualitySignal;

/**
 * Unit tests for the capture-quality / EXIF-orientation / structured-output features added to
 * {@link GeminiMealAnalysisService}.
 *
 * These are deterministic, network-free unit tests: they construct the service with a fake key
 * (useVertexAi=false, so no credentials are touched) and exercise the pure helpers directly.
 *
 * EXIF byte layouts are hand-built from the spec (both little- and big-endian) so the parser is
 * validated against independently-constructed input, and the orientation remap is checked against
 * a canonical rotate/flip oracle rather than a copy of the implementation's own formulas.
 */
class GeminiCaptureQualityTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private GeminiMealAnalysisService service(boolean structuredOutput) {
        return service("gemini-2.0-flash", structuredOutput, 0);
    }

    private GeminiMealAnalysisService service(String model, boolean structuredOutput, int thinkingBudget) {
        return new GeminiMealAnalysisService(
                mapper, "test-key", model, false, "proj", "region", structuredOutput, thinkingBudget);
    }

    // ==================== EXIF orientation parsing ====================

    @Test
    @DisplayName("readExifOrientation reads every valid orientation in both byte orders")
    void readsAllOrientationsBothEndian() {
        GeminiMealAnalysisService s = service(true);
        for (int o = 1; o <= 8; o++) {
            assertThat(s.readExifOrientation(jpegWithExifOrientation(o, true)))
                    .as("little-endian orientation %d", o).isEqualTo(o);
            assertThat(s.readExifOrientation(jpegWithExifOrientation(o, false)))
                    .as("big-endian orientation %d", o).isEqualTo(o);
        }
    }

    @Test
    @DisplayName("readExifOrientation clamps out-of-range tag values to 1")
    void clampsOutOfRangeOrientation() {
        GeminiMealAnalysisService s = service(true);
        assertThat(s.readExifOrientation(jpegWithExifOrientation(9, true))).isEqualTo(1);
        assertThat(s.readExifOrientation(jpegWithExifOrientation(0, false))).isEqualTo(1);
    }

    @Test
    @DisplayName("readExifOrientation returns 1 for non-JPEG / EXIF-less / malformed input")
    void defaultsToNormalOrientation() {
        GeminiMealAnalysisService s = service(true);
        assertThat(s.readExifOrientation(null)).isEqualTo(1);
        assertThat(s.readExifOrientation(new byte[0])).isEqualTo(1);
        // PNG magic — not a JPEG.
        assertThat(s.readExifOrientation(new byte[] {(byte) 0x89, 'P', 'N', 'G'})).isEqualTo(1);
        // Valid JPEG with no APP1/Exif segment (SOI directly followed by EOI).
        assertThat(s.readExifOrientation(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xD9}))
                .isEqualTo(1);
        // Truncated APP1 marker.
        assertThat(s.readExifOrientation(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE1}))
                .isEqualTo(1);
    }

    // ==================== applyOrientation pixel remap ====================

    @Test
    @DisplayName("applyOrientation returns the same image for the identity / invalid orientations")
    void orientationIdentityAndInvalid() {
        GeminiMealAnalysisService s = service(true);
        BufferedImage img = labeled(4, 3);
        assertThat(s.applyOrientation(img, 1)).isSameAs(img);
        assertThat(s.applyOrientation(img, 0)).isSameAs(img);
        assertThat(s.applyOrientation(img, 9)).isSameAs(img);
    }

    @Test
    @DisplayName("applyOrientation swaps dimensions for 5-8 and preserves them for 2-4")
    void orientationDimensions() {
        GeminiMealAnalysisService s = service(true);
        BufferedImage img = labeled(4, 3);
        for (int o = 2; o <= 4; o++) {
            BufferedImage r = s.applyOrientation(img, o);
            assertThat(r.getWidth()).as("o=%d w", o).isEqualTo(4);
            assertThat(r.getHeight()).as("o=%d h", o).isEqualTo(3);
        }
        for (int o = 5; o <= 8; o++) {
            BufferedImage r = s.applyOrientation(img, o);
            assertThat(r.getWidth()).as("o=%d w", o).isEqualTo(3);
            assertThat(r.getHeight()).as("o=%d h", o).isEqualTo(4);
        }
    }

    @Test
    @DisplayName("applyOrientation is a bijection (pixel-preserving permutation) for all transforms")
    void orientationIsBijection() {
        GeminiMealAnalysisService s = service(true);
        int w = 5, h = 3;
        BufferedImage img = labeled(w, h);
        for (int o = 2; o <= 8; o++) {
            BufferedImage r = s.applyOrientation(img, o);
            Set<Integer> seen = new HashSet<>();
            for (int y = 0; y < r.getHeight(); y++) {
                for (int x = 0; x < r.getWidth(); x++) {
                    int src = r.getRGB(x, y) & 0xFFFF; // encodes (sx<<8)|sy
                    int sx = (src >> 8) & 0xFF;
                    int sy = src & 0xFF;
                    assertThat(sx).as("o=%d in-range sx", o).isLessThan(w);
                    assertThat(sy).as("o=%d in-range sy", o).isLessThan(h);
                    assertThat(seen.add(src)).as("o=%d no duplicate source pixel", o).isTrue();
                }
            }
            assertThat(seen).as("o=%d covers every source pixel", o).hasSize(w * h);
        }
    }

    @Test
    @DisplayName("applyOrientation matches the canonical rotate/flip definition for all 8 cases")
    void orientationMatchesCanonicalOracle() {
        GeminiMealAnalysisService s = service(true);
        int w = 5, h = 3;
        BufferedImage img = labeled(w, h);

        // Ground-truth destination of two source corners, derived from the EXIF orientation
        // meaning (2=mirror-H, 3=rotate-180, 4=mirror-V, 5=transpose, 6=rotate-90-CW,
        // 7=transverse, 8=rotate-90-CCW). These are written independently of the implementation.
        // Each row: {orientation, expectedDestX_of(0,0), expectedDestY_of(0,0),
        //                         expectedDestX_of(w-1,0), expectedDestY_of(w-1,0)}
        int[][] expected = {
                {2, w - 1, 0, /**/ 0, 0},
                {3, w - 1, h - 1, /**/ 0, h - 1},
                {4, 0, h - 1, /**/ w - 1, h - 1},
                {5, 0, 0, /**/ 0, w - 1},
                {6, h - 1, 0, /**/ h - 1, w - 1},
                {7, h - 1, w - 1, /**/ h - 1, 0},
                {8, 0, w - 1, /**/ 0, 0},
        };

        for (int[] e : expected) {
            BufferedImage r = s.applyOrientation(img, e[0]);
            assertThat(pixel(r, e[1], e[2]))
                    .as("o=%d: source (0,0) lands at (%d,%d)", e[0], e[1], e[2])
                    .isEqualTo(label(0, 0));
            assertThat(pixel(r, e[3], e[4]))
                    .as("o=%d: source (%d,0) lands at (%d,%d)", e[0], w - 1, e[3], e[4])
                    .isEqualTo(label(w - 1, 0));
        }
    }

    @Test
    @DisplayName("optimizeImage applies EXIF orientation end-to-end (landscape capture -> portrait)")
    void optimizeAppliesOrientationEndToEnd() throws Exception {
        GeminiMealAnalysisService s = service(true);
        // A 40x20 landscape frame tagged orientation 6 (camera rotated) must come out upright 20x40.
        BufferedImage landscape = new BufferedImage(40, 20, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < 20; y++) {
            for (int x = 0; x < 40; x++) {
                landscape.setRGB(x, y, 0x808080);
            }
        }
        ByteArrayOutputStream jpg = new ByteArrayOutputStream();
        ImageIO.write(landscape, "jpg", jpg);
        byte[] tagged = spliceExif(jpg.toByteArray(), exifApp1Segment(6, false));

        var optimized = s.optimizeImage(Base64.getEncoder().encodeToString(tagged), "image/jpeg");
        BufferedImage result = ImageIO.read(
                new ByteArrayInputStream(Base64.getDecoder().decode(optimized.base64())));

        assertThat(result.getWidth()).isEqualTo(20);
        assertThat(result.getHeight()).isEqualTo(40);
        assertThat(optimized.mediaType()).isEqualTo("image/jpeg");
    }

    // ==================== assessQuality (brightness + sharpness) ====================

    @Test
    @DisplayName("assessQuality flags a dark, flat frame as low-light, blurry and low-quality")
    void assessDarkFlatImage() {
        QualitySignal q = service(true).assessQuality(uniform(32, 32, 30));
        assertThat(q).isNotNull();
        assertThat(q.brightness()).isEqualTo(30);          // luma of a neutral gray == its channel value
        assertThat(q.sharpness()).isCloseTo(0.0, org.assertj.core.data.Offset.offset(1e-6));
        assertThat(q.lowLight()).isTrue();                 // 30 < 55 threshold
        assertThat(q.blurry()).isTrue();                   // flat => zero Laplacian variance
        assertThat(q.lowQuality()).isTrue();
    }

    @Test
    @DisplayName("assessQuality treats a bright but flat frame as bright yet still blurry")
    void assessBrightFlatImage() {
        QualitySignal q = service(true).assessQuality(uniform(32, 32, 200));
        assertThat(q.brightness()).isEqualTo(200);
        assertThat(q.lowLight()).isFalse();
        assertThat(q.blurry()).isTrue();                   // no edges => low sharpness
    }

    @Test
    @DisplayName("assessQuality reports a high-contrast frame as sharp and well-lit")
    void assessSharpImage() {
        QualitySignal q = service(true).assessQuality(checkerboard(32, 32));
        assertThat(q.brightness()).isEqualTo(127);         // even split of black/white
        assertThat(q.lowLight()).isFalse();
        assertThat(q.sharpness()).isGreaterThan(100_000.0); // strong edges => high Laplacian variance
        assertThat(q.blurry()).isFalse();
        assertThat(q.lowQuality()).isFalse();
    }

    @Test
    @DisplayName("assessQuality returns null for sub-3px images (nothing to sample)")
    void assessTinyImage() {
        assertThat(service(true).assessQuality(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB))).isNull();
        assertThat(service(true).assessQuality(new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB))).isNull();
    }

    // ==================== buildContextBlock (JSON scale + quality hint) ====================

    @Test
    @DisplayName("buildContextBlock emits an empty object when no metadata or quality is present")
    void contextBlockEmpty() {
        assertThat(service(true).buildContextBlock(null, null)).isEqualTo("{}");
    }

    @Test
    @DisplayName("buildContextBlock emits img_w_cm with a dot decimal regardless of locale")
    void contextBlockScaleOnly() throws Exception {
        String block = service(true).buildContextBlock(metadata(35.5), null);
        assertThat(block).isEqualTo("{\"img_w_cm\": 35.5}");
        JsonNode node = mapper.readTree(block);
        assertThat(node.get("img_w_cm").asDouble()).isEqualTo(35.5);
        assertThat(node.has("image_quality")).isFalse();
    }

    @Test
    @DisplayName("buildContextBlock emits an image_quality object when only quality is present")
    void contextBlockQualityOnly() throws Exception {
        QualitySignal q = new QualitySignal(40, 1234.0, true, false);
        String block = service(true).buildContextBlock(null, q);
        JsonNode node = mapper.readTree(block);
        assertThat(node.has("img_w_cm")).isFalse();
        JsonNode iq = node.get("image_quality");
        assertThat(iq.get("brightness").asInt()).isEqualTo(40);
        assertThat(iq.get("sharpness").asInt()).isEqualTo(1234);
        assertThat(iq.get("low_quality").asBoolean()).isTrue(); // lowLight || blurry
    }

    @Test
    @DisplayName("buildContextBlock combines scale and quality into one valid JSON object")
    void contextBlockBoth() throws Exception {
        QualitySignal q = new QualitySignal(200, 50.0, false, true);
        String block = service(true).buildContextBlock(metadata(28.0), q);
        JsonNode node = mapper.readTree(block); // must be parseable
        assertThat(node.get("img_w_cm").asDouble()).isEqualTo(28.0);
        assertThat(node.get("image_quality").get("low_quality").asBoolean()).isTrue();
    }

    // ==================== buildRequestBody (structured-output toggle) ====================

    @Test
    @DisplayName("buildRequestBody includes responseSchema and stays valid JSON when structured output is on")
    void requestBodyWithSchema() throws Exception {
        String body = service(true).buildRequestBody(
                "QUJD", "image/jpeg", metadata(35.5), new QualitySignal(120, 500.0, false, false));
        JsonNode root = mapper.readTree(body); // the injected schema must not break the JSON
        JsonNode genConfig = root.get("generationConfig");
        assertThat(genConfig.has("responseSchema")).isTrue();
        assertThat(genConfig.get("responseSchema").get("properties").get("scene_type").get("enum"))
                .anySatisfy(n -> assertThat(n.asText()).isEqualTo("countable"));
        assertThat(genConfig.get("maxOutputTokens").asInt()).isEqualTo(4096);

        String prompt = root.get("contents").get(0).get("parts").get(1).get("text").asText();
        assertThat(prompt).contains("response schema").contains("img_w_cm");
    }

    @Test
    @DisplayName("buildRequestBody omits responseSchema (still valid JSON) when structured output is off")
    void requestBodyWithoutSchema() throws Exception {
        String body = service(false).buildRequestBody(
                "QUJD", "image/jpeg", null, null);
        JsonNode root = mapper.readTree(body);
        JsonNode genConfig = root.get("generationConfig");
        assertThat(genConfig.has("responseSchema")).isFalse();
        assertThat(genConfig.get("maxOutputTokens").asInt()).isEqualTo(4096);
    }

    @Test
    @DisplayName("buildRequestBody disables thinking on a 2.5 model (thinkingBudget 0) and stays valid JSON")
    void requestBodyDisablesThinkingFor25() throws Exception {
        String body = service("gemini-2.5-flash", true, 0).buildRequestBody(
                "QUJD", "image/jpeg", null, null);
        JsonNode genConfig = mapper.readTree(body).get("generationConfig");
        assertThat(genConfig.has("thinkingConfig")).isTrue();
        assertThat(genConfig.get("thinkingConfig").get("thinkingBudget").asInt()).isEqualTo(0);
    }

    @Test
    @DisplayName("buildRequestBody omits thinkingConfig on a 2.0 model (which would reject it)")
    void requestBodyOmitsThinkingFor20() throws Exception {
        String body = service("gemini-2.0-flash", true, 0).buildRequestBody(
                "QUJD", "image/jpeg", null, null);
        JsonNode genConfig = mapper.readTree(body).get("generationConfig");
        assertThat(genConfig.has("thinkingConfig")).isFalse();
        assertThat(GeminiMealAnalysisService.isThinkingCapable("gemini-2.5-pro")).isTrue();
        assertThat(GeminiMealAnalysisService.isThinkingCapable("gemini-2.0-flash")).isFalse();
    }

    @Test
    @DisplayName("RESPONSE_SCHEMA constant is well-formed JSON with the expected food fields")
    void responseSchemaIsWellFormed() throws Exception {
        JsonNode schema = mapper.readTree(GeminiMealAnalysisService.RESPONSE_SCHEMA);
        assertThat(schema.get("type").asText()).isEqualTo("OBJECT");
        JsonNode required = schema.get("properties").get("foods").get("items").get("required");
        Set<String> fields = new HashSet<>();
        required.forEach(n -> fields.add(n.asText()));
        assertThat(fields).contains(
                "name", "confidence", "quantity", "unit", "weight_g",
                "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "estimated_gi");
    }

    // ==================== helpers ====================

    private static FoodRecognitionRequestMetadata metadata(double imgWcm) {
        return FoodRecognitionRequestMetadata.builder().imageWidthCm(imgWcm).build();
    }

    /** Label each pixel with its own (x,y) so a remap can be inverted: rgb low bits = (x<<8)|y. */
    private static BufferedImage labeled(int w, int h) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                img.setRGB(x, y, label(x, y));
            }
        }
        return img;
    }

    private static int label(int x, int y) {
        return (x << 8) | y;
    }

    private static int pixel(BufferedImage img, int x, int y) {
        return img.getRGB(x, y) & 0xFFFF;
    }

    private static BufferedImage uniform(int w, int h, int gray) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        int rgb = (gray << 16) | (gray << 8) | gray;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                img.setRGB(x, y, rgb);
            }
        }
        return img;
    }

    private static BufferedImage checkerboard(int w, int h) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                img.setRGB(x, y, ((x + y) & 1) == 0 ? 0xFFFFFF : 0x000000);
            }
        }
        return img;
    }

    // ---- hand-built EXIF byte structures (independent of the parser under test) ----

    /** A minimal JPEG: SOI + APP1/Exif(orientation) + EOI. */
    private static byte[] jpegWithExifOrientation(int orientation, boolean little) {
        try {
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            o.write(0xFF);
            o.write(0xD8); // SOI
            o.writeBytes(exifApp1Segment(orientation, little));
            o.write(0xFF);
            o.write(0xD9); // EOI
            return o.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    /** The APP1 segment: FFE1 + length + "Exif\0\0" + a TIFF block carrying one Orientation tag. */
    private static byte[] exifApp1Segment(int orientation, boolean little) {
        ByteArrayOutputStream tiff = new ByteArrayOutputStream();
        if (little) {
            tiff.write(0x49);
            tiff.write(0x49); // 'II'
        } else {
            tiff.write(0x4D);
            tiff.write(0x4D); // 'MM'
        }
        write16(tiff, 0x2A, little);   // TIFF magic
        write32(tiff, 8, little);      // offset to IFD0
        write16(tiff, 1, little);      // one directory entry
        write16(tiff, 0x0112, little); // tag = Orientation
        write16(tiff, 3, little);      // type = SHORT
        write32(tiff, 1, little);      // count = 1
        write16(tiff, orientation, little); // value (SHORT) in the first 2 bytes of the value field
        write16(tiff, 0, little);      // pad remaining 2 bytes of the 4-byte value field
        write32(tiff, 0, little);      // next-IFD offset = 0
        byte[] tiffBytes = tiff.toByteArray();

        ByteArrayOutputStream payload = new ByteArrayOutputStream();
        payload.write('E');
        payload.write('x');
        payload.write('i');
        payload.write('f');
        payload.write(0);
        payload.write(0);
        payload.writeBytes(tiffBytes);
        byte[] payloadBytes = payload.toByteArray();

        int segLen = payloadBytes.length + 2; // length field counts itself
        ByteArrayOutputStream seg = new ByteArrayOutputStream();
        seg.write(0xFF);
        seg.write(0xE1); // APP1 marker
        seg.write((segLen >> 8) & 0xFF); // segment length is always big-endian (JPEG, not TIFF)
        seg.write(segLen & 0xFF);
        seg.writeBytes(payloadBytes);
        return seg.toByteArray();
    }

    /** Insert an APP1 segment immediately after a real JPEG's SOI marker. */
    private static byte[] spliceExif(byte[] jpeg, byte[] app1Segment) {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        o.write(jpeg[0]);
        o.write(jpeg[1]); // SOI (FFD8)
        o.writeBytes(app1Segment);
        o.write(jpeg, 2, jpeg.length - 2);
        return o.toByteArray();
    }

    private static void write16(ByteArrayOutputStream o, int v, boolean little) {
        if (little) {
            o.write(v & 0xFF);
            o.write((v >> 8) & 0xFF);
        } else {
            o.write((v >> 8) & 0xFF);
            o.write(v & 0xFF);
        }
    }

    private static void write32(ByteArrayOutputStream o, int v, boolean little) {
        if (little) {
            o.write(v & 0xFF);
            o.write((v >> 8) & 0xFF);
            o.write((v >> 16) & 0xFF);
            o.write((v >> 24) & 0xFF);
        } else {
            o.write((v >> 24) & 0xFF);
            o.write((v >> 16) & 0xFF);
            o.write((v >> 8) & 0xFF);
            o.write(v & 0xFF);
        }
    }
}
