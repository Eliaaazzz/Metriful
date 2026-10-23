import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { WarningCircle, X } from 'phosphor-react-native';
import { DetectedFood } from '@/services/nutritionApi';
import { BRAND_COLORS } from '@/utils';

/** Items below this recognition confidence get an attention-drawing "Check" chip. */
const CHECK_THRESHOLD = 0.6;

const PORTION_FACTORS = [
  { factor: 0.5, label: '½×' },
  { factor: 1, label: '1×' },
  { factor: 1.5, label: '1½×' },
] as const;

interface DetectedItemRowProps {
  item: DetectedFood;
  onIncrease: () => void;
  onDecrease: () => void;
  /** Remove this item entirely (mis-recognitions). */
  onRemove?: () => void;
  /** One-tap portion multiplier relative to the detected size (MFP/Lose It pattern). */
  portionFactor?: number;
  onPortionFactor?: (factor: number) => void;
}

/**
 * Displays a detected food item with +/- controls for adjusting portion size.
 * Uses intuitive units (piece, bowl, serving) from Smart Splitting AI.
 * Low-confidence items surface a "Check" chip (icon + text, not color alone);
 * high-confidence items pass quietly — the user only handles what needs a decision.
 */
export function DetectedItemRow({
  item,
  onIncrease,
  onDecrease,
  onRemove,
  portionFactor = 1,
  onPortionFactor,
}: DetectedItemRowProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 390;

  // Format display based on unit type
  const getAmountDisplay = () => {
    // For grams, show "100g" format
    if (item.unit === 'g') {
      return `${item.amount}g`;
    }
    // For countable units, show "2 piece" or just "1" if quantity is 1
    return item.amount === 1
      ? `1 ${item.unit}`
      : `${item.amount} ${item.unit}s`;
  };

  const confidencePercent = typeof item.confidence === 'number'
    ? Math.round(item.confidence * 100)
    : null;
  const needsCheck = typeof item.confidence === 'number' && item.confidence < CHECK_THRESHOLD;

  return (
    <View style={[styles.container, isCompact && styles.containerCompact, needsCheck && styles.containerCheck]}>
      <View style={[styles.info, isCompact && styles.infoCompact]}>
        <View style={[styles.headerRow, isCompact && styles.headerRowCompact]}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          {needsCheck ? (
            <View style={styles.checkPill} accessibilityLabel={`${item.name}: low confidence, please check`}>
              <WarningCircle size={13} color="#92400E" weight="fill" />
              <Text style={styles.checkPillText}>Check</Text>
            </View>
          ) : confidencePercent != null ? (
            <View style={styles.confidencePill}>
              <Text style={styles.confidenceText}>{confidencePercent}% match</Text>
            </View>
          ) : null}
          {onRemove && (
            <Pressable
              onPress={onRemove}
              hitSlop={8}
              style={styles.removeBtn}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.name}`}
            >
              <X size={14} color="#64748B" weight="bold" />
            </Pressable>
          )}
        </View>

        <Text style={styles.serving} numberOfLines={1}>
          {getAmountDisplay()}
          {item.unit && item.unit !== 'g' ? ' detected' : ''}
          {' · estimated'}
        </Text>

        <View style={styles.macroRow}>
          <View style={[styles.macroPill, styles.caloriePill]}>
            <Text style={styles.caloriePillText}>{Math.round(item.calories)} kcal</Text>
          </View>
          <View style={styles.macroPill}>
            <Text style={styles.macroText}>{Math.round(item.protein)}g protein</Text>
          </View>
          <View style={styles.macroPill}>
            <Text style={styles.macroText}>{Math.round(item.carbs)}g carbs</Text>
          </View>
        </View>

        {onPortionFactor && (
          <View style={styles.factorRow} accessibilityLabel={`Portion size for ${item.name}`}>
            <Text style={styles.factorLabel}>Portion</Text>
            {PORTION_FACTORS.map(({ factor, label }) => {
              const selected = Math.abs(portionFactor - factor) < 0.01;
              return (
                <Pressable
                  key={label}
                  onPress={() => onPortionFactor(factor)}
                  style={[styles.factorChip, selected && styles.factorChipSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={`Set ${item.name} portion to ${label}`}
                >
                  <Text style={[styles.factorChipText, selected && styles.factorChipTextSelected]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={[styles.amountControl, isCompact && styles.amountControlCompact]}>
        <Pressable
          onPress={onDecrease}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${item.name} amount`}
        >
          <Text style={styles.buttonText}>-</Text>
        </Pressable>
        <Text
          style={[styles.amount, isCompact && styles.amountCompact]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {getAmountDisplay()}
        </Text>
        <Pressable
          onPress={onIncrease}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${item.name} amount`}
        >
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  containerCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  containerCheck: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  info: {
    flex: 1,
    paddingRight: 12,
    gap: 10,
  },
  infoCompact: {
    paddingRight: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerRowCompact: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  confidencePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0E7490',
  },
  checkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
  },
  checkPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serving: {
    fontSize: 13,
    color: '#6B7280',
  },
  macroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  macroPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
  },
  caloriePill: {
    backgroundColor: BRAND_COLORS.primaryTint,
  },
  macroText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  caloriePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND_COLORS.primaryDark,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginRight: 2,
  },
  factorChip: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  factorChipSelected: {
    backgroundColor: BRAND_COLORS.primaryTint,
    borderColor: BRAND_COLORS.primary,
  },
  factorChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  factorChipTextSelected: {
    color: BRAND_COLORS.primaryDark,
  },
  amountControl: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 8,
    gap: 8,
  },
  amountControlCompact: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_COLORS.primaryDark,
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 72,
    textAlign: 'center',
    color: '#111827',
  },
  amountCompact: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
  },
});
