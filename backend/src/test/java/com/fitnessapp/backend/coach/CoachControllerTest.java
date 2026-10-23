package com.fitnessapp.backend.coach;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import com.fitnessapp.backend.api.common.GlobalExceptionHandler;
import com.fitnessapp.backend.security.AuthenticatedUser;

class CoachControllerTest {
  @Test
  void requestBodyCannotSelectAnotherUserOrOverrideServerContext() throws Exception {
    var gateway = mock(CoachGateway.class);
    var id = UUID.randomUUID();
    var user = new AuthenticatedUser(null, "jwt-user", id);
    SecurityContextHolder.getContext().setAuthentication(
        new UsernamePasswordAuthenticationToken(user, null, List.of()));
    try {
      when(gateway.run(org.mockito.ArgumentMatchers.eq(id), org.mockito.ArgumentMatchers.any()))
          .thenReturn(new CoachGateway.Response("run", "One habit", List.of(), "AI guidance"));
      var mvc = MockMvcBuilders.standaloneSetup(new CoachController(gateway))
          .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
      mvc.perform(post("/api/v1/coach/runs").contentType(MediaType.APPLICATION_JSON)
          .content("{\"message\":\"Help\",\"date\":\"2026-10-23\",\"timeZone\":\"Australia/Sydney\","
              + "\"userId\":\"someone-else\",\"context\":{\"nutritionToday\":{\"calories\":1}}}"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.answer").value("One habit"));
      verify(gateway).run(org.mockito.ArgumentMatchers.eq(id), org.mockito.ArgumentMatchers.any());
    } finally { SecurityContextHolder.clearContext(); }
  }

  @Test
  void apiKeyWithoutUserIdentityCannotReachAgent() {
    var gateway = mock(CoachGateway.class);
    var controller = new CoachController(gateway);
    var request = new CoachRequest("Help", LocalDate.now(), "Australia/Sydney", List.of(), false, null);
    assertThatThrownBy(() -> controller.run(null, request)).isInstanceOfSatisfying(ResponseStatusException.class,
        e -> assertThat(e.getStatusCode().value()).isEqualTo(401));
    verifyNoInteractions(gateway);
  }

  @Test
  void httpErrorsKeepTheirStatusThroughGlobalAdvice() throws Exception {
    var gateway = mock(CoachGateway.class);
    var mvc = MockMvcBuilders.standaloneSetup(new CoachController(gateway))
        .setControllerAdvice(new GlobalExceptionHandler()).build();
    mvc.perform(post("/api/v1/coach/runs").contentType(MediaType.APPLICATION_JSON)
        .content("{\"message\":\"Help\",\"date\":\"2026-10-23\",\"timeZone\":\"Australia/Sydney\"}"))
        .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
    mvc.perform(post("/api/v1/coach/runs").contentType(MediaType.APPLICATION_JSON)
        .content("{\"message\":\"\",\"date\":\"2026-10-23\",\"timeZone\":\"Australia/Sydney\"}"))
        .andExpect(status().isBadRequest());
  }
}
