/**
 * Storyset (Pana style, brand-copper recolor) artwork for gamification
 * surfaces — the same illustration family the landing page and quick-access
 * tiles already use, so badges and challenge cards read as one system.
 * Keys are the emoji the data layer already carries; unmapped glyphs fall
 * back to rendering the raw emoji.
 */
export const BADGE_ART: Record<string, number> = {
  '🍽️': require('@/../assets/illustrations/hero-healthy-eating.svg'),
  '💪': require('@/../assets/illustrations/strength.svg'),
  '🥗': require('@/../assets/illustrations/fruit-salad.svg'),
  '🏃': require('@/../assets/illustrations/cardio-run.svg'),
  '💧': require('@/../assets/illustrations/hydration.svg'),
  '🎯': require('@/../assets/illustrations/fitness-stats.svg'),
  '🔥': require('@/../assets/illustrations/healthy-habit.svg'),
  '🌟': require('@/../assets/illustrations/trophy-winner.svg'),
  '🥞': require('@/../assets/illustrations/cooking.svg'),
  '🏋️': require('@/../assets/illustrations/fitness-tracker.svg'),
};

/** Artwork for an emoji key, or null when unmapped (caller keeps the raw glyph). */
export function badgeArtFor(emoji: string): number | null {
  return BADGE_ART[emoji] ?? null;
}
