/**
 * useCheckinStore — remembers the user's weekly check-in decision per week,
 * so the card asks once and then stays quiet (accept OR keep both count as decided).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type CheckinDecision = 'accepted' | 'kept';

interface CheckinState {
  decisions: Record<string, CheckinDecision>;
  decisionFor: (weekKey: string) => CheckinDecision | null;
  decide: (weekKey: string, decision: CheckinDecision) => void;
}

export const useCheckinStore = create<CheckinState>()(
  persist(
    (set, get) => ({
      decisions: {},
      decisionFor: (weekKey) => get().decisions[weekKey] ?? null,
      decide: (weekKey, decision) =>
        set((state) => ({ decisions: { ...state.decisions, [weekKey]: decision } })),
    }),
    {
      name: 'weekly-checkin-decisions',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useCheckinStore;
