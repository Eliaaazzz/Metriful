/**
 * scanStages — pure stage model for the meal-scan progress UI (Uber-Eats-style
 * "process visibility": staged checklist + honest ETA instead of an infinite spinner).
 *
 * Real milestones are compression-done and response-received; the stages inside the single
 * network call are elapsed-time estimates against a rolling expected duration, which is honest
 * as long as the ETA copy says "~" and degrades to "finishing up" when overdue.
 */
export type ScanStatus = 'idle' | 'compressing' | 'analyzing' | 'ready' | 'error';

export type StageState = 'done' | 'active' | 'pending';

export interface ScanStage {
  key: string;
  label: string;
  state: StageState;
}

export interface ScanStageView {
  stages: ScanStage[];
  /** Whole seconds remaining, or null when not applicable (idle/ready/error/overdue). */
  etaSeconds: number | null;
  /** True when elapsed exceeded the expected duration while still analyzing. */
  overdue: boolean;
}

const LABELS = {
  photo: 'Photo ready',
  optimize: 'Optimizing photo',
  identify: 'Identifying foods',
  portion: 'Estimating portions',
  nutrition: 'Matching nutrition data',
} as const;

/** Fraction of the analyze call attributed to each simulated sub-stage. */
const IDENTIFY_UNTIL = 0.45;
const PORTION_UNTIL = 0.75;

export function deriveScanStages(
  status: ScanStatus,
  elapsedMs: number,
  expectedMs: number
): ScanStageView {
  const mk = (key: keyof typeof LABELS, state: StageState): ScanStage => ({
    key,
    label: LABELS[key],
    state,
  });

  if (status === 'idle') {
    return {
      stages: [
        mk('photo', 'pending'),
        mk('optimize', 'pending'),
        mk('identify', 'pending'),
        mk('portion', 'pending'),
        mk('nutrition', 'pending'),
      ],
      etaSeconds: null,
      overdue: false,
    };
  }

  if (status === 'ready' || status === 'error') {
    const state: StageState = 'done';
    return {
      stages: [
        mk('photo', state),
        mk('optimize', state),
        mk('identify', state),
        mk('portion', state),
        mk('nutrition', state),
      ],
      etaSeconds: null,
      overdue: false,
    };
  }

  if (status === 'compressing') {
    return {
      stages: [
        mk('photo', 'done'),
        mk('optimize', 'active'),
        mk('identify', 'pending'),
        mk('portion', 'pending'),
        mk('nutrition', 'pending'),
      ],
      etaSeconds: Math.max(1, Math.round(expectedMs / 1000)),
      overdue: false,
    };
  }

  // analyzing: simulate sub-stage from elapsed fraction of the expected duration
  const safeExpected = expectedMs > 0 ? expectedMs : 6000;
  const fraction = elapsedMs / safeExpected;
  const overdue = fraction >= 1;
  const identify: StageState = fraction < IDENTIFY_UNTIL ? 'active' : 'done';
  const portion: StageState =
    fraction < IDENTIFY_UNTIL ? 'pending' : fraction < PORTION_UNTIL ? 'active' : 'done';
  const nutrition: StageState = fraction < PORTION_UNTIL ? 'pending' : 'active';

  return {
    stages: [
      mk('photo', 'done'),
      mk('optimize', 'done'),
      mk('identify', identify),
      mk('portion', portion),
      mk('nutrition', nutrition),
    ],
    etaSeconds: overdue ? null : Math.max(1, Math.ceil((safeExpected - elapsedMs) / 1000)),
    overdue,
  };
}

/** Meal-slot hint by local hour, used for "Lunch scan is almost ready" copy. */
export function mealSlotForHour(hour: number): 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' {
  if (hour >= 4 && hour < 11) return 'Breakfast';
  if (hour >= 11 && hour < 15) return 'Lunch';
  if (hour >= 17 && hour < 22) return 'Dinner';
  return 'Snack';
}
