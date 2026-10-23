import type { WeeklyInsightsResponse } from '@/types/mealHistory';
import { buildWeeklyCheckin } from '../weeklyCheckin';

const day = (date: string, kcal: number, target: number, protein: number, meals: number) => ({
  date,
  calories: { actual: kcal, target, percentage: target > 0 ? (kcal / target) * 100 : 0 },
  protein,
  carbs: 100,
  fat: 50,
  sugar: 20,
  mealCount: meals,
});

const insights = (overrides: Partial<WeeklyInsightsResponse> = {}): WeeklyInsightsResponse => ({
  dateRange: { startDate: '2026-07-06', endDate: '2026-07-12' },
  summary: {
    totalMeals: 16,
    totalCalories: 12600,
    averageDailyCalories: 2100,
    averageProtein: 110,
    averageCarbs: 220,
    averageFat: 70,
    averageSugar: 40,
  },
  dailyData: [
    day('2026-07-06', 2100, 1800, 120, 3),
    day('2026-07-07', 2200, 1800, 95, 3),
    day('2026-07-08', 2050, 1800, 130, 3),
    day('2026-07-09', 2150, 1800, 125, 3),
    day('2026-07-10', 2000, 1800, 118, 2),
    day('2026-07-11', 0, 1800, 0, 0),
    day('2026-07-12', 0, 1800, 0, 0),
  ],
  macrosDistribution: {
    protein: { grams: 110, percentage: 25, caloriesFromMacro: 440 },
    carbs: { grams: 220, percentage: 45, caloriesFromMacro: 880 },
    fat: { grams: 70, percentage: 30, caloriesFromMacro: 630 },
  },
  sugarWarning: { hasWarning: false, averageDailySugar: 40, recommendedLimit: 50, daysExceeded: 0, message: '' },
  userGoal: { dailyCalorieTarget: 1800, dailyProteinTarget: 130, dailyCarbsTarget: 220, dailyFatTarget: 70 },
  ...overrides,
});

describe('buildWeeklyCheckin', () => {
  it('suggests a partial, capped increase when intake consistently exceeds the target', () => {
    const checkin = buildWeeklyCheckin(insights(), 130);
    expect(checkin.insufficientData).toBe(false);
    expect(checkin.suggestion).not.toBeNull();
    // gap = 2100-1800 = 300 → half = 150 → capped at +120
    expect(checkin.suggestion!.delta).toBe(120);
    expect(checkin.suggestion!.newTarget).toBe(1920);
    expect(checkin.suggestion!.reason).toMatch(/averaged 2100/);
  });

  it('declares insufficient data instead of guessing on a sparse week', () => {
    const sparse = insights({
      summary: { ...insights().summary, totalMeals: 4 },
      dailyData: insights().dailyData.map((d, i) => (i < 2 ? d : { ...d, mealCount: 0 })),
    });
    const checkin = buildWeeklyCheckin(sparse, 130);
    expect(checkin.insufficientData).toBe(true);
    expect(checkin.suggestion).toBeNull();
  });

  it('suggests nothing when the average is close to the target', () => {
    const close = insights({
      summary: { ...insights().summary, averageDailyCalories: 1850 },
    });
    const checkin = buildWeeklyCheckin(close, 130);
    expect(checkin.suggestion).toBeNull();
    expect(checkin.insufficientData).toBe(false);
  });

  it('counts protein-target days against the supplied goal', () => {
    const checkin = buildWeeklyCheckin(insights(), 130);
    // protein days ≥ 0.9*130=117: days with 120,130,125,118 → 4
    expect(checkin.proteinTargetDays).toBe(4);
  });

  it('uses neutral wording in the suggestion', () => {
    const checkin = buildWeeklyCheckin(insights(), 130);
    expect(checkin.suggestion!.reason.toLowerCase()).not.toMatch(/fail|bad|cheat/);
  });
});
