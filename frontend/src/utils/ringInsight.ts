/**
 * ringInsight — turn a nutrition ring from a dashboard gauge into an action entry.
 *
 * Tapping a ring must answer three questions (Whoop/Oura pattern, non-judgmental):
 *   1. WHERE am I?   (current / goal)
 *   2. WHY?          (which meal slot drove it — from today's logged meals)
 *   3. WHAT'S NEXT?  (one concrete range for the rest of the day)
 */
import type { DailyNutritionData } from '@/hooks/useDailyNutrition';
import { mealSlotForHour } from '@/utils/scanStages';

export type RingMacro = 'calories' | 'protein' | 'carbs' | 'fat';

export interface RingInsight {
  title: string;
  whereLine: string;
  whyLine: string;
  nextLine: string;
}

const LABEL: Record<RingMacro, string> = {
  calories: 'Calories',
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
};

const UNIT: Record<RingMacro, string> = {
  calories: 'kcal',
  protein: 'g',
  carbs: 'g',
  fat: 'g',
};

const roundTo5 = (v: number) => Math.max(5, Math.round(v / 5) * 5);

const macroOfMeal = (
  meal: DailyNutritionData['meals'][number],
  macro: RingMacro
): number => {
  switch (macro) {
    case 'calories':
      return meal.calories || 0;
    case 'protein':
      return meal.protein || 0;
    case 'carbs':
      return meal.carbs || 0;
    case 'fat':
      return meal.fat || 0;
  }
};

export function buildRingInsight(
  data: DailyNutritionData,
  macro: RingMacro,
  hour: number = new Date().getHours()
): RingInsight {
  const current =
    macro === 'calories' ? data.calories : data[macro]?.current ?? 0;
  const goal = macro === 'calories' ? data.goal : data[macro]?.goal ?? 0;
  const unit = UNIT[macro];
  const remaining = goal - current;

  const whereLine =
    goal > 0
      ? `${Math.round(current)} of ${Math.round(goal)} ${unit} (${Math.round((current / goal) * 100)}%)`
      : `${Math.round(current)} ${unit} logged`;

  // WHY: attribute today's total to meal slots from logged meals.
  let whyLine: string;
  const meals = data.meals ?? [];
  if (meals.length === 0) {
    whyLine = 'Nothing logged yet today — the ring moves as you log.';
  } else {
    const bySlot = new Map<string, number>();
    meals.forEach((meal) => {
      const slot = mealSlotForHour(new Date(meal.consumedAt).getHours());
      bySlot.set(slot, (bySlot.get(slot) ?? 0) + macroOfMeal(meal, macro));
    });
    const slots = [...bySlot.entries()].sort((a, b) => b[1] - a[1]);
    const [topSlot, topValue] = slots[0];
    if (slots.length === 1) {
      whyLine = `All of it so far came from ${topSlot.toLowerCase()} (${Math.round(topValue)} ${unit}).`;
    } else {
      const [lowSlot, lowValue] = slots[slots.length - 1];
      whyLine = `${topSlot} leads with ${Math.round(topValue)} ${unit}; ${lowSlot.toLowerCase()} added ${Math.round(lowValue)} ${unit}.`;
    }
  }

  // NEXT: one concrete, neutral suggestion for the rest of the day.
  let nextLine: string;
  const eveningAhead = hour < 21;
  if (remaining > 0 && goal > 0) {
    if (macro === 'protein' && eveningAhead && remaining > 10) {
      const hi = roundTo5(Math.min(remaining, 60));
      const lo = roundTo5(Math.max(10, hi * 0.7));
      nextLine = lo >= hi
        ? `Tonight: aim for about ${hi} g.`
        : `Tonight: aim for about ${lo}–${hi} g.`;
    } else if (macro === 'calories') {
      nextLine = `About ${Math.round(remaining / 10) * 10} kcal left for the rest of today.`;
    } else {
      nextLine = `${Math.round(remaining)} ${unit} left within today's target.`;
    }
  } else if (goal > 0) {
    nextLine =
      macro === 'protein'
        ? 'Protein target reached — nicely done.'
        : `Above today's current target by ${Math.abs(Math.round(remaining))} ${unit} — noted, not a verdict. Tomorrow starts fresh.`;
  } else {
    nextLine = 'Set a daily target to get a concrete next step here.';
  }

  return { title: LABEL[macro], whereLine, whyLine, nextLine };
}
