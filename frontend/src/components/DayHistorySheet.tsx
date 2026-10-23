import { DetailBottomSheet, Text } from '@/components';
import { useMealHistory } from '@/hooks/useMealHistory';
import { useStrengthLogStore } from '@/stores/useStrengthLogStore';
import { colors, radii, spacing } from '@/utils';
import { Barbell, ForkKnife } from 'phosphor-react-native';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

interface DayHistorySheetProps {
  date?: string; // YYYY-MM-DD
  onClose: () => void;
}

/**
 * DayHistorySheet — opens when a heatmap cell is tapped.
 * Shows the meals + strength sessions for that day + simple score readout.
 */
export const DayHistorySheet: React.FC<DayHistorySheetProps> = ({ date, onClose }) => {
  const visible = !!date;
  // Pull a wide window of meals; filter client-side for the selected day.
  const history = useMealHistory({ page: 0, size: 500, sort: 'consumedAt,desc' }, visible);
  const strengthEntries = useStrengthLogStore((s) => s.entries);

  const { meals, totalCals, totalProtein } = useMemo(() => {
    if (!date) return { meals: [] as any[], totalCals: 0, totalProtein: 0 };
    const all = history.data?.content ?? [];
    const list = all.filter((m) => m.consumedAt?.startsWith(date));
    const cals = list.reduce((acc, m) => acc + (m.totalCalories || 0), 0);
    const prot = list.reduce((acc, m) => acc + (m.totalProtein || 0), 0);
    return { meals: list, totalCals: Math.round(cals), totalProtein: Math.round(prot) };
  }, [history.data, date]);

  const strength = useMemo(() => {
    if (!date) return [] as typeof strengthEntries;
    return strengthEntries.filter((e) => e.loggedAt?.startsWith(date));
  }, [strengthEntries, date]);

  const score = Math.min(100, meals.length * 25);

  return (
    <DetailBottomSheet
      visible={visible}
      onClose={onClose}
      title={date ? new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : ''}
      maxHeightRatio={0.8}
    >
      {!date ? null : (
        <View style={{ gap: spacing.md }}>
          {/* Summary */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCell}>
              <Text variant="heading2" weight="bold">{score}</Text>
              <Text variant="caption" style={styles.summaryLabel}>Day score</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text variant="heading2" weight="bold">{meals.length}</Text>
              <Text variant="caption" style={styles.summaryLabel}>Meals</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text variant="heading2" weight="bold">{totalCals}</Text>
              <Text variant="caption" style={styles.summaryLabel}>kcal</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text variant="heading2" weight="bold">{totalProtein}g</Text>
              <Text variant="caption" style={styles.summaryLabel}>Protein</Text>
            </View>
          </View>

          {/* Meals */}
          {meals.length > 0 ? (
            <View style={{ gap: spacing.xs }}>
              <Text variant="caption" weight="bold" style={styles.sectionLabel}>MEALS</Text>
              {meals.map((m) => (
                <View key={m.id} style={styles.row}>
                  <View style={styles.iconBubble}>
                    <ForkKnife size={14} color={colors.light.primary} weight="bold" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="caption" weight="semibold" numberOfLines={1}>
                      {m.foodItems?.[0]?.displayName || m.mealType || 'Meal'}
                    </Text>
                    <Text variant="caption" style={styles.rowMeta}>
                      {Math.round(m.totalCalories || 0)} cal · {Math.round(m.totalProtein || 0)}g protein
                    </Text>
                  </View>
                  <Text variant="caption" style={styles.rowTime}>
                    {new Date(m.consumedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text variant="caption" style={styles.empty}>No meals logged this day.</Text>
          )}

          {/* Strength sessions */}
          {strength.length > 0 && (
            <View style={{ gap: spacing.xs }}>
              <Text variant="caption" weight="bold" style={styles.sectionLabel}>STRENGTH</Text>
              {strength.map((s) => {
                const totalReps = s.sets.reduce((acc, st) => acc + st.reps, 0);
                const topWeight = Math.max(0, ...s.sets.map((st) => st.weightKg));
                return (
                  <View key={s.id} style={styles.row}>
                    <View style={[styles.iconBubble, { backgroundColor: 'rgba(249,115,22,0.16)' }]}>
                      <Barbell size={14} color="#F97316" weight="bold" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="caption" weight="semibold" numberOfLines={1}>{s.exercise}</Text>
                      <Text variant="caption" style={styles.rowMeta}>
                        {s.sets.length} sets · {totalReps} reps · top {topWeight}kg
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </DetailBottomSheet>
  );
};

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,17,0.04)',
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
  },
  summaryLabel: { color: colors.light.textSecondary, opacity: 0.85 },
  sectionLabel: {
    color: colors.light.textSecondary,
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.06)',
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${colors.light.primary}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMeta: { color: colors.light.textSecondary, opacity: 0.85 },
  rowTime: { color: colors.light.textSecondary, opacity: 0.85 },
  empty: { color: colors.light.textSecondary, opacity: 0.85, paddingVertical: spacing.sm },
});

export default DayHistorySheet;
