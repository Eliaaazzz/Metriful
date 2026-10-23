package com.fitnessapp.backend.behavior;

import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Resolves the {@link SubscriptionTier} for a user. Until billing is wired in,
 * everyone is {@link SubscriptionTier#FREE}; an env override exists so QA can
 * force the Pro/Premium code paths.
 */
@Service
public class SubscriptionService {

  private final SubscriptionTier override;

  public SubscriptionService(
      @Value("${aurafitness.subscription.override:FREE}") String overrideRaw
  ) {
    SubscriptionTier parsed;
    try {
      parsed = SubscriptionTier.valueOf(overrideRaw.trim().toUpperCase());
    } catch (Exception e) {
      parsed = SubscriptionTier.FREE;
    }
    this.override = parsed;
  }

  public SubscriptionTier getTier(UUID userId) {
    // TODO(#221-followup): replace with real subscription resolution.
    return override;
  }
}
