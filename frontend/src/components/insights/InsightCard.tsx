/**
 * InsightCard — one habit↔Daily-Score correlation row.
 *
 * Inspired by Whoop's Behavior Insights cards. Shows the delta arrow, sentence,
 * confidence chip, and the mandatory AI disclaimer (CLAUDE.md policy).
 */
import * as Haptics from 'expo-haptics';
import { ArrowDown, ArrowUp, PushPin } from 'phosphor-react-native';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { BentoCard } from '@/components/common/BentoCard';
import { Text } from '@/components/Text';
import type { Insight } from '@/types/insights';
import { BRAND_COLORS, spacing } from '@/utils';

import { ConfidenceChip } from './ConfidenceChip';

interface InsightCardProps {
  insight: Insight;
  onPress?: (insight: Insight) => void;
  onTogglePin?: (insight: Insight) => void;
}

export function InsightCard({ insight, onPress, onTogglePin }: InsightCardProps) {
  const accent = insight.positive ? BRAND_COLORS.primary : BRAND_COLORS.textMuted;
  const Arrow = insight.positive ? ArrowUp : ArrowDown;
  const absDelta = Math.abs(insight.deltaScore);

  const handlePin = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    onTogglePin?.(insight);
  };

  return (
    <Pressable
      onPress={() => onPress?.(insight)}
      accessibilityRole="button"
      accessibilityLabel={`${insight.label} insight: ${insight.sentence}`}
      testID={`insight-card-${insight.id}`}
    >
      <BentoCard>
        <View style={[styles.accent, { backgroundColor: accent }]} />
        <View style={styles.row}>
          <View style={styles.deltaCol}>
            <Arrow size={14} color={accent} weight="bold" />
            <Text style={[styles.delta, { color: accent }]}>
              {insight.positive ? '+' : '−'}{absDelta.toFixed(1)}
            </Text>
            <Text variant="caption" style={styles.deltaUnit}>pts</Text>
          </View>

          <View style={styles.body}>
            <Text variant="body" weight="semibold" numberOfLines={2} style={styles.label}>
              {insight.label}
            </Text>
            <Text variant="caption" style={styles.sentence} numberOfLines={3}>
              {insight.sentence}
            </Text>
            <View style={styles.metaRow}>
              <ConfidenceChip
                confidence={insight.confidence}
                sample={insight.sampleYes + insight.sampleNo}
              />
              <Pressable
                onPress={handlePin}
                hitSlop={8}
                style={styles.pinButton}
                accessibilityRole="button"
                accessibilityLabel={insight.pinned ? 'Unpin insight' : 'Pin insight'}
                testID={`insight-pin-${insight.id}`}
              >
                <PushPin
                  size={14}
                  color={insight.pinned ? BRAND_COLORS.primary : BRAND_COLORS.textMuted}
                  weight={insight.pinned ? 'fill' : 'regular'}
                />
              </Pressable>
            </View>
          </View>
        </View>

        <Text variant="caption" style={styles.disclaimer} numberOfLines={2}>
          {insight.disclaimer}
        </Text>
      </BentoCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  deltaCol: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  delta: {
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  deltaUnit: {
    color: BRAND_COLORS.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  body: { flex: 1, gap: spacing.xs },
  label: { fontSize: 15 },
  sentence: { color: BRAND_COLORS.textMuted, lineHeight: 18 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  pinButton: { padding: spacing.xs },
  disclaimer: {
    marginTop: spacing.sm,
    color: BRAND_COLORS.textDisabled,
    fontSize: 10,
    letterSpacing: 0.2,
  },
});

export default InsightCard;
