/**
 * Behavior Insights — feature #221.
 *
 * Mirror of {@code com.fitnessapp.backend.behavior.dto.*} on the backend. The
 * shared {@code apiClient} unwraps {@code ApiEnvelope<T>}, so consumers see
 * these types directly.
 */

export type Confidence = 'high' | 'med' | 'low';

export interface Insight {
  id: number;
  behaviorKey: string;
  label: string;
  deltaScore: number;        // mean(yes) - mean(no), in Daily Score points
  cohensD: number;
  pValue: number;
  sampleYes: number;
  sampleNo: number;
  confidence: Confidence;
  positive: boolean;
  sentence: string;          // server-formatted, ready to render
  disclaimer: string;        // AI disclaimer per CLAUDE.md
  computedAt: string;
  pinned: boolean;
}

export interface BehaviorDayPoint {
  day: string;               // ISO date
  observed: boolean;
  dailyScore: number | null;
}

export interface ScoreSplit {
  onYesDays: number[];
  onNoDays: number[];
}

export interface InsightDetail {
  insight: Insight;
  calendar: BehaviorDayPoint[];
  scoreSplit: ScoreSplit;
}

export interface ColdStartStatus {
  daysLogged: number;
  target: number;
  unlocked: boolean;
}
