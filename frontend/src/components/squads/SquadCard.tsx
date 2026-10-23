/**
 * SquadCard — list-row card for a Squad.
 *
 * Inspired by Strava Clubs (member roll-up + activity glance) + AuraFitness
 * BentoCard system. Glass morphism is provided by the parent BentoCard.
 */
import { Flame, Users } from 'phosphor-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BentoCard } from '@/components/common/BentoCard';
import { Text } from '@/components/Text';
import type { Squad } from '@/types/squads';
import { BRAND_COLORS, spacing } from '@/utils';

interface SquadCardProps {
  squad: Squad;
  onPress?: (squad: Squad) => void;
}

export function SquadCard({ squad, onPress }: SquadCardProps) {
  const streakColor = squad.currentStreak >= 7 ? BRAND_COLORS.streak.gold : BRAND_COLORS.streak.orange;

  return (
    <Pressable
      onPress={() => onPress?.(squad)}
      accessibilityRole="button"
      accessibilityLabel={`${squad.name} squad, ${squad.memberCount} members, ${squad.currentStreak} day streak`}
    >
      <BentoCard>
        <View style={styles.row}>
          <Text style={styles.emoji}>{squad.emoji}</Text>
          <View style={styles.body}>
            <Text variant="body" weight="bold" numberOfLines={1}>{squad.name}</Text>
            <View style={styles.meta}>
              <View style={styles.metaItem}>
                <Users size={12} color={BRAND_COLORS.textMuted} weight="bold" />
                <Text variant="caption" style={styles.metaText}>{squad.memberCount} members</Text>
              </View>
              <Text variant="caption" style={styles.dot}>·</Text>
              <Text variant="caption" style={styles.code}>CODE {squad.inviteCode}</Text>
            </View>
          </View>
          <View style={[styles.streak, { backgroundColor: 'rgba(249,115,22,0.10)' }]}>
            <Flame size={14} color={streakColor} weight="fill" />
            <Text variant="caption" weight="bold" style={{ color: streakColor }}>
              {squad.currentStreak}
            </Text>
          </View>
        </View>
      </BentoCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emoji: {
    fontSize: 28,
    lineHeight: 32,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: BRAND_COLORS.textMuted,
    fontSize: 11,
  },
  dot: {
    color: BRAND_COLORS.textMuted,
    fontSize: 11,
  },
  code: {
    color: BRAND_COLORS.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontVariant: ['tabular-nums'],
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
});

export default SquadCard;
