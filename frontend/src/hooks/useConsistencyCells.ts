import { useMemo } from 'react';
import { useMealHistory } from './useMealHistory';

interface DayCell {
  date: string;
  score: number;
}

/**
 * useConsistencyCells — derive heatmap cells from meal history.
 * Score per day: # meals logged → 0/25/50/75/100 buckets (each meal +25, capped at 100).
 * Backend can later swap in a precomputed daily score.
 */
export function useConsistencyCells(weeks: number = 12): DayCell[] {
  const totalDays = weeks * 7;
  const startDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (totalDays - 1));
    return d.toISOString().split('T')[0];
  }, [totalDays]);

  const history = useMealHistory({ page: 0, size: 500, startDate, sort: 'consumedAt,desc' }, true);

  return useMemo(() => {
    const meals = history.data?.content ?? [];
    const countByDay: Record<string, number> = {};
    meals.forEach((m) => {
      const day = m.consumedAt?.slice(0, 10);
      if (!day) return;
      countByDay[day] = (countByDay[day] || 0) + 1;
    });

    const out: DayCell[] = [];
    const today = new Date();
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const c = countByDay[key] || 0;
      const score = Math.min(100, c * 25);
      out.push({ date: key, score });
    }
    return out;
  }, [history.data, totalDays]);
}
