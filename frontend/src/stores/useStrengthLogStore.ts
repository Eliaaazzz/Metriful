import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'glutes' | 'fullbody';

export interface StrengthSet {
  reps: number;
  weightKg: number;
}

export interface StrengthEntry {
  id: string;
  loggedAt: string; // ISO
  exercise: string;
  muscleGroup: MuscleGroup;
  sets: StrengthSet[];
  notes?: string;
}

export interface ExercisePR {
  exercise: string;
  oneRmKg: number; // Estimated 1RM via Epley formula
  bestSetWeightKg: number;
  bestSetReps: number;
  loggedAt: string;
}

interface StrengthLogState {
  entries: StrengthEntry[];
  /** PR per exercise, by lowercase exercise name. */
  prs: Record<string, ExercisePR>;
  logEntry: (entry: Omit<StrengthEntry, 'id' | 'loggedAt'> & { loggedAt?: string }) => StrengthEntry;
  deleteEntry: (id: string) => void;
  clear: () => void;
}

// Epley: 1RM ≈ w * (1 + reps/30)
const estimate1RM = (sets: StrengthSet[]): { oneRmKg: number; bestSetWeightKg: number; bestSetReps: number } => {
  let best1Rm = 0;
  let bestW = 0;
  let bestR = 0;
  for (const s of sets) {
    if (!s.reps || !s.weightKg) continue;
    const oneRm = s.weightKg * (1 + s.reps / 30);
    if (oneRm > best1Rm) {
      best1Rm = oneRm;
      bestW = s.weightKg;
      bestR = s.reps;
    }
  }
  return { oneRmKg: Math.round(best1Rm * 10) / 10, bestSetWeightKg: bestW, bestSetReps: bestR };
};

export const useStrengthLogStore = create<StrengthLogState>()(
  persist(
    (set, get) => ({
      entries: [],
      prs: {},
      logEntry: (input) => {
        const id = `s_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const entry: StrengthEntry = {
          id,
          loggedAt: input.loggedAt ?? new Date().toISOString(),
          exercise: input.exercise.trim(),
          muscleGroup: input.muscleGroup,
          sets: input.sets,
          notes: input.notes,
        };
        const key = entry.exercise.toLowerCase();
        const { oneRmKg, bestSetWeightKg, bestSetReps } = estimate1RM(entry.sets);
        const existingPr = get().prs[key];
        const isPr = !existingPr || oneRmKg > existingPr.oneRmKg;
        set((s) => ({
          entries: [entry, ...s.entries],
          prs: isPr && oneRmKg > 0
            ? {
                ...s.prs,
                [key]: {
                  exercise: entry.exercise,
                  oneRmKg,
                  bestSetWeightKg,
                  bestSetReps,
                  loggedAt: entry.loggedAt,
                },
              }
            : s.prs,
        }));
        return entry;
      },
      deleteEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      clear: () => set({ entries: [], prs: {} }),
    }),
    {
      name: 'strength-log-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export const EXERCISE_TEMPLATES: { group: MuscleGroup; exercises: string[] }[] = [
  { group: 'chest', exercises: ['Bench Press', 'Incline DB Press', 'Push-up', 'Cable Fly'] },
  { group: 'back', exercises: ['Deadlift', 'Pull-up', 'Lat Pulldown', 'Barbell Row'] },
  { group: 'shoulders', exercises: ['Overhead Press', 'Lateral Raise', 'Face Pull'] },
  { group: 'arms', exercises: ['Barbell Curl', 'Hammer Curl', 'Tricep Pushdown', 'Skull Crusher'] },
  { group: 'legs', exercises: ['Back Squat', 'Front Squat', 'Leg Press', 'Romanian Deadlift', 'Lunge'] },
  { group: 'core', exercises: ['Plank', 'Hanging Leg Raise', 'Cable Crunch'] },
  { group: 'glutes', exercises: ['Hip Thrust', 'Glute Bridge', 'Bulgarian Split Squat'] },
];
