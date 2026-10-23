import type { Achievement } from '@/components/AchievementsCard';
import { useMealHistory } from './useMealHistory';
import { useWeeklyInsights } from './useMealHistory';
import { useMemo } from 'react';

interface UseAchievementsInput {
  currentStreak?: number;
  totalMealsLogged?: number;
  totalWorkoutsThisWeek?: number;
  bestProteinDayGrams?: number;
}

/**
 * useAchievements — derive Strava-style achievement badges from existing user data.
 * No new backend. Combines streak, meal history aggregates, and weekly insights.
 */
export function useAchievements(input: UseAchievementsInput = {}): Achievement[] {
  const history = useMealHistory({ page: 0, size: 100 }, true);
  const weekly = useWeeklyInsights(undefined, true);

  return useMemo(() => {
    const meals = history.data?.content ?? [];
    const streak = input.currentStreak ?? 0;
    const totalMeals = input.totalMealsLogged ?? history.data?.totalElements ?? meals.length;
    const workoutsThisWeek = input.totalWorkoutsThisWeek ?? 0;

    // Highest single-day protein (g) from recent history sample, or input override.
    const proteinByDay: Record<string, number> = {};
    meals.forEach((m) => {
      const day = m.consumedAt?.slice(0, 10) ?? '';
      proteinByDay[day] = (proteinByDay[day] || 0) + (m.totalProtein || 0);
    });
    const bestProteinDay =
      input.bestProteinDayGrams ?? Math.max(0, ...Object.values(proteinByDay));

    // Count distinct days within ±10% of calorie target (rough Macro Master proxy).
    const dailyData = weekly.data?.dailyData ?? [];
    const calTarget = weekly.data?.userGoal.dailyCalorieTarget ?? 0;
    const macroMasterDays =
      calTarget > 0
        ? dailyData.filter((d) => {
            const pct = d.calories.percentage;
            return pct >= 90 && pct <= 110;
          }).length
        : 0;

    const hydrationHero =
      dailyData.filter((d) => (d as any).hydrationCups >= 8).length;

    const veggieHits = meals.filter((m) =>
      m.foodItems?.some((f) => /salad|veggie|broccoli|spinach|kale|carrot/i.test(f.displayName))
    ).length;

    return [
      {
        id: 'first-100-meals',
        label: '100 Meals',
        emoji: '🍽️',
        description: 'Log 100 meals.',
        progress: Math.min(1, totalMeals / 100),
        unlocked: totalMeals >= 100,
      },
      {
        id: 'protein-pr',
        label: 'Protein PR',
        emoji: '💪',
        description: 'Hit 200g of protein in a single day.',
        progress: Math.min(1, bestProteinDay / 200),
        unlocked: bestProteinDay >= 200,
      },
      {
        id: 'veggie-champion',
        label: 'Veggie Champ',
        emoji: '🥗',
        description: 'Log 30 veggie-led meals.',
        progress: Math.min(1, veggieHits / 30),
        unlocked: veggieHits >= 30,
      },
      {
        id: 'cardio-crusher',
        label: 'Cardio Crusher',
        emoji: '🏃',
        description: 'Finish 10 workouts in a single week.',
        progress: Math.min(1, workoutsThisWeek / 10),
        unlocked: workoutsThisWeek >= 10,
      },
      {
        id: 'hydration-hero',
        label: 'Hydration Hero',
        emoji: '💧',
        description: 'Hit 8 cups of water on 7 days.',
        progress: Math.min(1, hydrationHero / 7),
        unlocked: hydrationHero >= 7,
      },
      {
        id: 'macro-master',
        label: 'Macro Master',
        emoji: '🎯',
        description: 'Land within ±10% of calorie target for 7 days.',
        progress: Math.min(1, macroMasterDays / 7),
        unlocked: macroMasterDays >= 7,
      },
      {
        id: 'streak-7',
        label: '7-Day Streak',
        emoji: '🔥',
        description: 'Log meals 7 days in a row.',
        progress: Math.min(1, streak / 7),
        unlocked: streak >= 7,
      },
      {
        id: 'streak-30',
        label: '30-Day Streak',
        emoji: '🌟',
        description: 'Log meals 30 days in a row.',
        progress: Math.min(1, streak / 30),
        unlocked: streak >= 30,
      },
    ];
  }, [history.data, weekly.data, input.currentStreak, input.totalMealsLogged, input.totalWorkoutsThisWeek, input.bestProteinDayGrams]);
}
