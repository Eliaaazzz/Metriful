/**
 * useMealFavoritesStore — client-side meal favorites for the Diary (Lifesum/Foodvisor pattern).
 *
 * Favorites make "eat the same thing often" one tap: star a logged meal in the Diary,
 * filter to favorites, re-log it. Stored locally (AsyncStorage) — there is no backend
 * meal-favorite entity yet; the snapshot carries everything re-logging needs.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { MealHistoryItem } from '@/types/mealHistory';

export interface FavoriteMealSnapshot {
  id: number;
  mealType: string;
  displayName: string;
  imageUrl: string | null;
  totalCalories: number;
  totalProtein: number | null;
  totalCarbs: number | null;
  totalFat: number | null;
  notes: string | null;
  savedAt: number;
}

interface MealFavoritesState {
  favorites: Record<number, FavoriteMealSnapshot>;
  isFavorite: (mealId: number) => boolean;
  toggleFavorite: (meal: MealHistoryItem) => void;
  removeFavorite: (mealId: number) => void;
}

const toSnapshot = (meal: MealHistoryItem): FavoriteMealSnapshot => ({
  id: meal.id,
  mealType: meal.mealType,
  displayName:
    meal.foodItems?.map((f) => f.displayName).filter(Boolean).slice(0, 3).join(', ') ||
    meal.mealType,
  imageUrl: meal.imageUrl ?? null,
  totalCalories: meal.totalCalories,
  totalProtein: meal.totalProtein ?? null,
  totalCarbs: meal.totalCarbs ?? null,
  totalFat: meal.totalFat ?? null,
  notes: meal.notes ?? null,
  savedAt: Date.now(),
});

export const useMealFavoritesStore = create<MealFavoritesState>()(
  persist(
    (set, get) => ({
      favorites: {},

      isFavorite: (mealId) => Boolean(get().favorites[mealId]),

      toggleFavorite: (meal) =>
        set((state) => {
          const next = { ...state.favorites };
          if (next[meal.id]) {
            delete next[meal.id];
          } else {
            next[meal.id] = toSnapshot(meal);
          }
          return { favorites: next };
        }),

      removeFavorite: (mealId) =>
        set((state) => {
          if (!state.favorites[mealId]) return state;
          const next = { ...state.favorites };
          delete next[mealId];
          return { favorites: next };
        }),
    }),
    {
      name: 'meal-favorites',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useMealFavoritesStore;
