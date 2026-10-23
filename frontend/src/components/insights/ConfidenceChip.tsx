/**
 * ConfidenceChip — pill with a dot indicator showing statistical confidence.
 *
 * Inspired by the Apple Health "Trends" confidence chip. Three tiers:
 *   high → solid dot (orange/violet primary)
 *   med  → half-filled dot
 *   low  → outlined dot
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import type { Confidence } from '@/types/insights';
import { BRAND_COLORS, spacing } from '@/utils';

const LABEL: Record<Confidence, string> = {
  high: 'High confidence',
  med:  'Med confidence',
  low:  'Low confidence',
};

interface ConfidenceChipProps {
  confidence: Confidence;
  sample: number;
}

export function ConfidenceChip({ confidence, sample }: ConfidenceChipProps) {
  return (
    <View style={styles.chip}>
      <View style={[styles.dot, dotStyle(confidence)]} />
      <Text variant="caption" style={styles.label}>
        {LABEL[confidence]} · n={sample}
      </Text>
    </View>
  );
}

function dotStyle(c: Confidence) {
  if (c === 'high') return { backgroundColor: BRAND_COLORS.primary, borderColor: BRAND_COLORS.primary };
  if (c === 'med')  return { backgroundColor: BRAND_COLORS.primary, opacity: 0.5, borderColor: BRAND_COLORS.primary };
  return { backgroundColor: 'transparent', borderColor: BRAND_COLORS.textMuted };
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.03)',
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  label: {
    color: BRAND_COLORS.textMuted,
    fontSize: 11,
    letterSpacing: 0.2,
  },
});

export default ConfidenceChip;
