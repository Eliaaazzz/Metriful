import { Text } from '@/components';
import { colors, radii, spacing } from '@/utils';
import { CalendarCheck } from 'phosphor-react-native';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

interface DayCell {
  date: string; // YYYY-MM-DD
  score: number; // 0..100 (use 0 to mean "no log")
}

interface ConsistencyHeatmapProps {
  /** Dense array of last-N-days scores keyed by date. */
  cells: DayCell[];
  /** Total days to render. Default 84 (12 weeks ≈ 3 months for mobile). */
  weeks?: number;
  onDayPress?: (cell: DayCell) => void;
}

const colorForScore = (score: number): string => {
  if (score <= 0) return 'rgba(17,17,17,0.06)';
  if (score < 25) return '#FFE2C7';
  if (score < 50) return '#FBC891';
  if (score < 75) return '#F89A4D';
  if (score < 90) return '#F97316';
  return '#C2410C';
};

/**
 * ConsistencyHeatmap — GitHub-style year grid, colored by daily score.
 * Pattern source: GitHub contribution graph + Strava heat map.
 */
export const ConsistencyHeatmap: React.FC<ConsistencyHeatmapProps> = ({
  cells,
  weeks = 12,
  onDayPress,
}) => {
  const totalDays = weeks * 7;
  // Build grid: rows = 7 days of week (Sun→Sat), cols = weeks (oldest→today)
  const byDate = useMemo(() => {
    const map: Record<string, DayCell> = {};
    cells.forEach((c) => {
      map[c.date] = c;
    });
    return map;
  }, [cells]);

  const grid = useMemo(() => {
    const out: DayCell[][] = Array.from({ length: 7 }, () => []);
    const today = new Date();
    // Align so today is in the right-most column at its own weekday row.
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const cell = byDate[key] || { date: key, score: 0 };
      out[d.getDay()].push(cell);
    }
    return out;
  }, [byDate, totalDays]);

  const loggedDays = cells.filter((c) => c.score > 0).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.iconBubble}>
            <CalendarCheck size={16} color="#F97316" weight="fill" />
          </View>
          <View>
            <Text variant="body" weight="bold" style={styles.title}>Consistency</Text>
            <Text variant="caption" style={styles.subtitle}>
              {loggedDays} active days in the last {weeks} weeks
            </Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gridContent}>
        <View style={styles.grid}>
          {grid.map((row, ri) => (
            <View key={ri} style={styles.row}>
              {row.map((cell) => (
                <Pressable
                  key={cell.date}
                  onPress={() => onDayPress?.(cell)}
                  style={[styles.day, { backgroundColor: colorForScore(cell.score) }]}
                  hitSlop={2}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <Text variant="caption" style={styles.legendLabel}>Less</Text>
        {[0, 25, 50, 75, 95].map((s) => (
          <View key={s} style={[styles.legendCell, { backgroundColor: colorForScore(s) }]} />
        ))}
        <Text variant="caption" style={styles.legendLabel}>More</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(249,115,22,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.light.textPrimary },
  subtitle: { color: colors.light.textSecondary, opacity: 0.8 },
  gridContent: {
    paddingHorizontal: spacing.lg,
  },
  grid: {
    flexDirection: 'column',
    gap: 3,
  },
  row: {
    flexDirection: 'row',
    gap: 3,
  },
  day: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  legendLabel: { color: colors.light.textSecondary, opacity: 0.7 },
  legendCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
});

export default ConsistencyHeatmap;
