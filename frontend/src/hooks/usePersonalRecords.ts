import { useMemo } from 'react';
import { useMealHistory, useWeeklyInsights } from './useMealHistory';

export interface PersonalRecord {
  id: string;
  label: string;
  emoji: string;
  value: string;
  detail?: string;
}

/**
 * usePersonalRecords — auto-detect PRs from existing nutrition data.
 * Pattern source: Strava personal records auto-discovery.
 */
export function usePersonalRecords(currentStreak?: number): PersonalRecord[] {
  const history = useMealHistory({ page: 0, size: 200 }, true);
  const weekly = useWeeklyInsights(undefined, true);

  return useMemo(() => {
    const meals = history.data?.content ?? [];
    const days = weekly.data?.dailyData ?? [];

    // Aggregate by day
    const proteinByDay: Record<string, number> = {};
    const caloriesByDay: Record<string, number> = {};
    const mealsByDay: Record<string, number> = {};
    const sodiumByDay: Record<string, number> = {};
    meals.forEach((m) => {
      const day = m.consumedAt?.slice(0, 10) ?? '';
      if (!day) return;
      proteinByDay[day] = (proteinByDay[day] || 0) + (m.totalProtein || 0);
      caloriesByDay[day] = (caloriesByDay[day] || 0) + (m.totalCalories || 0);
      mealsByDay[day] = (mealsByDay[day] || 0) + 1;
      const sodium =
        m.foodItems?.reduce((acc, f: any) => acc + (Number(f.sodium) || 0), 0) ?? 0;
      sodiumByDay[day] = (sodiumByDay[day] || 0) + sodium;
    });

    const bestProtein = Math.max(0, ...Object.values(proteinByDay));
    const mostMealsDay = Math.max(0, ...Object.values(mealsByDay));
    const lowestSodiumDays = Object.entries(sodiumByDay).filter(([, v]) => v > 0);
    const lowestSodium = lowestSodiumDays.length
      ? Math.min(...lowestSodiumDays.map(([, v]) => v))
      : 0;

    // Best week from weekly insights
    const onTargetWeek = days.filter((d) => {
      const pct = d.calories.percentage;
      return pct >= 90 && pct <= 110;
    }).length;

    const records: PersonalRecord[] = [
      {
        id: 'longest-streak',
        label: 'Longest Streak',
        emoji: '🔥',
        value: `${currentStreak ?? 0}d`,
        detail: 'Consecutive days with at least 1 meal logged.',
      },
      {
        id: 'protein-pr',
        label: 'Protein PR',
        emoji: '💪',
        value: `${Math.round(bestProtein)}g`,
        detail: 'Highest single-day protein total.',
      },
      {
        id: 'most-meals',
        label: 'Most Meals',
        emoji: '🍽️',
        value: `${mostMealsDay} / day`,
        detail: 'Most meals logged in a single day.',
      },
      {
        id: 'on-target-week',
        label: 'On-Target Days',
        emoji: '🎯',
        value: `${onTargetWeek} / 7`,
        detail: 'Days this week within ±10% of calorie target.',
      },
    ];

    if (lowestSodium > 0) {
      records.push({
        id: 'cleanest-sodium',
        label: 'Cleanest Sodium',
        emoji: '🧂',
        value: `${Math.round(lowestSodium)}mg`,
        detail: 'Lowest-sodium day on record.',
      });
    }

    return records;
  }, [history.data, weekly.data, currentStreak]);
}
