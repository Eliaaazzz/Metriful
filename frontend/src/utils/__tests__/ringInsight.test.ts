import type { DailyNutritionData } from '@/hooks/useDailyNutrition';
import { buildRingInsight } from '../ringInsight';

const data = (overrides: Partial<DailyNutritionData> = {}): DailyNutritionData => ({
  calories: 1240,
  goal: 2050,
  protein: { current: 81, goal: 130 },
  carbs: { current: 140, goal: 220 },
  fat: { current: 40, goal: 70 },
  bloodSugarRise: 0,
  meals: [
    { id: '1', name: 'Oats', calories: 350, protein: 12, consumedAt: '2026-07-12T08:00:00Z' },
    { id: '2', name: 'Chicken bowl', calories: 650, protein: 52, consumedAt: '2026-07-12T12:30:00Z' },
  ],
  ...overrides,
});

describe('buildRingInsight', () => {
  it('answers where / why / next for protein', () => {
    const insight = buildRingInsight(data(), 'protein', 15);
    expect(insight.whereLine).toMatch(/81 of 130 g/);
    expect(insight.whyLine).toMatch(/leads with/);
    expect(insight.nextLine).toMatch(/Tonight: aim for about/);
  });

  it('handles an empty day without judgment', () => {
    const insight = buildRingInsight(data({ meals: [] }), 'calories', 9);
    expect(insight.whyLine).toMatch(/Nothing logged yet/);
  });

  it('stays neutral when above target', () => {
    const insight = buildRingInsight(
      data({ calories: 2400 }),
      'calories',
      21
    );
    expect(insight.nextLine).toMatch(/not a verdict/i);
    expect(insight.nextLine.toLowerCase()).not.toMatch(/fail|bad/);
  });

  it('reports remaining calories mid-day', () => {
    const insight = buildRingInsight(data(), 'calories', 14);
    expect(insight.nextLine).toMatch(/810 kcal left/);
  });
});
