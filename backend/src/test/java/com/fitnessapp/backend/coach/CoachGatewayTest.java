package com.fitnessapp.backend.coach;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

class CoachGatewayTest {
  @Test
  void privateGatewayUsesServerContextAndStripsUnconsentedHealth() throws Exception {
    var received = new AtomicReference<JsonNode>();
    var header = new AtomicReference<String>();
    var mapper = new ObjectMapper();
    var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/v1/coach/runs", exchange -> {
      received.set(mapper.readTree(exchange.getRequestBody()));
      header.set(exchange.getRequestHeaders().getFirst("X-Agent-Key"));
      byte[] response = "{\"runId\":\"run\",\"answer\":\"One habit\",\"tools\":[],\"disclaimer\":\"AI guidance\"}"
          .getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().set("Content-Type", "application/json");
      exchange.sendResponseHeaders(200, response.length);
      exchange.getResponseBody().write(response);
      exchange.close();
    });
    server.start();
    try {
      var context = mock(CoachContextService.class);
      var id = UUID.randomUUID();
      var date = LocalDate.now(ZoneId.of("Australia/Sydney"));
      when(context.context(id, date, ZoneId.of("Australia/Sydney")))
          .thenReturn(Map.of("nutritionToday", Map.of("calories", 123)));
      var gateway = new CoachGateway(context, "http://127.0.0.1:" + server.getAddress().getPort(), "k".repeat(32));
      var health = new CoachRequest.HealthSnapshot(date, "Australia/Sydney", OffsetDateTime.now(),
          9999d, null, null, null, null);
      var request = new CoachRequest("Review today", date, "Australia/Sydney", List.of(), false, health);
      assertThat(gateway.run(id, request).answer()).isEqualTo("One habit");
      assertThat(received.get().get("health").isNull()).isTrue();
      assertThat(received.get().at("/context/nutritionToday/calories").asInt()).isEqualTo(123);
      assertThat(header.get()).isEqualTo("k".repeat(32));
      assertThat(received.get().has("userId")).isFalse();
      assertThat(received.get().get("date").asText()).isEqualTo(date.toString());
      gateway.run(id, new CoachRequest("Review today", date, "Australia/Sydney", List.of(), true, health));
      assertThat(received.get().at("/health/date").asText()).isEqualTo(date.toString());
      assertThat(received.get().at("/health/capturedAt").isTextual()).isTrue();
      for (int i = 0; i < 8; i++) gateway.run(id, request);
      assertThatThrownBy(() -> gateway.run(id, request)).isInstanceOfSatisfying(ResponseStatusException.class,
          e -> assertThat(e.getStatusCode().value()).isEqualTo(429));
    } finally { server.stop(0); }
  }

  @Test
  void staleHealthAndInvalidTimezoneAreRejectedBeforeRetrievingData() {
    var context = mock(CoachContextService.class);
    var gateway = new CoachGateway(context, "http://127.0.0.1:1", "k".repeat(32));
    var date = LocalDate.of(2026, 10, 23);
    var health = new CoachRequest.HealthSnapshot(date, "Australia/Sydney", OffsetDateTime.now().minusHours(1),
        null, null, null, null, null);
    var stale = new CoachRequest("Help", date, "Australia/Sydney", List.of(), true, health);
    assertThatThrownBy(() -> gateway.run(UUID.randomUUID(), stale))
        .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value()).isEqualTo(400));
    var invalid = new CoachRequest("Help", date, "invalid/zone", List.of(), false, null);
    assertThatThrownBy(() -> gateway.run(UUID.randomUUID(), invalid)).isInstanceOf(ResponseStatusException.class);
    verifyNoInteractions(context);
  }
}
