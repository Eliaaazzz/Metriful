/**
 * HowEstimatedSheet — "How was this estimated?" bottom drawer.
 *
 * Turns the estimation pipeline into user-visible trust: which method measured the
 * portion (depth vs photo scale), where nutrition numbers come from, and how confident
 * the recognition is. Everything stated here is honest about being an estimate.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Cube, Database, Gauge, X } from 'phosphor-react-native';

import { Text } from '@/components/Text';
import { BRAND_COLORS } from '@/utils';

interface HowEstimatedSheetProps {
  visible: boolean;
  onClose: () => void;
  /** True when a LiDAR volume accompanied this scan (portions measured, not guessed). */
  usedDepth: boolean;
  itemCount: number;
  /** 0..1 average recognition confidence across items, or null when unknown. */
  avgConfidence: number | null;
  onViewSources: () => void;
}

export function HowEstimatedSheet({
  visible,
  onClose,
  usedDepth,
  itemCount,
  avgConfidence,
  onViewSources,
}: HowEstimatedSheetProps) {
  const confidenceLabel =
    avgConfidence == null
      ? 'Not available'
      : avgConfidence >= 0.8
        ? `High (${Math.round(avgConfidence * 100)}%)`
        : avgConfidence >= 0.6
          ? `Medium (${Math.round(avgConfidence * 100)}%)`
          : `Low (${Math.round(avgConfidence * 100)}%)`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close sheet" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text variant="heading3" weight="bold" style={styles.title}>
            How was this estimated?
          </Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <X size={22} color={BRAND_COLORS.textMuted} />
          </Pressable>
        </View>

        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Cube size={20} color={BRAND_COLORS.primaryDark} weight="duotone" />
          </View>
          <View style={styles.rowCopy}>
            <Text variant="body" weight="semibold" style={styles.rowTitle}>
              Portion method
            </Text>
            <Text variant="caption" style={styles.rowBody}>
              {usedDepth
                ? 'Depth-assisted: LiDAR measured the food volume in this photo, so portion size comes from geometry plus a per-food density.'
                : 'Photo-scale estimate: no depth reading was available, so portions are estimated from the image and typical serving sizes. Adjust anything that looks off.'}
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Database size={20} color={BRAND_COLORS.primaryDark} weight="duotone" />
          </View>
          <View style={styles.rowCopy}>
            <Text variant="body" weight="semibold" style={styles.rowTitle}>
              Nutrition source
            </Text>
            <Text variant="caption" style={styles.rowBody}>
              An AI vision model identifies each food and estimates per-item calories and macros,
              cross-referenced against USDA FoodData Central values.
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Gauge size={20} color={BRAND_COLORS.primaryDark} weight="duotone" />
          </View>
          <View style={styles.rowCopy}>
            <Text variant="body" weight="semibold" style={styles.rowTitle}>
              Recognition confidence
            </Text>
            <Text variant="caption" style={styles.rowBody}>
              {`${confidenceLabel} across ${itemCount} ${itemCount === 1 ? 'item' : 'items'}. Items we're less sure about are marked "Check" so you can fix them in one tap.`}
            </Text>
          </View>
        </View>

        <Text variant="caption" style={styles.disclaimer}>
          All values are estimates for general wellness — not measurements or medical advice.
        </Text>

        <Pressable
          onPress={onViewSources}
          style={({ pressed }) => [styles.sourcesBtn, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel="View data sources"
        >
          <Text variant="body" weight="semibold" style={styles.sourcesBtnText}>
            View data sources
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 13, 10, 0.42)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: BRAND_COLORS.textPrimary,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: BRAND_COLORS.textPrimary,
  },
  rowBody: {
    color: BRAND_COLORS.textMuted,
    lineHeight: 18,
  },
  disclaimer: {
    color: BRAND_COLORS.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  sourcesBtn: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.surface,
  },
  sourcesBtnText: {
    color: BRAND_COLORS.textPrimary,
  },
});

export default HowEstimatedSheet;
