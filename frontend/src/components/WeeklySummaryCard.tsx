import { Text } from '@/components';
import type { WeeklyInsightsResponse } from '@/types/mealHistory';
import { colors, radii, spacing } from '@/utils';
import * as Haptics from 'expo-haptics';
import { Confetti, Share, TrendUp } from 'phosphor-react-native';
import React, { useMemo } from 'react';
import { Pressable, Share as RNShare, StyleSheet, View } from 'react-native';

interface WeeklySummaryCardProps {
  insights: WeeklyInsightsResponse | undefined;
  isLoading?: boolean;
  /** Optional override of the user's name for the share message */
  userName?: string;
}

/**
 * WeeklySummaryCard — Sunday recap card with PRs, totals, and one-tap share.
 * Pattern source: Strava Weekly Roundup + Spotify Wrapped.
 */
export const WeeklySummaryCard: React.FC<WeeklySummaryCardProps> = ({
  insights,
  isLoading,
  userName,
}) => {
  const stats = useMemo(() => {
    if (!insights) return null;
    const days = insights.dailyData ?? [];
    const onTarget = days.filter((d) => {
      const pct = d.calories.percentage;
      return pct >= 90 && pct <= 110;
    }).length;
    const bestProtein = Math.max(0, ...days.map((d) => d.protein || 0));
    const totalMeals = insights.summary.totalMeals;
    const avgCals = Math.round(insights.summary.averageDailyCalories);
    return { onTarget, bestProtein: Math.round(bestProtein), totalMeals, avgCals };
  }, [insights]);

  const handleShare = async () => {
    if (!stats) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const prefix = userName ? `${userName}'s week` : 'My week';
    // Privacy-safe by default: consistency + achievements only — no calorie numbers
    // leave the app unless the user chooses to share them from a meal's own share sheet.
    const message = [
      `${prefix} on Metriful:`,
      `• ${stats.totalMeals} meals logged`,
      `• ${stats.onTarget}/7 days on-target`,
      `• Protein PR: ${stats.bestProtein}g`,
    ].join('\n');
    try {
      await RNShare.share({ message });
    } catch {
      // Cancelled — no-op
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text variant="caption" style={styles.subtitle}>Loading this week’s recap…</Text>
      </View>
    );
  }
  if (!insights || !stats) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.iconBubble}>
            <Confetti size={16} color="#111111" weight="fill" />
          </View>
          <View>
            <Text variant="body" weight="bold" style={styles.title}>This week in review</Text>
            <Text variant="caption" style={styles.subtitle}>
              {insights.dateRange.startDate} → {insights.dateRange.endDate}
            </Text>
          </View>
        </View>
        <Pressable onPress={handleShare} hitSlop={8} style={styles.shareBtn}>
          <Share size={14} color="#FFFFFF" weight="bold" />
          <Text variant="caption" weight="bold" style={styles.shareBtnText}>Share</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text variant="heading2" weight="bold" style={styles.cellValue}>{stats.totalMeals}</Text>
          <Text variant="caption" style={styles.cellLabel}>Meals logged</Text>
        </View>
        <View style={styles.cell}>
          <Text variant="heading2" weight="bold" style={styles.cellValue}>{stats.onTarget}<Text variant="caption" style={styles.outOf}> / 7</Text></Text>
          <Text variant="caption" style={styles.cellLabel}>On-target days</Text>
        </View>
        <View style={styles.cell}>
          <Text variant="heading2" weight="bold" style={styles.cellValue}>{stats.bestProtein}<Text variant="caption" style={styles.outOf}>g</Text></Text>
          <Text variant="caption" style={styles.cellLabel}>Protein PR</Text>
        </View>
        <View style={styles.cell}>
          <Text variant="heading2" weight="bold" style={styles.cellValue}>{stats.avgCals}</Text>
          <Text variant="caption" style={styles.cellLabel}>Avg kcal/day</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TrendUp size={14} color={colors.light.textSecondary} weight="bold" />
        <Text variant="caption" style={styles.footerText}>
          New week starts Monday — keep the streak alive.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
    marginHorizontal: spacing.lg,
    backgroundColor: '#F6F6F6',
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EAEAEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.light.textPrimary },
  subtitle: { color: colors.light.textSecondary, opacity: 0.8 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.light.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
  },
  shareBtnText: { color: '#FFFFFF' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cell: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: spacing.md,
  },
  cellValue: { color: colors.light.textPrimary },
  outOf: { color: colors.light.textSecondary },
  cellLabel: { color: colors.light.textSecondary, opacity: 0.8 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: { color: colors.light.textSecondary, opacity: 0.85 },
});

export default WeeklySummaryCard;
