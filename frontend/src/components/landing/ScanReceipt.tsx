/**
 * ScanReceipt — the landing signature: one meal, itemized like a measurement
 * receipt (grams / kcal / confidence per line, one line flagged for review).
 *
 * Mirrors the receipt in the prerendered static landing
 * (scripts/prerender-landing.mjs) so the page doesn't change when React
 * hydrates over the static HTML.
 */
import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';

import { Text } from '@/components';
import { LANDING_COLORS, LANDING_TYPE } from '@/utils';

const ROWS = [
  { name: 'Grilled salmon', grams: '142 g', kcal: '289 kcal', conf: 94, flagged: false },
  { name: 'Brown rice', grams: '186 g', kcal: '216 kcal', conf: 91, flagged: false },
  { name: 'Roasted broccoli', grams: '95 g', kcal: '33 kcal', conf: 88, flagged: false },
  { name: 'Avocado', grams: '64 g', kcal: '102 kcal', conf: 76, flagged: false },
  { name: 'Olive-oil dressing', grams: '~12 g', kcal: '45 kcal', conf: 61, flagged: true },
] as const;

/** Copper viewfinder corner — also used by the landing CTA panel. */
export function Corner({
  position,
  color = LANDING_COLORS.copper,
  size = 18,
  inset = 10,
}: {
  position: 'tl' | 'tr' | 'bl' | 'br';
  color?: string;
  size?: number;
  inset?: number;
}) {
  const style: ViewStyle = { position: 'absolute', width: size, height: size };
  if (position === 'tl' || position === 'tr') {
    style.top = inset;
    style.borderTopWidth = 2;
  } else {
    style.bottom = inset;
    style.borderBottomWidth = 2;
  }
  if (position === 'tl' || position === 'bl') {
    style.left = inset;
    style.borderLeftWidth = 2;
  } else {
    style.right = inset;
    style.borderRightWidth = 2;
  }
  return <View pointerEvents="none" style={[style, { borderColor: color }]} />;
}

interface ScanReceiptProps {
  /** Hide the confidence bars on very narrow layouts. */
  compact?: boolean;
}

export function ScanReceipt({ compact = false }: ScanReceiptProps) {
  return (
    <View
      style={styles.card}
      accessibilityLabel="Example meal scan: five foods itemized with grams, calories and confidence"
    >
      <Corner position="tl" />
      <Corner position="tr" />
      <Corner position="bl" />
      <Corner position="br" />

      <View style={styles.head}>
        <Text style={styles.headLabel}>MEAL SCAN · 12:42</Text>
        <View style={styles.chip}>
          <View style={styles.chipDot} />
          <Text style={styles.chipText}>DEPTH OK</Text>
        </View>
      </View>

      <View style={styles.rows}>
        {ROWS.map((row, index) => (
          <View key={row.name} style={[styles.row, index === ROWS.length - 1 && styles.rowLast]}>
            <View style={styles.nameCell}>
              <Text numberOfLines={1} style={styles.name}>
                {row.name}
              </Text>
              {row.flagged && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>REVIEW</Text>
                </View>
              )}
            </View>
            <Text style={styles.grams}>{row.grams}</Text>
            <Text style={styles.kcal}>{row.kcal}</Text>
            {!compact && (
              <View style={styles.bar}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${row.conf}%` },
                    row.flagged && styles.barFillFlagged,
                  ]}
                />
              </View>
            )}
            <Text style={[styles.conf, row.flagged && styles.confFlagged]}>{row.conf}%</Text>
          </View>
        ))}
      </View>

      <View style={styles.total}>
        <Text style={styles.totalLabel}>TOTAL · ALL LINES EDITABLE</Text>
        <Text style={styles.totalValue}>685 kcal</Text>
      </View>
      <View style={styles.macros}>
        <Text style={styles.macrosText}>P 37 g · C 56 g · F 35 g</Text>
        <Text style={styles.macrosText}>5 items · 1 flagged</Text>
      </View>

      <View style={styles.noteWrap}>
        <Text style={styles.note}>
          AI estimate — dressings and hidden oils are easy to miss, so that line asks for your eyes
          first.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: 560,
    backgroundColor: LANDING_COLORS.surface,
    borderWidth: 1,
    borderColor: LANDING_COLORS.borderSoft,
    borderRadius: 20,
    paddingHorizontal: 26,
    paddingTop: 26,
    paddingBottom: 20,
    ...(typeof document !== 'undefined'
      ? ({ boxShadow: '0 24px 64px rgba(23,21,17,0.08), 0 3px 10px rgba(23,21,17,0.04)' } as any)
      : {
          shadowColor: '#171511',
          shadowOffset: { width: 0, height: 14 },
          shadowRadius: 30,
          shadowOpacity: 0.09,
          elevation: 6,
        }),
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: LANDING_COLORS.border,
  },
  headLabel: {
    fontFamily: LANDING_TYPE.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: LANDING_COLORS.textMuted,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(47,122,106,0.10)',
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LANDING_COLORS.sage,
  },
  chipText: {
    fontFamily: LANDING_TYPE.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.3,
    color: LANDING_COLORS.sage,
  },
  rows: {
    paddingTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: LANDING_COLORS.borderSoft,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  nameCell: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  name: {
    flexShrink: 1,
    fontFamily: LANDING_TYPE.body,
    fontSize: 14.5,
    fontWeight: '500',
    color: LANDING_COLORS.text,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: LANDING_COLORS.tintCopper,
  },
  tagText: {
    fontFamily: LANDING_TYPE.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: LANDING_COLORS.copper,
  },
  grams: {
    width: 50,
    textAlign: 'right',
    fontFamily: LANDING_TYPE.mono,
    fontSize: 12,
    color: LANDING_COLORS.textMuted,
  },
  kcal: {
    width: 66,
    textAlign: 'right',
    fontFamily: LANDING_TYPE.mono,
    fontSize: 12,
    color: LANDING_COLORS.text,
  },
  bar: {
    width: 54,
    height: 4,
    borderRadius: 99,
    backgroundColor: LANDING_COLORS.borderSoft,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: LANDING_COLORS.sage,
  },
  barFillFlagged: {
    backgroundColor: LANDING_COLORS.copper,
  },
  conf: {
    width: 38,
    textAlign: 'right',
    fontFamily: LANDING_TYPE.mono,
    fontSize: 11,
    fontWeight: '700',
    color: LANDING_COLORS.sage,
  },
  confFlagged: {
    color: LANDING_COLORS.copper,
  },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 2,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: LANDING_COLORS.border,
  },
  totalLabel: {
    fontFamily: LANDING_TYPE.mono,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: LANDING_COLORS.textMuted,
  },
  totalValue: {
    fontFamily: LANDING_TYPE.mono,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: LANDING_COLORS.text,
  },
  macros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  macrosText: {
    fontFamily: LANDING_TYPE.mono,
    fontSize: 11.5,
    color: LANDING_COLORS.textMuted,
  },
  noteWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LANDING_COLORS.border,
  },
  note: {
    fontFamily: LANDING_TYPE.mono,
    fontSize: 11.5,
    lineHeight: 18,
    color: LANDING_COLORS.textFaint,
  },
});

export default ScanReceipt;
