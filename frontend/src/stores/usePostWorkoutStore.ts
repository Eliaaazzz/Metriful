/**
 * usePostWorkoutStore — bridges "workout finished" to nutrition (Strava→recovery-meal loop).
 *
 * WorkoutSessionStrip's finish() result used to be discarded at the navigator root; now it
 * lands here so the Dashboard can offer "Log a recovery meal" while it's still relevant
 * (within 2 hours). Persisted so an app restart right after a workout doesn't lose the moment.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface FinishedWorkout {
  at: number;
  durationMs: number;
  estimatedCalories: number;
}

/** Recovery window: post-workout protein timing is most relevant within ~2 hours. */
export const RECOVERY_WINDOW_MS = 2 * 60 * 60 * 1000;

interface PostWorkoutState {
  lastFinished: FinishedWorkout | null;
  dismissedAt: number | null;
  recordFinish: (result: { durationMs: number; estimatedCalories: number }) => void;
  dismiss: () => void;
  /** The workout to offer a recovery meal for, or null (outside window / dismissed). */
  activeRecovery: () => FinishedWorkout | null;
}

export const usePostWorkoutStore = create<PostWorkoutState>()(
  persist(
    (set, get) => ({
      lastFinished: null,
      dismissedAt: null,

      recordFinish: (result) =>
        set({
          lastFinished: {
            at: Date.now(),
            durationMs: result.durationMs,
            estimatedCalories: result.estimatedCalories,
          },
          dismissedAt: null,
        }),

      dismiss: () => set({ dismissedAt: Date.now() }),

      activeRecovery: () => {
        const { lastFinished, dismissedAt } = get();
        if (!lastFinished) return null;
        if (Date.now() - lastFinished.at > RECOVERY_WINDOW_MS) return null;
        if (dismissedAt && dismissedAt >= lastFinished.at) return null;
        return lastFinished;
      },
    }),
    {
      name: 'post-workout',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default usePostWorkoutStore;
