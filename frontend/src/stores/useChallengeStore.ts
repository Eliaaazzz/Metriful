import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ChallengeType =
  | 'protein_5_of_7'
  | 'log_breakfast_7'
  | 'workouts_4_of_14'
  | 'calories_in_range_10';

export interface ChallengeTemplate {
  id: ChallengeType;
  title: string;
  description: string;
  emoji: string;
  durationDays: 7 | 14 | 30;
  goalCount: number; // e.g., 5 (out of 7), 4 (out of 14)
  xpReward: number;
  metric: 'protein_target_hit' | 'breakfast_logged' | 'workout_done' | 'calories_in_range';
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: 'protein_5_of_7',
    title: 'Protein 5/7',
    description: 'Hit your protein target on 5 days this week.',
    emoji: '💪',
    durationDays: 7,
    goalCount: 5,
    xpReward: 100,
    metric: 'protein_target_hit',
  },
  {
    id: 'log_breakfast_7',
    title: 'Breakfast streak',
    description: 'Log breakfast 7 days in a row.',
    emoji: '🥞',
    durationDays: 7,
    goalCount: 7,
    xpReward: 80,
    metric: 'breakfast_logged',
  },
  {
    id: 'workouts_4_of_14',
    title: '4 in 14',
    description: 'Finish 4 workouts in 14 days.',
    emoji: '🏋️',
    durationDays: 14,
    goalCount: 4,
    xpReward: 120,
    metric: 'workout_done',
  },
  {
    id: 'calories_in_range_10',
    title: 'Calories on target',
    description: 'Stay within ±10% of your calorie target for 10 days.',
    emoji: '🎯',
    durationDays: 30,
    goalCount: 10,
    xpReward: 150,
    metric: 'calories_in_range',
  },
];

export interface ChallengeProgress {
  templateId: ChallengeType;
  startedAt: string; // ISO
  endsAt: string;    // ISO
  progress: number;  // count of qualifying days
  completed: boolean;
  completedAt?: string;
}

interface ChallengeState {
  active: ChallengeProgress[];
  totalXp: number;
  join: (template: ChallengeTemplate) => void;
  leave: (templateId: ChallengeType) => void;
  bumpProgress: (templateId: ChallengeType) => void;
  clear: () => void;
}

export const useChallengeStore = create<ChallengeState>()(
  persist(
    (set, get) => ({
      active: [],
      totalXp: 0,
      join: (template) =>
        set((s) => {
          if (s.active.some((c) => c.templateId === template.id && !c.completed)) return s;
          const now = new Date();
          const ends = new Date(now);
          ends.setDate(ends.getDate() + template.durationDays);
          return {
            active: [
              ...s.active,
              {
                templateId: template.id,
                startedAt: now.toISOString(),
                endsAt: ends.toISOString(),
                progress: 0,
                completed: false,
              },
            ],
          };
        }),
      leave: (templateId) =>
        set((s) => ({ active: s.active.filter((c) => c.templateId !== templateId) })),
      bumpProgress: (templateId) =>
        set((s) => {
          const tpl = CHALLENGE_TEMPLATES.find((t) => t.id === templateId);
          if (!tpl) return s;
          return {
            active: s.active.map((c) => {
              if (c.templateId !== templateId || c.completed) return c;
              const next = Math.min(tpl.goalCount, c.progress + 1);
              const completed = next >= tpl.goalCount;
              return {
                ...c,
                progress: next,
                completed,
                completedAt: completed ? new Date().toISOString() : c.completedAt,
              };
            }),
            totalXp: (() => {
              const ch = s.active.find((c) => c.templateId === templateId);
              if (!ch) return s.totalXp;
              const willComplete = ch.progress + 1 >= tpl.goalCount && !ch.completed;
              return willComplete ? s.totalXp + tpl.xpReward : s.totalXp;
            })(),
          };
        }),
      clear: () => set({ active: [], totalXp: 0 }),
    }),
    {
      name: 'challenge-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
