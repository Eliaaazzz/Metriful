import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ActivityKind =
  | 'meal_logged'
  | 'workout_done'
  | 'badge_earned'
  | 'streak_milestone'
  | 'goal_hit';

export interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface ActivityFeedItem {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  kind: ActivityKind;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  createdAt: string; // ISO
  kudosCount: number;
  /** Whether the current user has kudosed this item */
  userHasKudosed: boolean;
}

interface SocialState {
  friends: Friend[];
  feed: ActivityFeedItem[];
  /** Privacy: which activity types the current user opts into broadcasting */
  privacy: Record<ActivityKind, boolean>;
  addFriend: (f: Friend) => void;
  removeFriend: (id: string) => void;
  toggleKudos: (activityId: string) => void;
  togglePrivacy: (kind: ActivityKind) => void;
  /** Seed mock feed (for first run / dev mode) — replaced when backend lands */
  seedMockFeed: () => void;
  clear: () => void;
}

const defaultPrivacy: Record<ActivityKind, boolean> = {
  meal_logged: true,
  workout_done: true,
  badge_earned: true,
  streak_milestone: true,
  goal_hit: true,
};

const mockFeed: ActivityFeedItem[] = [
  {
    id: 'm1',
    userId: 'u_jane',
    username: 'jane_runs',
    kind: 'workout_done',
    title: 'Jane finished a 30-min cardio session',
    subtitle: '320 kcal · HIIT',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    kudosCount: 4,
    userHasKudosed: false,
  },
  {
    id: 'm2',
    userId: 'u_alex',
    username: 'alex_lifts',
    kind: 'badge_earned',
    title: 'Alex earned Protein PR',
    subtitle: 'Hit 215g protein in a day 💪',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    kudosCount: 12,
    userHasKudosed: true,
  },
  {
    id: 'm3',
    userId: 'u_mei',
    username: 'mei.kitchen',
    kind: 'meal_logged',
    title: 'Mei logged Mediterranean bowl',
    subtitle: '540 kcal · 38g protein',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    kudosCount: 2,
    userHasKudosed: false,
  },
  {
    id: 'm4',
    userId: 'u_sam',
    username: 'samrunsfar',
    kind: 'streak_milestone',
    title: 'Sam hit a 30-day streak 🔥',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    kudosCount: 28,
    userHasKudosed: false,
  },
];

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      friends: [],
      feed: [],
      privacy: defaultPrivacy,
      addFriend: (f) =>
        set((s) => (s.friends.some((x) => x.id === f.id) ? s : { friends: [...s.friends, f] })),
      removeFriend: (id) => set((s) => ({ friends: s.friends.filter((f) => f.id !== id) })),
      toggleKudos: (activityId) =>
        set((s) => ({
          feed: s.feed.map((a) =>
            a.id === activityId
              ? {
                  ...a,
                  userHasKudosed: !a.userHasKudosed,
                  kudosCount: a.kudosCount + (a.userHasKudosed ? -1 : 1),
                }
              : a
          ),
        })),
      togglePrivacy: (kind) =>
        set((s) => ({ privacy: { ...s.privacy, [kind]: !s.privacy[kind] } })),
      seedMockFeed: () => {
        if (get().feed.length === 0) set({ feed: mockFeed });
      },
      clear: () => set({ friends: [], feed: [], privacy: defaultPrivacy }),
    }),
    {
      name: 'social-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist feed (server-source-of-truth eventually).
      partialize: (state) => ({ friends: state.friends, privacy: state.privacy }),
    }
  )
);
