import { create } from 'zustand';

export interface ActiveWorkoutSession {
  workoutId: string;
  title: string;
  youtubeId?: string;
  thumbnailUrl?: string;
  startedAt: number; // ms epoch
  pausedAt?: number;
  totalPausedMs: number;
  estimatedCaloriesPerMin?: number;
}

interface WorkoutSessionState {
  session: ActiveWorkoutSession | null;
  start: (input: Omit<ActiveWorkoutSession, 'startedAt' | 'totalPausedMs'>) => void;
  pause: () => void;
  resume: () => void;
  finish: () => { durationMs: number; estimatedCalories: number } | null;
  cancel: () => void;
}

/**
 * useWorkoutSessionStore — single-active-session timer state.
 * Pattern source: Strava activity recording + Uber Eats order-in-progress.
 */
export const useWorkoutSessionStore = create<WorkoutSessionState>((set, get) => ({
  session: null,
  start: (input) =>
    set({
      session: {
        ...input,
        startedAt: Date.now(),
        totalPausedMs: 0,
      },
    }),
  pause: () =>
    set((s) => {
      if (!s.session || s.session.pausedAt) return s;
      return { session: { ...s.session, pausedAt: Date.now() } };
    }),
  resume: () =>
    set((s) => {
      if (!s.session || !s.session.pausedAt) return s;
      const additional = Date.now() - s.session.pausedAt;
      return {
        session: {
          ...s.session,
          pausedAt: undefined,
          totalPausedMs: s.session.totalPausedMs + additional,
        },
      };
    }),
  finish: () => {
    const s = get().session;
    if (!s) return null;
    const now = Date.now();
    const pausedTotal =
      s.totalPausedMs + (s.pausedAt ? now - s.pausedAt : 0);
    const durationMs = now - s.startedAt - pausedTotal;
    const minutes = Math.max(0, Math.round(durationMs / 60000));
    const est = (s.estimatedCaloriesPerMin ?? 8) * minutes;
    set({ session: null });
    return { durationMs, estimatedCalories: Math.round(est) };
  },
  cancel: () => set({ session: null }),
}));
