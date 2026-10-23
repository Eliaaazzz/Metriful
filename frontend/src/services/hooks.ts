import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { RecipeCard, RecipeSortOption, SavedRecipe, SavedWorkout, UploadRecipePayload, UploadWorkoutPayload, WorkoutCard, WorkoutSortOption } from '@/types';
import {
    getRecommendedRecipes,
    getRecommendedWorkouts,
    getRecipeById,
    getSavedRecipes,
    getSavedWorkouts,
    removeSavedRecipe,
    removeSavedWorkout,
    saveRecipe,
    saveWorkout,
    uploadRecipeImage,
    uploadWorkoutImage,
} from './api';
import { searchRecipes, searchWorkouts } from './imageRecognitionApi';
import { getRecipesByGoal } from './goalRecipesApi';

// Default pagination and sort values (for backwards compatibility)
export const DEFAULT_SAVED_PAGE_SIZE = 20;

export const DEFAULT_WORKOUT_SORT: WorkoutSortOption = Object.freeze({
  field: 'savedAt',
  direction: 'desc',
} as const);

export const DEFAULT_RECIPE_SORT: RecipeSortOption = Object.freeze({
  field: 'savedAt',
  direction: 'desc',
} as const);

const mutationKeys = {
  uploadWorkout: ['upload', 'workout'] as const,
  uploadRecipe: ['upload', 'recipe'] as const,
  saveWorkout: (userId?: string, id?: string) => ['save', 'workout', userId, id] as const,
  saveRecipe: (userId?: string, id?: string) => ['save', 'recipe', userId, id] as const,
};

const queryKeys = {
  savedWorkouts: (userId?: string) => ['workouts', 'saved', userId] as const,
  savedRecipes: (userId?: string) => ['recipes', 'saved', userId] as const,
  recommendedWorkouts: (fitnessGoal?: string | null) => ['workouts', 'recommended', fitnessGoal] as const,
  recommendedRecipes: (fitnessGoal?: string | null) => ['recipes', 'recommended', fitnessGoal] as const,
};

const SAVED_ITEMS_STALE_TIME_MS = 1000 * 60 * 30; // 30 minutes
const SAVED_ITEMS_GC_TIME_MS = 1000 * 60 * 60; // 60 minutes

export const useUploadWorkout = () =>
  useMutation<WorkoutCard[], Error, { uri: string; metadata?: UploadWorkoutPayload }>({
    mutationKey: mutationKeys.uploadWorkout,
    mutationFn: (payload) => uploadWorkoutImage(payload.uri, payload.metadata),
  });

export const useUploadRecipe = () =>
  useMutation<RecipeCard[], Error, { uri: string; payload?: UploadRecipePayload }>({
    mutationKey: mutationKeys.uploadRecipe,
    mutationFn: (payload) => uploadRecipeImage(payload.uri, payload.payload),
  });

export const useSaveWorkout = (userId?: string) => {
  const queryClient = useQueryClient();
  return useMutation<SavedWorkout, Error, string>({
    mutationKey: mutationKeys.saveWorkout(userId),
    mutationFn: (workoutId) => {
      if (!userId) {
        return Promise.reject(new Error('Missing user context'));
      }
      return saveWorkout(workoutId, userId);
    },
    onSuccess: (savedWorkout) => {
      if (!userId) return;
      queryClient.setQueryData<SavedWorkout[]>(queryKeys.savedWorkouts(userId), (existing = []) => {
        if (existing.find((item) => item.id === savedWorkout.id)) {
          return existing;
        }
        return [savedWorkout, ...existing];
      });
    },
  });
};

export const useSaveRecipe = (userId?: string) => {
  const queryClient = useQueryClient();
  return useMutation<SavedRecipe, Error, string>({
    mutationKey: mutationKeys.saveRecipe(userId),
    mutationFn: (recipeId) => {
      if (!userId) {
        return Promise.reject(new Error('Missing user context'));
      }
      return saveRecipe(recipeId, userId);
    },
    onSuccess: (savedRecipe) => {
      if (!userId) return;
      queryClient.setQueryData<SavedRecipe[]>(queryKeys.savedRecipes(userId), (existing = []) => {
        if (existing.find((item) => item.id === savedRecipe.id)) {
          return existing;
        }
        return [savedRecipe, ...existing];
      });
    },
  });
};

export const useSavedWorkouts = (userId?: string) =>
  useQuery<SavedWorkout[], Error>({
    queryKey: queryKeys.savedWorkouts(userId),
    enabled: !!userId,
    queryFn: () => getSavedWorkouts(userId),
    staleTime: SAVED_ITEMS_STALE_TIME_MS,
    gcTime: SAVED_ITEMS_GC_TIME_MS,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

export const useSavedRecipes = (userId?: string) =>
  useQuery<SavedRecipe[], Error>({
    queryKey: queryKeys.savedRecipes(userId),
    enabled: !!userId,
    queryFn: () => getSavedRecipes(userId),
    staleTime: SAVED_ITEMS_STALE_TIME_MS,
    gcTime: SAVED_ITEMS_GC_TIME_MS,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

export const useRecommendedWorkouts = (fitnessGoal?: string | null, userId?: string) =>
  useQuery<WorkoutCard[], Error>({
    queryKey: queryKeys.recommendedWorkouts(fitnessGoal),
    queryFn: () => getRecommendedWorkouts(fitnessGoal, userId),
    staleTime: 1000 * 60 * 10,
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });

export const useRecommendedRecipes = (fitnessGoal?: string | null, userId?: string) =>
  useQuery<RecipeCard[], Error>({
    queryKey: queryKeys.recommendedRecipes(fitnessGoal),
    queryFn: () => getRecommendedRecipes(fitnessGoal, userId),
    staleTime: 1000 * 60 * 10,
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });

// Search hooks for keyword search
export const useSearchWorkouts = (query: string, level?: string) =>
  useQuery<WorkoutCard[], Error>({
    queryKey: ['search', 'workouts', query, level],
    enabled: query.length >= 2,
    queryFn: () => searchWorkouts(query, level),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

export const useSearchRecipes = (query: string) =>
  useQuery<RecipeCard[], Error>({
    queryKey: ['search', 'recipes', query],
    enabled: query.length >= 2,
    queryFn: () => searchRecipes(query),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

// Remove workout hook
export const useRemoveWorkout = (userId?: string) => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (workoutId) => {
      if (!userId) {
        return Promise.reject(new Error('Missing user context'));
      }
      return removeSavedWorkout(workoutId, userId);
    },
    onSuccess: (_, workoutId) => {
      if (!userId) return;
      queryClient.setQueryData<SavedWorkout[]>(queryKeys.savedWorkouts(userId), (existing = []) => {
        return existing.filter((item) => item.id !== workoutId);
      });
    },
  });
};

// Remove recipe hook
export const useRemoveRecipe = (userId?: string) => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (recipeId) => {
      if (!userId) {
        return Promise.reject(new Error('Missing user context'));
      }
      return removeSavedRecipe(recipeId, userId);
    },
    onSuccess: (_, recipeId) => {
      if (!userId) return;
      queryClient.setQueryData<SavedRecipe[]>(queryKeys.savedRecipes(userId), (existing = []) => {
        return existing.filter((item) => item.id !== recipeId);
      });
    },
  });
};

// Goal-based recipes hook for browsing recipes by fitness goal
export const useRecipesByGoal = (goal: string, limit: number = 20) =>
  useQuery<RecipeCard[], Error>({
    queryKey: ['recipes', 'by-goal', goal, limit],
    queryFn: () => getRecipesByGoal(goal, limit),
    enabled: !!goal,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });

// Hook to fetch full recipe details by ID (includes ingredients and steps)
export const useRecipeById = (recipeId?: string) =>
  useQuery<RecipeCard | null, Error>({
    queryKey: ['recipe', recipeId],
    queryFn: () => (recipeId ? getRecipeById(recipeId) : Promise.resolve(null)),
    enabled: !!recipeId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

/**
 * useRecipesByTag — Uber-Eats-style themed row hook.
 * Piggybacks on the existing search endpoint; tags like "quick", "high protein",
 * "trending healthy" are routed through full-text search server-side.
 */
export const useRecipesByTag = (tag: string, limit: number = 10) =>
  useQuery<RecipeCard[], Error>({
    queryKey: ['recipes', 'tag', tag, limit],
    queryFn: async () => {
      const all = await searchRecipes(tag);
      return all.slice(0, limit);
    },
    enabled: !!tag,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
    placeholderData: keepPreviousData,
  });
