package com.fitnessapp.backend.squad.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fitnessapp.backend.squad.repository.SquadRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InviteCodeGeneratorTest {

  @Mock private SquadRepository squadRepository;

  @Test
  void generate_returnsCodeOfExpectedShape() {
    InviteCodeGenerator gen = new InviteCodeGenerator(squadRepository);
    String code = gen.generate();

    assertThat(code).hasSize(InviteCodeGenerator.CODE_LENGTH);
    for (char c : code.toCharArray()) {
      assertThat(InviteCodeGenerator.ALPHABET).contains(String.valueOf(c));
    }
    // Confusable characters intentionally omitted
    assertThat(code).doesNotContain("0", "O", "1", "I");
  }

  @Test
  void generateUnique_retriesUntilCollisionFree() {
    InviteCodeGenerator gen = new InviteCodeGenerator(squadRepository);
    // First two attempts collide, third succeeds.
    when(squadRepository.existsByInviteCode(anyString()))
        .thenReturn(true)
        .thenReturn(true)
        .thenReturn(false);

    String code = gen.generateUnique();

    assertThat(code).hasSize(InviteCodeGenerator.CODE_LENGTH);
    verify(squadRepository, times(3)).existsByInviteCode(anyString());
  }

  @Test
  void generateUnique_givesUpAfterMaxAttempts() {
    InviteCodeGenerator gen = new InviteCodeGenerator(squadRepository);
    when(squadRepository.existsByInviteCode(anyString())).thenReturn(true);

    assertThatThrownBy(gen::generateUnique).isInstanceOf(IllegalStateException.class);
    verify(squadRepository, times(InviteCodeGenerator.MAX_ATTEMPTS)).existsByInviteCode(anyString());
  }
}
