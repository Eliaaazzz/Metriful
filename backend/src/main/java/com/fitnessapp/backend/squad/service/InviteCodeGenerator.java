package com.fitnessapp.backend.squad.service;

import com.fitnessapp.backend.squad.repository.SquadRepository;
import java.security.SecureRandom;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Generates 6-character squad invite codes. Uses an unambiguous 32-char alphabet
 * (no 0/O/1/I) so codes are easy to read aloud. Collision rate at 32^6 (~1.07B)
 * is negligible for our scale; we still retry up to {@link #MAX_ATTEMPTS}.
 */
@Component
@RequiredArgsConstructor
public class InviteCodeGenerator {

  static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  static final int CODE_LENGTH = 6;
  static final int MAX_ATTEMPTS = 8;

  private final SquadRepository squadRepository;
  private final SecureRandom random = new SecureRandom();

  public String generateUnique() {
    for (int i = 0; i < MAX_ATTEMPTS; i++) {
      String code = generate();
      if (!squadRepository.existsByInviteCode(code)) {
        return code;
      }
    }
    throw new IllegalStateException("Could not generate a unique invite code after " + MAX_ATTEMPTS + " attempts");
  }

  String generate() {
    char[] buf = new char[CODE_LENGTH];
    for (int i = 0; i < CODE_LENGTH; i++) {
      buf[i] = ALPHABET.charAt(random.nextInt(ALPHABET.length()));
    }
    return new String(buf);
  }
}
