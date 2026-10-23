/**
 * WeeklyCheckinCard — MacroFactor-style weekly check-in.
 *
 * Shows this week's facts (meals logged, on-target days, protein days, average),
 * and — only when data coverage is sufficient — ONE suggested target change that the
 * user must explicitly Accept or decline ("Keep current target"). Accepting updates the
 * locally-stored AI goals (the same source useDailyNutrition reads). Neutral language
 * throughout; insufficient data is stated, never guessed around.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { CalendarCheck } from 'phosphor-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { useCheckinStore } from '@/stores/useCheckinStore';
import type { WeeklyInsightsResponse } from '@/types/mealHistory';
import { BRAND_COLORS, spacing } from '@/utils';
import { buildWeeklyCheckin } from '@/utils/weeklyCheckin';

/** Shared literal with ProfileScreen / useDailyNutrition (the AI-goals AsyncStorage slot). */
const GENERATED_GOALS_KEY = '@generated_fitness_goals';

interface WeeklyCheckinCardProps {
  insights: WeeklyInsightsResponse | undefined;
  proteinGoal: number;
}

export function WeeklyCheckinCard({ insights, proteinGoal }: WeeklyCheckinCardProps) {
  const queryClient = useQueryClient();
  const { decisionFor, decide } = useCheckinStore();
  const [applying, setApplying] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const checkin = useMemo(
    () => (insights ? buildWeeklyCheckin(insights, proteinGoal) : null),
    [insights, proteinGoal]
  );

  if (!checkin) return null;
  const decision = decisionFor(checkin.weekKey);
  if (decision && !confirmation) return null;

  const handleAccept = async () => {
    if (!checkin.suggestion || applying) return;
    setApplying(true);
    try {
      const raw = await AsyncStorage.getItem(GENERATED_GOALS_KEY);
      if (!raw) {
        // No locally-stored AI goals to adjust — targets come from the profile instead.
        setConfirmation('No adjustable AI target found — generate targets first from Targets.');
        decide(checkin.weekKey, 'kept');
        return;
      }
      const goals = JSON.parse(raw);
      const delta = checkin.suggestion.delta;
      goals.dailyCalories = {
        ...goals.dailyCalories,
        target: checkin.suggestion.newTarget,
        min: Math.max(1200, (goals.dailyCalories?.min ?? checkin.suggestion.newTarget - 150) + delta),
        max: (goals.dailyCalories?.max ?? checkin.suggestion.newTarget + 150) + delta,
      };
      await AsyncStorage.setItem(GENERATED_GOALS_KEY, JSON.stringify(goals));
      queryClient.invalidateQueries({ queryKey: ['dailyNutrition'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      decide(checkin.weekKey, 'accepted');
      setConfirmation(`Daily target updated to ${checkin.suggestion.newTarget} kcal.`);
    } catch {
      setConfirmation('Could not update the target — nothing was changed.');
    } finally {
      setApplying(false);
    }
  };

  const handleKeep = () => {
    decide(checkin.weekKey, 'kept');
    setConfirmation('Keeping your current target. See you next week.');
  };

  return (
    <View style={styles.card} accessibilityLabel="Weekly check-in">
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <CalendarCheck size={18} color="#111111" weight="duotone" />
        </View>
        <Text variant="caption" weight="bold" style={styles.eyebrow}>
          WEEKLY CHECK-IN
        </Text>
      </View>

      {confirmation ? (
        <Text variant="body" style={styles.bodyText}>
          {confirmation}
        </Text>
      ) : (
        <>
          <View style={styles.factsBlock}>
            <Text variant="body" style={styles.factLine}>
              • You logged {checkin.mealsLogged} meals on {checkin.daysWithLogs} days
            </Text>
            <Text variant="body" style={styles.factLine}>
              • Calories within range on {checkin.onTargetDays} {checkin.onTargetDays === 1 ? 'day' : 'days'}
            </Text>
            <Text variant="body" style={styles.factLine}>
              • Protein target reached on {checkin.proteinTargetDays} {checkin.proteinTargetDays === 1 ? 'day' : 'days'}
            </Text>
            {checkin.avgCalories > 0 && (
              <Text variant="body" style={styles.factLine}>
                • Daily average: {checkin.avgCalories} kcal
              </Text>
            )}
          </View>

          {checkin.insufficientData ? (
            <Text variant="caption" style={styles.coverage}>
              Not enough logged days this week for a target suggestion — the summary above still
              counts. {checkin.coverageLabel}
            </Text>
          ) : checkin.suggestion ? (
            <>
              <View style={styles.suggestionBlock}>
                <Text variant="body" weight="semibold" style={styles.suggestionTitle}>
                  Suggested change: {checkin.suggestion.delta > 0 ? 'increase' : 'decrease'} daily
                  target by {Math.abs(checkin.suggestion.delta)} kcal
                </Text>
                <Text variant="caption" style={styles.suggestionReason}>
                  {checkin.suggestion.reason}
                </Text>
                <Text variant="caption" style={styles.coverage}>
                  {checkin.coverageLabel} Your call — nothing changes without your OK.
                </Text>
              </View>
              <View style={styles.actionsRow}>
                <Pressable
                  onPress={handleAccept}
                  disabled={applying}
                  style={[styles.acceptBtn, applying && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Accept new target of ${checkin.suggestion.newTarget} calories`}
                >
                  <Text variant="body" weight="bold" style={styles.acceptText}>
                    Accept
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleKeep}
                  style={styles.keepBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Keep current target"
                >
                  <Text variant="body" weight="semibold" style={styles.keepText}>
                    Keep current target
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text variant="caption" style={styles.coverage}>
                Your average is close to the current target — no change suggested. {checkin.coverageLabel}
              </Text>
              <Pressable
                onPress={handleKeep}
                style={styles.keepBtn}
                accessibilityRole="button"
                accessibilityLabel="Dismiss weekly check-in"
              >
                <Text variant="body" weight="semibold" style={styles.keepText}>
                  Got it
                </Text>
              </Pressable>
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#EAEAEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#111111',
    letterSpacing: 1,
  },
  bodyText: {
    color: BRAND_COLORS.textSecondary,
  },
  factsBlock: {
    gap: 2,
  },
  factLine: {
    color: BRAND_COLORS.textSecondary,
  },
  suggestionBlock: {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: 4,
  },
  suggestionTitle: {
    color: BRAND_COLORS.textPrimary,
  },
  suggestionReason: {
    color: BRAND_COLORS.textSecondary,
    lineHeight: 18,
  },
  coverage: {
    color: BRAND_COLORS.textMuted,
    lineHeight: 17,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  acceptBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: {
    color: '#FFFFFF',
  },
  keepBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: '#EAEAEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepText: {
    color: BRAND_COLORS.textPrimary,
  },
});

export default WeeklyCheckinCard;
