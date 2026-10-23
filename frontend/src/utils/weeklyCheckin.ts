/**
 * weeklyCheckin — MacroFactor-style weekly review, computed from existing weekly insights.
 *
 * Principles (from MacroFactor's coaching rules):
 *  - targets change only with the user's explicit approval;
 *  - every suggestion states its data coverage, and low coverage says so instead of guessing;
 *  - neutral language — no "failure", "cheating" or "bad" foods;
 *  - the adjustment is deliberately partial (half the observed gap, capped ±120 kcal) so one
 *    unusual week can't yank the target around. Behavior-based, not outcome-based: it aligns
 *    the target with what you actually ate, and says exactly that.
 */
import type { WeeklyInsightsResponse } from '@/types/mealHistory';

export interface WeeklyCheckinSuggestion {
  newTarget: number;
  delta: number;
  reason: string;
}

export interface WeeklyCheckin {
  weekKey: string;
  mealsLogged: number;
  daysWithLogs: number;
  onTargetDays: number;
  proteinTargetDays: number;
  avgCalories: number;
  calorieTarget: number | null;
  coverageLabel: string;
  insufficientData: boolean;
  suggestion: WeeklyCheckinSuggestion | null;
}

const MIN_DAYS = 4;
const MIN_MEALS = 8;
const MIN_GAP_KCAL = 150;
const MAX_STEP_KCAL = 120;
const MIN_STEP_KCAL = 50;

export function buildWeeklyCheckin(
  insights: WeeklyInsightsResponse,
  proteinGoal: number
): WeeklyCheckin {
  const daily = insights.dailyData ?? [];
  const daysWithLogs = daily.filter((d) => (d.mealCount ?? 0) > 0).length;
  const mealsLogged = insights.summary?.totalMeals ?? 0;
  const onTargetDays = daily.filter(
    (d) => d.mealCount > 0 && d.calories.percentage >= 90 && d.calories.percentage <= 110
  ).length;
  const proteinTargetDays =
    proteinGoal > 0 ? daily.filter((d) => d.mealCount > 0 && d.protein >= proteinGoal * 0.9).length : 0;
  const avgCalories = Math.round(insights.summary?.averageDailyCalories ?? 0);
  const calorieTarget =
    insights.userGoal?.dailyCalorieTarget ??
    (daily.find((d) => d.calories?.target > 0)?.calories.target ?? null);

  const insufficientData = daysWithLogs < MIN_DAYS || mealsLogged < MIN_MEALS;
  const coverageLabel = `Based on ${mealsLogged} logged ${mealsLogged === 1 ? 'meal' : 'meals'} across ${daysWithLogs} ${daysWithLogs === 1 ? 'day' : 'days'}.`;

  let suggestion: WeeklyCheckinSuggestion | null = null;
  if (!insufficientData && calorieTarget != null && calorieTarget > 0 && avgCalories > 0) {
    const gap = avgCalories - calorieTarget;
    if (Math.abs(gap) >= MIN_GAP_KCAL) {
      const step = Math.round(gap / 2 / 10) * 10;
      const delta = Math.max(-MAX_STEP_KCAL, Math.min(MAX_STEP_KCAL, step));
      if (Math.abs(delta) >= MIN_STEP_KCAL) {
        suggestion = {
          newTarget: calorieTarget + delta,
          delta,
          reason:
            `You averaged ${avgCalories} kcal/day against a ${calorieTarget} kcal target. ` +
            `Moving the target ${delta > 0 ? 'up' : 'down'} by ${Math.abs(delta)} kcal keeps it realistic ` +
            'without chasing one week.',
        };
      }
    }
  }

  return {
    weekKey: insights.dateRange?.startDate ?? 'unknown-week',
    mealsLogged,
    daysWithLogs,
    onTargetDays,
    proteinTargetDays,
    avgCalories,
    calorieTarget,
    coverageLabel,
    insufficientData,
    suggestion,
  };
}
