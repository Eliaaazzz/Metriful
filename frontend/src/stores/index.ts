/**
 * Zustand Stores
 *
 * Centralized exports for all Zustand stores.
 */

export { getAuthState, useAuthStore } from './useAuthStore';
export type { UserInfo } from './useAuthStore';

export { getLanguage, getTranslations, useLanguageStore } from './useLanguageStore';
export type { Language, Translations } from './useLanguageStore';

export { useHydrationStore } from './useHydrationStore';
export { useSocialStore } from './useSocialStore';
export type { Friend, ActivityFeedItem, ActivityKind } from './useSocialStore';

export { useChallengeStore, CHALLENGE_TEMPLATES } from './useChallengeStore';
export type { ChallengeTemplate, ChallengeProgress, ChallengeType } from './useChallengeStore';

export { useWorkoutSessionStore } from './useWorkoutSessionStore';
export type { ActiveWorkoutSession } from './useWorkoutSessionStore';

export { useStrengthLogStore, EXERCISE_TEMPLATES } from './useStrengthLogStore';
export type { StrengthEntry, StrengthSet, MuscleGroup, ExercisePR } from './useStrengthLogStore';

export { useScanStore, parseAnalysisError } from './useScanStore';
export type { ActiveScan, ScanError, StartScanParams } from './useScanStore';
