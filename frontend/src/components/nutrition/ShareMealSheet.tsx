/**
 * ShareMealSheet — opt-in meal sharing with sensitive fields hidden by default.
 *
 * Strava-style "activity card", nutrition-safe: sharing is always user-triggered
 * (nothing is ever public by default), and calorie numbers are OFF unless the user
 * flips them on. What ships is a plain text share (photo stays on device).
 */
import React, { useState } from 'react';
import { Modal, Pressable, Share as RNShare, StyleSheet, Switch, View } from 'react-native';
import { X } from 'phosphor-react-native';

import { Text } from '@/components/Text';
import { BRAND_COLORS, spacing } from '@/utils';

export interface ShareMealData {
  mealType: string;
  foodNames: string[];
  calories: number;
  protein: number | null;
}

interface ShareMealSheetProps {
  visible: boolean;
  onClose: () => void;
  meal: ShareMealData;
}

export function ShareMealSheet({ visible, onClose, meal }: ShareMealSheetProps) {
  const [includeFoods, setIncludeFoods] = useState(true);
  const [includeProtein, setIncludeProtein] = useState(true);
  const [includeCalories, setIncludeCalories] = useState(false); // sensitive → off by default

  const previewLines = [
    `${meal.mealType.charAt(0).toUpperCase()}${meal.mealType.slice(1)} on Metriful`,
    ...(includeFoods && meal.foodNames.length > 0 ? [meal.foodNames.slice(0, 4).join(', ')] : []),
    ...(includeProtein && meal.protein != null ? [`${Math.round(meal.protein)} g protein`] : []),
    ...(includeCalories ? [`${Math.round(meal.calories)} kcal (estimated)`] : []),
  ];

  const handleShare = async () => {
    try {
      await RNShare.share({ message: previewLines.join('\n') });
      onClose();
    } catch {
      // Cancelled — no-op
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close share sheet" />
      <View style={styles.sheet}>
        <View style={styles.headerRow}>
          <Text variant="heading3" weight="bold" style={{ flex: 1 }}>
            Share this meal
          </Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <X size={22} color={BRAND_COLORS.textMuted} />
          </Pressable>
        </View>

        <View style={styles.preview}>
          {previewLines.map((line, index) => (
            <Text
              key={`${index}-${line}`}
              variant={index === 0 ? 'body' : 'caption'}
              weight={index === 0 ? 'semibold' : 'regular'}
              style={styles.previewLine}
            >
              {line}
            </Text>
          ))}
        </View>

        {[
          { label: 'Include foods', value: includeFoods, set: setIncludeFoods },
          { label: 'Include protein', value: includeProtein, set: setIncludeProtein },
          { label: 'Include calories', value: includeCalories, set: setIncludeCalories },
        ].map(({ label, value, set }) => (
          <View key={label} style={styles.toggleRow}>
            <Text variant="body" style={styles.toggleLabel}>
              {label}
            </Text>
            <Switch
              value={value}
              onValueChange={set}
              trackColor={{ true: BRAND_COLORS.primary, false: undefined }}
              accessibilityLabel={label}
            />
          </View>
        ))}

        <Text variant="caption" style={styles.note}>
          Sharing is always your call — nothing on Metriful is public by default.
        </Text>

        <Pressable
          onPress={handleShare}
          style={styles.shareBtn}
          accessibilityRole="button"
          accessibilityLabel="Share now"
        >
          <Text variant="body" weight="bold" style={styles.shareBtnText}>
            Share
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
    padding: spacing.lg,
    paddingBottom: 28,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preview: {
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.surface,
    padding: spacing.md,
    gap: 2,
  },
  previewLine: {
    color: BRAND_COLORS.textSecondary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  toggleLabel: {
    color: BRAND_COLORS.textPrimary,
  },
  note: {
    color: BRAND_COLORS.textMuted,
  },
  shareBtn: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  shareBtnText: {
    color: '#FFFFFF',
  },
});

export default ShareMealSheet;
