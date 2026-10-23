/**
 * RecoveryMealCard — the training→nutrition bridge (Strava finish → Metriful log).
 *
 * Appears on the Dashboard for up to 2 hours after a finished workout session:
 * acknowledges the session (duration + estimated burn, clearly labeled estimate)
 * and offers ONE action — log a recovery meal. Dismissible, never nagging.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Barbell, X } from 'phosphor-react-native';

import { Text } from '@/components/Text';
import { usePostWorkoutStore } from '@/stores/usePostWorkoutStore';
import { BRAND_COLORS, spacing } from '@/utils';

interface RecoveryMealCardProps {
  onLogMeal: () => void;
}

export function RecoveryMealCard({ onLogMeal }: RecoveryMealCardProps) {
  const lastFinished = usePostWorkoutStore((s) => s.lastFinished);
  const dismissedAt = usePostWorkoutStore((s) => s.dismissedAt);
  const dismiss = usePostWorkoutStore((s) => s.dismiss);
  const activeRecovery = usePostWorkoutStore((s) => s.activeRecovery);

  // Re-evaluate the 2h window once a minute so the card retires itself.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Subscribing to lastFinished/dismissedAt makes this re-render on store changes.
  void lastFinished;
  void dismissedAt;
  const recovery = activeRecovery();
  if (!recovery) return null;

  const minutes = Math.max(1, Math.round(recovery.durationMs / 60000));

  return (
    <View style={styles.card} accessibilityLabel="Recovery meal suggestion">
      <View style={styles.iconWrap}>
        <Barbell size={20} color={BRAND_COLORS.secondary} weight="duotone" />
      </View>
      <View style={styles.copy}>
        <Text variant="body" weight="semibold" style={styles.title}>
          Nice session — {minutes} min, ~{Math.round(recovery.estimatedCalories)} kcal (estimated)
        </Text>
        <Text variant="caption" style={styles.subtitle}>
          A protein-forward meal within 2 hours supports recovery.
        </Text>
      </View>
      <Pressable
        onPress={onLogMeal}
        style={styles.ctaBtn}
        accessibilityRole="button"
        accessibilityLabel="Log recovery meal"
      >
        <Text variant="caption" weight="bold" style={styles.ctaText}>
          Log meal
        </Text>
      </Pressable>
      <Pressable
        onPress={dismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Dismiss recovery meal suggestion"
      >
        <X size={16} color={BRAND_COLORS.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(47, 122, 106, 0.25)',
    backgroundColor: BRAND_COLORS.secondaryContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(47, 122, 106, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: BRAND_COLORS.textPrimary,
  },
  subtitle: {
    color: BRAND_COLORS.textSecondary,
    marginTop: 1,
  },
  ctaBtn: {
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.secondary,
  },
  ctaText: {
    color: '#FFFFFF',
  },
});

export default RecoveryMealCard;
