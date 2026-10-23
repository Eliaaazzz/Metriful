/**
 * nextStep — ONE concrete suggestion after logging a meal (never five generic tips).
 *
 * Neutral by design (MacroFactor language rules): being above target is stated as fact
 * with a constructive framing — no red alarms, no "failure"/"cheat"/"bad food" wording.
 */
export interface NextStepInput {
  /** kcal remaining for today AFTER this meal (may be negative). */
  kcalRemaining: number;
  /** grams of protein remaining for today AFTER this meal (may be negative). */
  proteinRemaining: number;
  /** Local hour 0-23 at logging time. */
  hour: number;
}

const roundTo5 = (v: number) => Math.max(5, Math.round(v / 5) * 5);

export function buildNextStep({ kcalRemaining, proteinRemaining, hour }: NextStepInput): string {
  const nextMeal = hour < 10 ? 'lunch' : hour < 16 ? 'dinner' : 'your next meal';

  if (kcalRemaining < -50) {
    return 'Above today’s current target — that happens. A lighter, protein-forward next meal keeps the week on track.';
  }

  if (proteinRemaining > 15 && hour < 21) {
    const hi = roundTo5(Math.min(proteinRemaining, 60));
    const lo = roundTo5(Math.max(10, hi * 0.7));
    return lo >= hi
      ? `Aim for about ${hi} g protein at ${nextMeal}.`
      : `Aim for about ${lo}–${hi} g protein at ${nextMeal}.`;
  }

  if (kcalRemaining > 250) {
    return `You’re on track — about ${Math.round(kcalRemaining / 10) * 10} kcal left for ${nextMeal}.`;
  }

  if (kcalRemaining >= -50) {
    return 'Right around today’s target — nicely done. Water and an early night finish the day well.';
  }

  return 'Logged — consistency is what moves the trend.';
}
