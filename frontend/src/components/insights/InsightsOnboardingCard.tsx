/**
 * InsightsOnboardingCard — empty-state for users with <30 days of logging.
 * Shows a progress bar toward the unlock threshold.
 */
import { Sparkle } from 'phosphor-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { BentoCard } from '@/components/common/BentoCard';
import { Text } from '@/components/Text';
import type { ColdStartStatus } from '@/types/insights';
import { BRAND_COLORS, spacing } from '@/utils';

export function InsightsOnboardingCard({ status }: { status: ColdStartStatus }) {
  const pct = Math.min(1, status.target === 0 ? 1 : status.daysLogged / status.target);
  return (
    <BentoCard>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Sparkle size={20} color={BRAND_COLORS.primary} weight="fill" />
        </View>
        <View style={styles.body}>
          <Text variant="body" weight="bold">Insights unlock at 30 days</Text>
          <Text variant="caption" style={styles.copy}>
            We need 30 days of logging to spot which habits move your Daily Score.
            Keep logging — every meal counts.
          </Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
      </View>
      <Text variant="caption" style={styles.progressLabel}>
        {status.daysLogged} / {status.target} days
      </Text>
    </BentoCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(249,115,22,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, gap: spacing.xs },
  copy: { color: BRAND_COLORS.textMuted, lineHeight: 18 },
  progressTrack: {
    marginTop: spacing.md,
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: BRAND_COLORS.primary,
    borderRadius: 4,
  },
  progressLabel: {
    marginTop: 6,
    color: BRAND_COLORS.textMuted,
    fontSize: 11,
    letterSpacing: 0.2,
    alignSelf: 'flex-end',
  },
});

export default InsightsOnboardingCard;
