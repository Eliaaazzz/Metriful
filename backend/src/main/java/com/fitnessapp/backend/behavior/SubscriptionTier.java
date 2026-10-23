package com.fitnessapp.backend.behavior;

/**
 * Subscription tier enumeration. Today the {@link SubscriptionService} stub
 * returns {@link #FREE} for everyone — when RevenueCat (or whichever provider)
 * is wired in, only the resolver changes.
 */
public enum SubscriptionTier {
  FREE,
  PRO,
  PREMIUM;

  public boolean isAtLeast(SubscriptionTier other) {
    return this.ordinal() >= other.ordinal();
  }
}
