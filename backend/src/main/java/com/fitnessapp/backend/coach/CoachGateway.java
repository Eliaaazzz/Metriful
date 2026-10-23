package com.fitnessapp.backend.coach;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

@Service
public class CoachGateway {
  private final CoachContextService contextService;
  private final String url;
  private final String key;
  private final RestClient client;
  private final Cache<UUID, AtomicInteger> limits = Caffeine.newBuilder()
      .maximumSize(10000).expireAfterWrite(Duration.ofMinutes(1)).build();

  public CoachGateway(CoachContextService contextService,
      @Value("${app.coach.url:}") String url, @Value("${app.coach.internal-key:}") String key) {
    this.contextService = contextService;
    this.url = url;
    this.key = key;
    var factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(2000);
    factory.setReadTimeout(25000);
    // RestClient's default mapper can encode LocalDate as [year, month, day].
    // The Python contract requires ISO-8601 date and timestamp strings.
    var mapper = Jackson2ObjectMapperBuilder.json()
        .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS).build();
    this.client = RestClient.builder().requestFactory(factory).messageConverters(converters -> {
      converters.removeIf(converter -> converter instanceof MappingJackson2HttpMessageConverter);
      converters.add(new MappingJackson2HttpMessageConverter(mapper));
    }).build();
  }

  public record ToolTrace(String name, int durationMs) {}
  public record Response(String runId, String answer, List<ToolTrace> tools, String disclaimer) {}

  public Response run(UUID userId, CoachRequest request) {
    if (url.isBlank() || key.length() < 32) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Coach is not configured");
    }
    ZoneId zone;
    try {
      zone = ZoneId.of(request.timeZone());
    } catch (java.time.DateTimeException e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid timezone");
    }
    if (request.shareHealth() && request.health() != null) {
      var health = request.health();
      if (!health.date().equals(request.date()) || !health.timeZone().equals(request.timeZone())
          || health.capturedAt().toInstant().isBefore(Instant.now().minusSeconds(600))
          || health.capturedAt().toInstant().isAfter(Instant.now().plusSeconds(60))) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Refresh Apple Health before sharing");
      }
    }
    if (limits.get(userId, id -> new AtomicInteger()).incrementAndGet() > 10) {
      throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Retry in one minute");
    }
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("message", request.message());
    payload.put("date", request.date());
    payload.put("timeZone", request.timeZone());
    payload.put("history", request.history() == null ? List.of() : request.history());
    payload.put("shareHealth", request.shareHealth());
    payload.put("health", request.shareHealth() ? request.health() : null);
    payload.put("context", contextService.context(userId, request.date(), zone));
    try {
      Response response = client.post().uri(url + "/v1/coach/runs")
          .header("X-Agent-Key", key).body(payload).retrieve().body(Response.class);
      if (response == null || response.answer() == null || response.answer().isBlank()) {
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Coach returned no answer");
      }
      return response;
    } catch (RestClientException e) {
      // Upstream exceptions may contain user content; never log or return them.
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Coach is temporarily unavailable");
    }
  }
}
