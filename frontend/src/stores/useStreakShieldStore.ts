/**
 * useStreakShieldStore — user-controlled streak pause (travel, illness, holidays).
 *
 * Loss aversion is the strongest retention lever — and the most dangerous one to abuse.
 * A pause makes the streak opt-out during life events instead of punishing them: while
 * paused, streak UI shows a calm "paused" state and never a broken/zeroed message.
 * (Server streak semantics are unchanged; this governs presentation and messaging.)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface StreakShieldState {
  pausedUntil: number | null;
  pause: (days: number) => void;
  resume: () => void;
  isPaused: () => boolean;
}

export const useStreakShieldStore = create<StreakShieldState>()(
  persist(
    (set, get) => ({
      pausedUntil: null,
      pause: (days) => set({ pausedUntil: Date.now() + days * 24 * 60 * 60 * 1000 }),
      resume: () => set({ pausedUntil: null }),
      isPaused: () => {
        const until = get().pausedUntil;
        return until != null && until > Date.now();
      },
    }),
    {
      name: 'streak-shield',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useStreakShieldStore;
