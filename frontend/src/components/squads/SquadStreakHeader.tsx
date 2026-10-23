/**
 * SquadStreakHeader — large flame + streak count for the SquadDetail hero.
 * Reuses the personal {@code StreakBadge} tier system for color / glow logic.
 */
import { Flame } from 'phosphor-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { BRAND_COLORS, spacing } from '@/utils';

function tier(streak: number) {
  if (streak >= 30) return { label: 'Legendary', color: BRAND_COLORS.streak.red };
  if (streak >= 14) return { label: 'Unstoppable', color: BRAND_COLORS.streak.orange };
  if (streak >= 7)  return { label: 'On Fire', color: BRAND_COLORS.streak.gold };
  if (streak >= 3)  return { label: 'Warming Up', color: BRAND_COLORS.streak.orange };
  return { label: '', color: BRAND_COLORS.streak.gray };
}

interface SquadStreakHeaderProps {
  emoji: string;
  name: string;
  currentStreak: number;
  longestStreak: number;
  memberCount: number;
}

export function SquadStreakHeader(props: SquadStreakHeaderProps) {
  const t = tier(props.currentStreak);
  return (
    <View style={styles.wrap}>
      <Text variant="heading2" style={styles.emoji}>{props.emoji}</Text>
      <Text variant="heading2" weight="bold" style={styles.name} numberOfLines={1}>{props.name}</Text>
      <View style={styles.streakRow}>
        <Flame size={28} color={t.color} weight="fill" />
        <Text style={[styles.streakNumber, { color: t.color }]}>{props.currentStreak}</Text>
        <Text variant="caption" style={[styles.streakUnit, { color: t.color }]}>day streak</Text>
      </View>
      {t.label.length > 0 && (
        <Text variant="caption" weight="medium" style={[styles.tierLabel, { color: t.color }]}>
          {t.label.toUpperCase()}
        </Text>
      )}
      <Text variant="caption" style={styles.subtle}>
        {props.memberCount} members · longest {props.longestStreak}d
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4, paddingVertical: spacing.lg },
  emoji: { fontSize: 48, lineHeight: 54 },
  name: { fontSize: 22, marginTop: spacing.xs },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  streakNumber: { fontSize: 56, fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  streakUnit: { letterSpacing: 1 },
  tierLabel: { fontSize: 10, letterSpacing: 1.5 },
  subtle: { color: BRAND_COLORS.textMuted, marginTop: spacing.xs },
});

export default SquadStreakHeader;
