import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TourGuideZone, TourScrollView, useTourGuideController, useTourNavigation } from '@/components/tour/TourProvider';
import type { IconProps } from 'phosphor-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    useWindowDimensions,
    View
} from 'react-native';
import Animated, {
    FadeInDown,
    FadeInRight,
    useReducedMotion,
} from 'react-native-reanimated';


import { Barbell, CameraPlus, CaretRight, ChartLine, Drop, EnvelopeSimple, Fire, FlagCheckered, Grains, Leaf, NavigationArrow, PencilSimple, PersonSimpleRun, Scales, Sneaker, Target, User } from 'phosphor-react-native';
import { Image } from 'expo-image';
import { ScrollView as RNScrollView } from 'react-native';
import { AchievementsCard, AdaptiveHomeHero, BentoCard, ChallengesCard, DetailBottomSheet, FriendsFeedCard, LogAgainCard, SafeAreaWrapper, Text, WeeklySummaryCard } from '@/components';
import { BENTO_CARD_STYLES, BENTO_CARD_WEB_STYLES, MOBILE_CARD_STYLES } from '@/components/common/BentoCard';
import { PermissionRequestModal, PermissionType } from '@/components/common/PermissionRequestModal';
import { StateView } from '@/components/common/StateView';
import { DailyScoreCard, DailyTasksCard, DashboardWidgets, NutritionInsightsCard, QuickActionsCard, StreakBadge, SuggestionGrid, WelcomeBar } from '@/components/dashboard';
import { RecoveryMealCard } from '@/components/dashboard/RecoveryMealCard';
import { ScanStatusChip } from '@/components/dashboard/ScanStatusChip';
import { StreakSafetyCard } from '@/components/dashboard/StreakSafetyCard';
import { WeeklyCheckinCard } from '@/components/dashboard/WeeklyCheckinCard';
import { buildRingInsight, RingMacro } from '@/utils/ringInsight';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { ScreenLayout } from '@/components/layout';
import { WeightLogModal } from '@/components/weight';
import { MealImage } from '@/components/nutrition/MealImage';
import { NutritionRingsCard } from '@/components/nutrition/NutritionRingsCard';
import { NutritionRingsSkeleton } from '@/components/nutrition/NutritionRingsSkeleton';
import WelcomeTourCard from '@/components/WelcomeTourCard';
import { SNAP_MEAL_STEP, TODAYS_NUTRITION_STEP } from '@/config/tourSteps';
import useCurrentUser from '@/hooks/useCurrentUser';
import { useDailyNutrition } from '@/hooks/useDailyNutrition';
import { useMealHistory, useReLogMeal, useWeeklyInsights } from '@/hooks/useMealHistory';
import { useAchievements } from '@/hooks/useAchievements';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useTourStatus } from '@/hooks/useTourStatus';
import { GeneratedGoals, getActiveGoal, GoalType } from '@/services/geminiApi';
import { useGoals, useGoalStatistics } from '@/services/goalsApi';
import { useHydrationStore, useLanguageStore } from '@/stores';
import {
  APP_PAGE_PATHS,
  BRAND_COLORS,
  EXPERIENCE_COLORS,
  SUPPORT_EMAIL_URL,
  colors,
  openAppPage,
  openExternalUrl,
  radii,
  saasShadows,
  spacing,
  useContentBottomPadding,
  useRightPanelVisible,
  useSidebarVisible,
} from '@/utils';
import { GENERATED_GOALS_KEY } from './ProfileScreen';

// Illustration assets for web suggestion grid
const illustrationScanMeal = require('@/../assets/illustrations/hero-healthy-eating.svg');
const illustrationWorkouts = require('@/../assets/illustrations/fitness-tracker.svg');
const illustrationRecipes = require('@/../assets/illustrations/cooking.svg');
const illustrationWeekly = require('@/../assets/illustrations/data-trends.svg');
const illustrationTargets = require('@/../assets/illustrations/healthy-habit.svg');
const illustrationHistory = require('@/../assets/illustrations/fruit-salad.svg');

// Smart time-based greeting
const getTimeGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 22) return 'Good Evening';
  return 'Good Night';
};

// Generate a contextual sub-line based on current data
const getContextLine = (streak: number, caloriePercent: number, mealCount: number): string => {
  if (streak >= 7) return `${streak}-day streak, keep it up!`;
  if (streak >= 3) return `${streak} days in a row!`;
  if (caloriePercent >= 75) return `${Math.round(caloriePercent)}% of daily goal reached`;
  if (mealCount > 0) return `${mealCount} meal${mealCount > 1 ? 's' : ''} logged today`;
  return "Let's make today count";
};

// Goal type display config - using target/flag icons to differentiate from streak's fire
const GOAL_TYPE_CONFIG: Record<GoalType, { label: string; Icon: React.ComponentType<IconProps>; color: string }> = {
  fat_loss: { label: 'Fat Loss', Icon: Target, color: BRAND_COLORS.semantic.error },
  muscle_gain: { label: 'Build Muscle', Icon: FlagCheckered, color: BRAND_COLORS.macros.protein },
  diabetes_control: { label: 'Nutrition Balance', Icon: Leaf, color: BRAND_COLORS.macros.carbs },
};

const PLAN_PREVIEW_CONFIG: Record<GoalType, {
  title: string;
  description: string;
  focus: string;
  weeklyRhythm: string;
  outcome: string;
  targetHint: string;
}> = {
  fat_loss: {
    title: 'Cut cleanly without losing momentum',
    description: 'Keep the week lighter, protein-forward, and easier to sustain from Monday to Sunday.',
    focus: 'Protein-first meals',
    weeklyRhythm: '3 lifts + recovery cardio',
    outcome: 'Steadier fat loss',
    targetHint: 'Deficit-led calorie target',
  },
  muscle_gain: {
    title: 'Build size with enough fuel to recover',
    description: 'Shift the week toward strength, surplus calories, and more consistent recovery between sessions.',
    focus: 'Strength + recovery',
    weeklyRhythm: '4 focused training days',
    outcome: 'More size and strength',
    targetHint: 'Surplus-led calorie target',
  },
  diabetes_control: {
    title: 'Keep meals balanced and energy more even',
    description: 'Bias the week toward steadier carbs, more fibre, and routines you can repeat without friction.',
    focus: 'Balanced carbs + fibre',
    weeklyRhythm: 'Daily walks + light strength',
    outcome: 'More stable energy',
    targetHint: 'Balanced macro target',
  },
};

// Helper to determine meal type from time
const getMealType = (date: Date): string => {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'Breakfast';
  if (hour >= 11 && hour < 16) return 'Lunch'; // Extended lunch to 4pm
  if (hour >= 16 && hour < 22) return 'Dinner';
  return 'Snack';
};

const formatMealName = (mealName: string): string => {
  const tokens = mealName
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length <= 1) {
    return mealName;
  }

  const counts = new Map<string, { label: string; count: number }>();
  tokens.forEach((token) => {
    const key = token.toLowerCase();
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    counts.set(key, { label: token, count: 1 });
  });

  return Array.from(counts.values())
    .map(({ label, count }) => (count > 1 ? `${label} x${count}` : label))
    .join(', ');
};

const MODERATE_T2D_NET_CARB_RISE_MGDL_PER_G = 4;
const MODERATE_T2D_PROTEIN_RISE_MGDL_PER_G = 0.5;
const ESTIMATED_FIBER_RATIO = 0.1;

const estimateMacroBloodSugarRiseMgDl = (carbsG: number, proteinG: number): number => {
  const safeCarbs = Math.max(0, carbsG || 0);
  const safeProtein = Math.max(0, proteinG || 0);
  const estimatedFiber = Math.round(safeCarbs * ESTIMATED_FIBER_RATIO);
  const netCarbs = Math.max(0, safeCarbs - estimatedFiber);
  return Math.round(
    netCarbs * MODERATE_T2D_NET_CARB_RISE_MGDL_PER_G +
    safeProtein * MODERATE_T2D_PROTEIN_RISE_MGDL_PER_G
  );
};

const normalizeGoalMacros = (goals: GeneratedGoals): GeneratedGoals => {
  const macros = goals.macros_grams || {
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    notes: '',
  };

  return {
    ...goals,
    macros_grams: {
      ...macros,
      blood_sugar_rise_mg_dl:
        macros.blood_sugar_rise_mg_dl ??
        estimateMacroBloodSugarRiseMgDl(macros.carbs_g, macros.protein_g),
    },
  };
};

/** Build trend data for the NutritionInsightsCard from weekly insights */
const buildTrendData = (weeklyData?: { dailyData?: Array<{ date: string; calories: { actual: number }; protein: number; carbs: number; fat: number }> }) => {
  if (!weeklyData?.dailyData?.length) return [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return weeklyData.dailyData.map((d) => {
    const [year, month, day] = d.date.split('-').map(Number);
    const dow = new Date(year, month - 1, day).getDay();
    return {
      day: dayNames[dow],
      calories: d.calories?.actual ?? 0,
      protein: d.protein ?? 0,
      carbs: d.carbs ?? 0,
      fat: d.fat ?? 0,
    };
  });
};

const DashboardScreen = () => {
  const navigation = useNavigation<any>();
  const currentUser = useCurrentUser();
  const userId = currentUser.data?.userId || '';
  const { width } = useWindowDimensions();
  const showRightPanel = useRightPanelVisible();
  const showSidebar = useSidebarVisible(); // Desktop mode detection
  const { t } = useLanguageStore();
  const isDashboardDesktop = width >= 1024;
  const isDashboardTablet = width >= 720;
  const isDashboardCompact = width < 420;
  const needsFloatingTabClearance = Platform.OS === 'web' && !isDashboardDesktop;

  const { data: nutritionData, isLoading: nutritionLoading, refresh } = useDailyNutrition();
  const goals = useGoals(userId);
  const stats = useGoalStatistics(userId);

  // Hydration state for Daily Score
  const hydrationCups = useHydrationStore((s) => s.cups);
  const hydrationGoalCups = useHydrationStore((s) => s.dailyGoalCups);

  // Weekly insights for trend chart (web only)
  const weeklyInsights = useWeeklyInsights(undefined, true);

  // F3 — "Log again" feed: pull last 7 days of meals, dedupe by name, surface top 3 most-recent.
  const _sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);
  const reLogHistory = useMealHistory({ page: 0, size: 20, startDate: _sevenDaysAgo, sort: 'consumedAt,desc' }, true);
  const reLogMeal = useReLogMeal('me');
  const [reLogInFlight, setReLogInFlight] = useState<number | null>(null);
  const logAgainMeals = useMemo(() => {
    const all = reLogHistory.data?.content ?? [];
    const seen = new Set<string>();
    const out: typeof all = [];
    for (const m of all) {
      const key = (m.foodItems?.[0]?.displayName || m.mealType || '').toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(m);
      if (out.length >= 3) break;
    }
    return out;
  }, [reLogHistory.data]);
  const handleReLog = useCallback(async (meal: typeof logAgainMeals[number]) => {
    setReLogInFlight(meal.id);
    try {
      await reLogMeal.mutateAsync(meal);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setReLogInFlight(null);
    }
  }, [reLogMeal]);

  // F6 — Achievements V2
  const achievements = useAchievements({
    currentStreak: currentUser.data?.currentStreak,
  });
  const [achievementDetail, setAchievementDetail] = useState<typeof achievements[number] | null>(null);
  // Ring tap → where / why / what's-next sheet (rings as action entries, not gauges)
  const [ringDetail, setRingDetail] = useState<RingMacro | null>(null);

  // Tour guide controller and navigation
  const { canStart, start, eventEmitter } = useTourGuideController();
  useTourNavigation(); // Register navigation callback for cross-screen tour steps

  const { hasSeenTour, isLoading: tourStatusLoading, markTourComplete, markTourSkipped } = useTourStatus();

  // Calculate proper bottom padding for tab bar
  const contentBottomPadding = useContentBottomPadding(spacing.lg);
  const mobileWebBottomInset = needsFloatingTabClearance ? contentBottomPadding + spacing.md : 0;

  // Respect accessibility reduce-motion preference
  const reduceMotion = useReducedMotion();

  // Smart greeting based on time of day
  const greeting = useMemo(() => getTimeGreeting(), []);
  const contextLine = useMemo(
    () => getContextLine(
      currentUser.data?.currentStreak || 0,
      nutritionData.goal > 0 ? (nutritionData.calories / nutritionData.goal) * 100 : 0,
      nutritionData.meals.length,
    ),
    [currentUser.data?.currentStreak, nutritionData.calories, nutritionData.goal, nutritionData.meals.length]
  );

  // Memoize trend data to avoid recalculating on every render
  const trendData = useMemo(() => buildTrendData(weeklyInsights.data), [weeklyInsights.data]);

  // Animate entrance only on first mount — subsequent tab switches are instant
  const hasAnimated = useRef(false);
  const staggerEnter = useCallback((index: number) => {
    if (reduceMotion || hasAnimated.current) return undefined;
    return FadeInDown.duration(300).delay(index * 80);
  }, [reduceMotion]);
  useEffect(() => { hasAnimated.current = true; }, []);

  // Fetch personalized recommendations based on fitness goal

  const [refreshing, setRefreshing] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [generatedGoals, setGeneratedGoals] = useState<GeneratedGoals | null>(null);
  const lastLoadedGoalsRef = useRef<string | null>(null);
  const [showWelcomeCard, setShowWelcomeCard] = useState(false);
  const [planPreviewGoal, setPlanPreviewGoal] = useState<GoalType>('muscle_gain');
  const [hasTouchedPlanPreview, setHasTouchedPlanPreview] = useState(false);

  // Apple HIG pre-permission modal state
  const [permissionModal, setPermissionModal] = useState<{ visible: boolean; type: PermissionType; action: 'camera' | 'gallery' }>({
    visible: false, type: 'camera', action: 'camera',
  });

  // Show welcome card for new users
  useEffect(() => {
    if (!tourStatusLoading && !hasSeenTour) {
      setShowWelcomeCard(true);
    }
  }, [tourStatusLoading, hasSeenTour]);

  useEffect(() => {
    if (!hasTouchedPlanPreview && generatedGoals?.goalType) {
      setPlanPreviewGoal(generatedGoals.goalType);
    }
  }, [generatedGoals?.goalType, hasTouchedPlanPreview]);

  // Handle tour events
  useEffect(() => {
    const handleStop = () => {
      markTourComplete();
      setShowWelcomeCard(false);
    };

    eventEmitter?.on('stop', handleStop);

    return () => {
      eventEmitter?.off('stop', handleStop);
    };
  }, [eventEmitter, markTourComplete]);

  // Start tour handler
  const handleStartTour = useCallback(() => {
    if (canStart) {
      setShowWelcomeCard(false);
      start();
    }
  }, [canStart, start]);

  // Skip tour handler
  const handleSkipTour = useCallback(() => {
    markTourSkipped();
    setShowWelcomeCard(false);
  }, [markTourSkipped]);

  // Load generated goals from API (authoritative) then AsyncStorage fallback
  const loadGeneratedGoals = useCallback(async () => {
    try {
      if (userId) {
        try {
          const dbGoal = await getActiveGoal(userId);
          if (dbGoal) {
            const normalizedDbGoal = normalizeGoalMacros(dbGoal);
            const serializedDbGoal = JSON.stringify(normalizedDbGoal);
            if (serializedDbGoal !== lastLoadedGoalsRef.current) {
              setGeneratedGoals(normalizedDbGoal);
              lastLoadedGoalsRef.current = serializedDbGoal;
            }
            await AsyncStorage.setItem(GENERATED_GOALS_KEY, serializedDbGoal);
            return;
          }
        } catch (dbError) {
          console.warn('[DashboardScreen] Failed to load goal from database:', dbError);
        }
      }

      const saved = await AsyncStorage.getItem(GENERATED_GOALS_KEY);
      if (saved) {
        const parsed = normalizeGoalMacros(JSON.parse(saved));
        const serializedParsed = JSON.stringify(parsed);
        if (serializedParsed !== lastLoadedGoalsRef.current) {
          setGeneratedGoals(parsed);
          lastLoadedGoalsRef.current = serializedParsed;
        }
      } else if (lastLoadedGoalsRef.current !== null) {
        setGeneratedGoals(null);
        lastLoadedGoalsRef.current = null;
      }
    } catch (error) {
      console.error('Failed to load generated goals:', error);
    }
  }, [userId]);

  // Load goals on focus (so it updates after generation)
  // Note: We intentionally exclude stats from dependencies to prevent infinite loops
  // stats.refetch is a stable function reference from react-query
  useFocusEffect(
    useCallback(() => {
      loadGeneratedGoals();
      refresh();
      stats.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadGeneratedGoals, refresh])
  );

  // Handle triggerCamera param from camera tab button
  const route = useRoute<any>();
  useFocusEffect(
    useCallback(() => {
      if (route.params?.triggerCamera) {
        // Clear the param so it doesn't re-trigger
        navigation.setParams({ triggerCamera: undefined });
        handleOpenCamera();
      }
    }, [route.params?.triggerCamera])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refresh(),
      goals.refetch(),
      stats.refetch(),
      loadGeneratedGoals(),
      currentUser.refetch(),
      weeklyInsights.refetch(),
    ]);
    setRefreshing(false);
  };

  const handleMacroSearch = useCallback((macro: 'calories' | 'protein' | 'carbs' | 'fat') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    
    let query = '';
    switch (macro) {
      case 'calories': query = 'Low Calorie Healthy'; break;
      case 'protein': query = 'High Protein'; break;
      case 'carbs': query = 'Low Carb Healthy'; break;
      case 'fat': query = 'Healthy Fats'; break;
    }
    
    navigation.navigate('Recipes', { initialSearchQuery: query });
  }, [navigation]);

  const handleAddFood = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    // Show pre-permission modal on ALL platforms (including web)
    // This follows Apple HIG: explain why you need access before proceeding
    setPermissionModal({ visible: true, type: 'photoLibrary', action: 'gallery' });
  };

  const handleOpenCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    // iPad shares the web responsive layout but has a real camera —
    // always use camera type + action so iPad Safari opens the device camera
    setPermissionModal({ visible: true, type: 'camera', action: 'camera' });
  };

  // Called after user taps "Allow" in the pre-permission modal.
  // Triggers the system permission dialog, then proceeds if granted.
  const handlePermissionAllowed = async () => {
    const action = permissionModal.action;
    setPermissionModal((p) => ({ ...p, visible: false }));

    if (action === 'camera') {
      if (Platform.OS === 'web') {
        // On web (incl. iPad Safari) skip system permission — navigate directly;
        // ReviewMealScreen will open the device camera via <input capture>
        navigation.navigate('ReviewMeal', { openCamera: true });
      } else {
        // Native: request camera permission via system dialog
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status === 'granted') {
          navigation.navigate('ReviewMeal', { openCamera: true });
        } else {
          Alert.alert(
            'Camera access needed',
            'Allow camera access in Settings to scan meals.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
      }
    } else {
      await handleChooseFromGallery();
    }
  };

  const handleChooseFromGallery = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Photo access needed',
            'Allow photo library access in Settings to select meal photos.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: Platform.OS === 'web',
        aspect: [4, 3],
        quality: Platform.OS === 'web' ? 0.8 : 0.65,
      });

      if (!result.canceled && result.assets?.[0]) {
        navigation.navigate('ReviewMeal', {
          imageUri: result.assets[0].uri,
          imageMimeType: result.assets[0].mimeType,
          imageFileName: result.assets[0].fileName,
        });
      }
    } catch (err) {
      console.error('Gallery pick failed', err);
      Alert.alert('Error', 'Could not open gallery');
    }
  };

  // Enable keyboard shortcuts on desktop
  useKeyboardShortcuts({
    onAddFood: handleAddFood,
  });

  // Use generated goals for calorie target if available
  const calorieGoal = generatedGoals?.dailyCalories.target || nutritionData.goal;
  const proteinGoal = generatedGoals?.macros_grams.protein_g || nutritionData.protein.goal;
  const carbsGoal = generatedGoals?.macros_grams.carbs_g || nutritionData.carbs.goal;
  const fatGoal = generatedGoals?.macros_grams.fat_g || nutritionData.fat.goal;
  const goalTypeConfig = generatedGoals?.goalType
    ? GOAL_TYPE_CONFIG[generatedGoals.goalType]
    : null;

  if (currentUser.isLoading) {
    return (
      <SafeAreaWrapper>
        <StateView type="loading" title="Loading Dashboard..." />
      </SafeAreaWrapper>
    );
  }

  // Nutrition loading state — shared by both web and mobile layouts
  const hasNutritionData = nutritionData.calories > 0 || nutritionData.protein.current > 0 || nutritionData.meals.length > 0;
  const showNutritionLoading = nutritionLoading && !hasNutritionData;

  const handleLandingFooterLink = useCallback((linkId: string) => {
    switch (linkId) {
      case 'meal-logging':
        handleOpenCamera();
        return;
      case 'workout-planning':
      case 'targets':
        navigation.navigate('BuildPlan');
        return;
      case 'weekly-reports':
      case 'export-data':
        navigation.navigate('Profile', { screen: 'WeeklyInsights' });
        return;
      case 'help-centre':
      case 'about':
        navigation.navigate('Help');
        return;
      case 'data-sources':
        navigation.navigate('AboutNutritionData');
        return;
      case 'release-notes':
        void openAppPage(APP_PAGE_PATHS.releaseNotes);
        return;
      case 'contact':
        void openExternalUrl(SUPPORT_EMAIL_URL, 'Unable to open email', 'Please email support@aurafitness.org.');
        return;
      case 'privacy-policy':
        void openAppPage(APP_PAGE_PATHS.privacy);
        return;
      case 'terms-of-service':
        void openAppPage(APP_PAGE_PATHS.terms);
        return;
      case 'accessibility':
        void openAppPage(APP_PAGE_PATHS.accessibility);
        return;
      default:
        return;
    }
  }, [navigation]);

  // ============================================================================
  // WEB DESKTOP — Uber-style full-page scrollable layout
  // Pattern: Uber logged-in homepage with hero + suggestions + account activity
  // Mobile layout is completely unchanged below this block.
  // ============================================================================
  const renderSharedDashboard = () => {
    const suggestionCards = [
      { title: 'Log meal', illustration: illustrationScanMeal, backgroundColor: '#FBE4D6', onPress: handleAddFood },
      { title: 'Workouts', illustration: illustrationWorkouts, backgroundColor: '#DDEEFF', onPress: () => navigation.navigate('Main', { screen: 'Workouts' } as any) },
      { title: 'Recipes', illustration: illustrationRecipes, backgroundColor: '#D4F5E9', onPress: () => navigation.navigate('Main', { screen: 'Recipes' } as any) },
      { title: 'Reports', illustration: illustrationWeekly, backgroundColor: '#DDF3EC', onPress: () => navigation.navigate('Main', { screen: 'Profile', params: { screen: 'WeeklyInsights' } } as any) },
      { title: 'Targets', illustration: illustrationTargets, backgroundColor: '#FFF3C7', onPress: () => navigation.navigate('BuildPlan', { initialGoal: planPreviewGoal }) },
      { title: 'History', illustration: illustrationHistory, backgroundColor: '#F2E9FF', onPress: () => navigation.navigate('Main', { screen: 'Profile', params: { screen: 'MealHistory' } } as any) },
    ];
    const serviceCards = [
      {
        title: 'Meal logging',
        body: 'Scan, review, and log meals with a faster photo-first flow.',
        illustration: illustrationScanMeal,
        backgroundColor: '#FBE4D6',
        onPress: handleAddFood,
      },
      {
        title: 'Workouts',
        body: 'Browse exercise videos and track strength or cardio sessions.',
        illustration: illustrationWorkouts,
        backgroundColor: '#DDEEFF',
        onPress: () => navigation.navigate('Main', { screen: 'Workouts' } as any),
      },
      {
        title: 'Weight logging',
        body: 'Log weight, track trends, and export your progress charts.',
        illustration: illustrationWeekly,
        backgroundColor: '#DDF3EC',
        onPress: () => navigation.navigate('Main', { screen: 'Profile', params: { screen: 'WeeklyInsights' } } as any),
      },
      {
        title: 'Recipes',
        body: 'Get recipes matched to your calorie and macro targets.',
        illustration: illustrationRecipes,
        backgroundColor: '#D4F5E9',
        onPress: () => navigation.navigate('Main', { screen: 'Recipes' } as any),
      },
    ];
    const recentMeals = nutritionData.meals.slice(0, 4);
    const currentProgramTitle = goalTypeConfig?.label || 'Build your plan';
    const currentProgramTarget = generatedGoals
      ? goalTypeConfig?.label === 'Fat Loss'
        ? 'Target: 72kg'
        : 'Target: 82kg'
      : 'Set a goal to generate targets';
    const selectedPlanPreview = PLAN_PREVIEW_CONFIG[planPreviewGoal];
    const selectedPlanTarget = generatedGoals?.goalType === planPreviewGoal
      ? `${generatedGoals.dailyCalories.target} kcal/day`
      : selectedPlanPreview.targetHint;
    const selectedPlanRhythm = generatedGoals?.goalType === planPreviewGoal
      ? `${generatedGoals.weeklyActivityPlan.strength_sessions_per_week}\u00A0strength + ${generatedGoals.weeklyActivityPlan.cardio_minutes_per_week}\u00A0min cardio`
      : selectedPlanPreview.weeklyRhythm;

    return (
      <SafeAreaWrapper>
        <View style={webStyles.root}>
          <RNScrollView
            style={[webStyles.scroll, needsFloatingTabClearance && { marginBottom: mobileWebBottomInset }]}
            contentContainerStyle={[
              webStyles.scrollContent,
              !isDashboardDesktop && webStyles.scrollContentMobile,
              needsFloatingTabClearance && { paddingBottom: mobileWebBottomInset + spacing.xl },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={[webStyles.scrollStack, !isDashboardDesktop && webStyles.scrollStackMobile]}>
              {/* Background meal-scan tracker (Uber Eats order-status pattern) */}
              <ScanStatusChip />
              {/* Training→nutrition bridge: shown for 2h after a finished workout session */}
              <RecoveryMealCard onLogMeal={handleAddFood} />
              <View style={[webStyles.heroSection, !isDashboardDesktop && webStyles.heroSectionMobile, isDashboardCompact && webStyles.heroSectionCompact]}>
                <View style={[webStyles.heroLeft, !isDashboardDesktop && webStyles.heroLeftMobile]}>
                <View style={[webStyles.heroEyebrowRow, !isDashboardTablet && webStyles.heroEyebrowRowMobile]}>
                  <View style={webStyles.heroEyebrowChip}>
                    <FlagCheckered size={16} weight="fill" color="#111111" />
                    <Text variant="body" weight="semibold" style={webStyles.heroEyebrowText}>
                      Today&apos;s plan
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => navigation.navigate('BuildPlan', { initialGoal: planPreviewGoal })}
                    style={({ pressed }) => [webStyles.heroInlineLink, pressed && webStyles.heroInlineLinkPressed]}
                  >
                    <Text variant="body" weight="medium" style={webStyles.heroInlineLinkText}>
                      Update goal
                    </Text>
                  </Pressable>
                </View>

                <Text
                  variant="heading1"
                  weight="bold"
                  style={
                    isDashboardCompact
                      ? [webStyles.heroTitle, webStyles.heroTitleMobile, webStyles.heroTitleCompact]
                      : !isDashboardDesktop
                        ? [webStyles.heroTitle, webStyles.heroTitleMobile]
                        : webStyles.heroTitle
                  }
                >
                  Build today&apos;s plan
                </Text>
                {/* Uber home widget: connected stop rows (● — ▪ — ◼) + one dark CTA + text link */}
                <View style={webStyles.heroStops}>
                  <View pointerEvents="none" style={webStyles.heroStopsRail}>
                    <View style={webStyles.heroStopsLine} />
                    <View style={webStyles.heroStopCircle}>
                      <View style={webStyles.heroStopInnerDot} />
                    </View>
                    <View style={webStyles.heroStopMid} />
                    <View style={webStyles.heroStopSquare}>
                      <View style={webStyles.heroStopInnerSquare} />
                    </View>
                  </View>

                  <TourGuideZone
                    zone={SNAP_MEAL_STEP.zone}
                    text={SNAP_MEAL_STEP.text}
                    title={SNAP_MEAL_STEP.title}
                    icon="📸"
                  >
                    <Pressable
                      onPress={handleOpenCamera}
                      style={({ pressed }) => [webStyles.heroStopRow, pressed && webStyles.heroInputPressed]}
                    >
                      <Text variant="body" style={webStyles.heroStopLabel}>
                        Take a photo
                      </Text>
                      <NavigationArrow size={20} weight="fill" color="#111111" />
                    </Pressable>
                  </TourGuideZone>

                  <Pressable
                    onPress={handleAddFood}
                    style={({ pressed }) => [webStyles.heroStopRow, pressed && webStyles.heroInputPressed]}
                  >
                    <Text variant="body" style={webStyles.heroStopLabel}>
                      Choose from library
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => navigation.navigate('Main', { screen: 'Workouts' } as any)}
                    style={({ pressed }) => [webStyles.heroStopRow, webStyles.heroStopRowLast, pressed && webStyles.heroInputPressed]}
                  >
                    <Text variant="body" style={webStyles.heroStopLabel}>
                      Choose workout focus
                    </Text>
                  </Pressable>
                </View>

                <View style={[webStyles.heroActions, !isDashboardTablet && webStyles.heroActionsMobile]}>
                  <Pressable
                    onPress={handleOpenCamera}
                    style={({ pressed }) => [webStyles.heroPrimaryCta, pressed && webStyles.heroCtaPressed]}
                  >
                    <Text variant="body" weight="bold" style={webStyles.heroPrimaryCtaText}>
                      Scan meal
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => navigation.navigate('Main', { screen: 'Profile', params: { screen: 'MealHistory' } } as any)}
                    style={({ pressed }) => [webStyles.heroInlineLink, pressed && webStyles.heroInlineLinkPressed]}
                  >
                    <Text variant="body" weight="medium" style={webStyles.heroInlineLinkText}>
                      See your recent meals
                    </Text>
                  </Pressable>
                </View>
              </View>

                <View style={[webStyles.heroRight, !isDashboardDesktop && webStyles.heroRightMobile]}>
                  <Text
                    variant="heading3"
                    weight="bold"
                    style={isDashboardCompact ? [webStyles.suggestionsTitle, webStyles.suggestionsTitleCompact] : webStyles.suggestionsTitle}
                  >
                    Suggestions
                  </Text>
                  {/* F5 — Adaptive Home Hero (time-of-day morphing) */}
                  <AdaptiveHomeHero
                    userName={currentUser.data?.username?.split(' ')[0]}
                    caloriesConsumed={nutritionData.calories}
                    caloriesTarget={calorieGoal}
                    proteinConsumed={nutritionData.protein.current}
                    proteinTarget={proteinGoal}
                    mealsLoggedToday={nutritionData.meals.length}
                    onPrimaryAction={handleAddFood}
                    onSecondaryAction={() => navigation.navigate('Main', { screen: 'Recipes' } as any)}
                    compact={isDashboardCompact}
                  />

                  {/* Streak with safety rails: pause for trips/illness, fresh-start zero copy */}
                  <StreakSafetyCard streak={currentUser.data?.currentStreak ?? 0} />
                </View>
              </View>

              {/* Full-width engagement band below the hero. Order follows Uber Eats
                  (quick-access shelf, then reorder) and Strava (trophy case,
                  challenges, social feed). */}
              <View style={[webStyles.engageSection, !isDashboardDesktop && webStyles.engageSectionMobile]}>
                <SuggestionGrid cards={suggestionCards} />

                {/* F3 — Log again (Uber Eats "Order again" shelf) */}
                <LogAgainCard
                  meals={logAgainMeals}
                  isLoading={reLogHistory.isLoading}
                  onReLog={handleReLog}
                  inFlightMealId={reLogInFlight}
                />

                {/* Insights band: weekly check-in + Sunday recap side by side */}
                <View style={[webStyles.insightsRow, !isDashboardDesktop && webStyles.insightsRowMobile]}>
                  <View style={webStyles.insightsCol}>
                    <WeeklyCheckinCard insights={weeklyInsights.data} proteinGoal={proteinGoal} />
                  </View>
                  <View style={webStyles.insightsCol}>
                    <WeeklySummaryCard
                      insights={weeklyInsights.data}
                      isLoading={weeklyInsights.isLoading}
                      userName={currentUser.data?.username?.split(' ')[0]}
                    />
                  </View>
                </View>

                {/* F10 — Challenges (Strava challenge discovery row) */}
                <ChallengesCard limit={3} />

                {/* Achievements + Friends feed share one full-width row */}
                <View style={[webStyles.insightsRow, !isDashboardDesktop && webStyles.insightsRowMobile]}>
                  <View style={webStyles.insightsCol}>
                    {/* F6 — Achievements V2 (Strava trophy case) */}
                    <AchievementsCard
                      achievements={achievements}
                      onTap={(a) => setAchievementDetail(a)}
                    />
                  </View>
                  <View style={webStyles.insightsCol}>
                    {/* F9 — Friends Activity Feed (Strava social feed) */}
                    <FriendsFeedCard limit={4} />
                  </View>
                </View>
              </View>

              <View style={[webStyles.section, !isDashboardDesktop && webStyles.sectionMobile, isDashboardCompact && webStyles.sectionCompact]}>
                <View style={webStyles.sectionHeader}>
                <View style={[webStyles.sectionEyebrow, webStyles.sectionEyebrowWarm]}>
                  <Text variant="label" weight="bold" style={webStyles.sectionEyebrowText}>
                    Account
                  </Text>
                </View>
                <Text
                  variant="heading2"
                  weight="bold"
                  style={
                    isDashboardCompact
                      ? [webStyles.sectionHeading, webStyles.sectionHeadingMobile, webStyles.sectionHeadingCompact]
                      : !isDashboardDesktop
                        ? [webStyles.sectionHeading, webStyles.sectionHeadingMobile]
                        : webStyles.sectionHeading
                  }
                >
                  Your account and activity
                </Text>
                <Text variant="body" style={webStyles.sectionSubheading}>
                  Recent meals, streak progress, and quick access to services.
                </Text>
              </View>
                <View style={[webStyles.activityCard, !isDashboardDesktop && webStyles.activityCardMobile]}>
                <View style={[webStyles.activityCol1, !isDashboardDesktop && webStyles.activityColMobile]}>
                  <Text variant="heading4" weight="bold" style={webStyles.colTitle}>
                    Most recent
                  </Text>
                  <Pressable
                    onPress={() => navigation.navigate('BuildPlan', { initialGoal: planPreviewGoal })}
                    style={({ pressed }) => [webStyles.programCard, !isDashboardDesktop && webStyles.programCardMobile, pressed && webStyles.programCardPressed]}
                  >
                    <View style={webStyles.programCardCopy}>
                      <Text variant="label" weight="bold" style={webStyles.programCardLabel}>
                        Current program
                      </Text>
                      <Text
                        variant="heading2"
                        weight="bold"
                        style={!isDashboardDesktop ? [webStyles.programCardTitle, webStyles.programCardTitleMobile] : webStyles.programCardTitle}
                      >
                        {currentProgramTitle}
                      </Text>
                      <Text variant="body" style={webStyles.programCardBody}>
                        {currentProgramTarget}
                      </Text>
                      <View style={webStyles.programCardAction}>
                        <Text variant="body" weight="bold" style={webStyles.programCardActionText}>
                          See details
                        </Text>
                      </View>
                    </View>
                    <Image
                      source={illustrationTargets}
                      style={[webStyles.programCardIllustration, !isDashboardDesktop && webStyles.programCardIllustrationMobile] as any}
                      contentFit="contain"
                    />
                  </Pressable>

                  <View style={webStyles.metricStack}>
                    <View style={webStyles.metricRow}>
                      <Text variant="body" weight="semibold" style={webStyles.metricLabel}>Calories</Text>
                      <Text variant="body" weight="semibold" style={webStyles.metricValue}>
                        {nutritionData.calories}/{calorieGoal}
                      </Text>
                    </View>
                    <View style={webStyles.metricTrack}>
                      <View style={[webStyles.metricFill, { width: `${Math.min(100, Math.round((nutritionData.calories / Math.max(calorieGoal, 1)) * 100))}%`, backgroundColor: '#F28B34' }]} />
                    </View>

                    <View style={webStyles.metricRow}>
                      <Text variant="body" weight="semibold" style={webStyles.metricLabel}>Protein</Text>
                      <Text variant="body" weight="semibold" style={webStyles.metricValue}>
                        {Math.round(nutritionData.protein.current)}/{proteinGoal}g
                      </Text>
                    </View>
                    <View style={webStyles.metricTrack}>
                      <View style={[webStyles.metricFill, { width: `${Math.min(100, Math.round((nutritionData.protein.current / Math.max(proteinGoal, 1)) * 100))}%`, backgroundColor: '#0F9D82' }]} />
                    </View>

                    <View style={webStyles.metricRow}>
                      <Text variant="body" weight="semibold" style={webStyles.metricLabel}>Hydration</Text>
                      <Text variant="body" weight="semibold" style={webStyles.metricValue}>
                        {hydrationCups}/{hydrationGoalCups} cups
                      </Text>
                    </View>
                    <View style={webStyles.metricTrack}>
                      <View style={[webStyles.metricFill, { width: `${Math.min(100, Math.round((hydrationCups / Math.max(hydrationGoalCups, 1)) * 100))}%`, backgroundColor: '#3B82F6' }]} />
                    </View>
                  </View>
                </View>

                <View
                  style={[
                    webStyles.activityCol2,
                    !isDashboardDesktop && webStyles.activityColMobile,
                    !isDashboardDesktop && webStyles.activityColMobileSeparated,
                  ]}
                >
                  <Text variant="heading4" weight="bold" style={webStyles.colTitle}>
                    Past
                  </Text>
                  {recentMeals.length === 0 ? (
                    <Pressable onPress={handleAddFood} style={webStyles.emptyMeals}>
                      <CameraPlus size={22} color={BRAND_COLORS.primary} weight="regular" />
                      <View style={webStyles.emptyMealsCopy}>
                        <Text variant="body" weight="semibold" style={webStyles.emptyMealsTitle}>
                          This space is ready for your first meal
                        </Text>
                        <Text variant="caption" style={webStyles.emptyMealsSubtitle}>
                          Snap a photo and watch your nutrition story build itself.
                        </Text>
                      </View>
                    </Pressable>
                  ) : (
                    <View style={webStyles.mealsList}>
                      {recentMeals.map((meal) => (
                        <View key={meal.id} style={webStyles.mealRow}>
                          <MealImage imageUrl={meal.imageUrl} size={48} borderRadius={10} />
                          <View style={webStyles.mealRowCopy}>
                            <Text variant="body" weight="bold" style={webStyles.mealRowTitle}>
                              {formatMealName(meal.name)}
                            </Text>
                            <Text variant="caption" style={webStyles.mealRowMeta}>
                              {getMealType(new Date(meal.consumedAt))} · {new Date(meal.consumedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                          <Pressable
                            style={webStyles.seeDetailsBtn}
                            onPress={() => navigation.navigate('Main', { screen: 'Profile', params: { screen: 'MealHistory' } } as any)}
                          >
                            <Text variant="caption" weight="semibold" style={webStyles.seeDetailsText}>
                              See details
                            </Text>
                          </Pressable>
                        </View>
                      ))}
                      <Pressable
                        onPress={() => navigation.navigate('Main', { screen: 'Profile', params: { screen: 'MealHistory' } } as any)}
                        style={webStyles.viewAllBtn}
                      >
                        <Text variant="body" weight="semibold" style={webStyles.viewAllBtnText}>
                          View all logs
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                <View
                  style={[
                    webStyles.activityCol3,
                    !isDashboardDesktop && webStyles.activityColMobileLast,
                    !isDashboardDesktop && webStyles.activityColMobileSeparated,
                  ]}
                >
                  <Text variant="heading4" weight="bold" style={webStyles.colTitle}>
                    Services
                  </Text>
                  {serviceCards.map((service) => (
                    <Pressable
                      key={service.title}
                      onPress={service.onPress}
                      style={({ pressed }) => [
                        webStyles.serviceCard,
                        { backgroundColor: service.backgroundColor },
                        pressed && webStyles.serviceCardPressed,
                      ]}
                    >
                      <Image source={service.illustration} style={webStyles.serviceIllustration as any} contentFit="contain" />
                      <View style={webStyles.serviceCopy}>
                        <Text variant="body" weight="bold" style={webStyles.serviceTitle}>{service.title}</Text>
                        <Text variant="caption" style={webStyles.serviceBody}>
                          {service.body}
                        </Text>
                      </View>
                      <CaretRight size={18} color="#7B7B7B" />
                    </Pressable>
                  ))}
                </View>
                </View>
              </View>

              {/* ── PERFORMANCE TODAY — Rings only ── */}
              <View style={[webStyles.section, !isDashboardDesktop && webStyles.sectionMobile, isDashboardCompact && webStyles.sectionCompact]}>
                <View style={webStyles.sectionHeader}>
                <View style={[webStyles.sectionEyebrow, webStyles.sectionEyebrowPink]}>
                  <Text variant="label" weight="bold" style={webStyles.sectionEyebrowText}>
                    Performance
                  </Text>
                </View>
                <Text
                  variant="heading2"
                  weight="bold"
                  style={
                    isDashboardCompact
                      ? [webStyles.sectionHeading, webStyles.sectionHeadingMobile, webStyles.sectionHeadingCompact]
                      : !isDashboardDesktop
                        ? [webStyles.sectionHeading, webStyles.sectionHeadingMobile]
                        : webStyles.sectionHeading
                  }
                >
                  Performance today
                </Text>
                <Text variant="body" style={webStyles.sectionSubheading}>
                  Track calories, protein, fat, and carbs against your daily targets.
                </Text>
              </View>
                {showNutritionLoading ? (
                  <NutritionRingsSkeleton />
                ) : (
                  <NutritionRingsCard
                    data={{
                      calories: { current: nutritionData.calories, target: calorieGoal },
                      protein: { current: nutritionData.protein.current, target: proteinGoal },
                      carbs: { current: nutritionData.carbs.current, target: carbsGoal },
                      fat: { current: nutritionData.fat.current, target: fatGoal },
                    }}
                    showFat={true}
                    onMacroPress={(macro) => setRingDetail(macro)}
                    onSourcesPress={() => navigation.navigate('AboutNutritionData' as any)}
                  />
                )}
              </View>

              <View style={[webStyles.section, !isDashboardDesktop && webStyles.sectionMobile, isDashboardCompact && webStyles.sectionCompact]}>
                <View style={webStyles.sectionHeader}>
                <View style={[webStyles.sectionEyebrow, webStyles.sectionEyebrowCool]}>
                  <Text variant="label" weight="bold" style={webStyles.sectionEyebrowText}>
                    Weekly planner
                  </Text>
                </View>
                <Text
                  variant="heading2"
                  weight="bold"
                  style={
                    isDashboardCompact
                      ? [webStyles.sectionHeading, webStyles.sectionHeadingMobile, webStyles.sectionHeadingCompact]
                      : !isDashboardDesktop
                        ? [webStyles.sectionHeading, webStyles.sectionHeadingMobile]
                        : webStyles.sectionHeading
                  }
                >
                  Plan for later
                </Text>
                <Text variant="body" style={webStyles.sectionSubheading}>
                  Pick a direction now. Targets are calculated using the Mifflin-St Jeor equation — just confirm sex, height, and weight.
                </Text>
              </View>
                <View style={[webStyles.planRow, !isDashboardDesktop && webStyles.planRowMobile]}>
                <View style={[webStyles.planAccentCard, !isDashboardDesktop && webStyles.planAccentCardMobile]}>
                  <View style={webStyles.planBadge}>
                    <Text variant="label" weight="bold" style={webStyles.planBadgeText}>
                      Weekly planner
                    </Text>
                  </View>
                  <Text
                    variant="heading2"
                    weight="bold"
                    style={!isDashboardDesktop ? [webStyles.planAccentTitle, webStyles.planAccentTitleMobile] : webStyles.planAccentTitle}
                  >
                    {selectedPlanPreview.title}
                  </Text>
                  <Text variant="body" style={webStyles.planAccentBody}>
                    {selectedPlanPreview.description}
                  </Text>

                  <View style={[webStyles.planTabsRow, !isDashboardTablet && webStyles.planTabsRowMobile]}>
                    {(Object.keys(GOAL_TYPE_CONFIG) as GoalType[]).map((goalKey) => {
                      const option = GOAL_TYPE_CONFIG[goalKey];
                      const isSelected = planPreviewGoal === goalKey;

                      return (
                        <Pressable
                          key={goalKey}
                          onPress={() => {
                            setPlanPreviewGoal(goalKey);
                            setHasTouchedPlanPreview(true);
                          }}
                          style={({ pressed }) => [
                            webStyles.planTab,
                            !isDashboardTablet && webStyles.planTabMobile,
                            {
                              backgroundColor: isSelected ? `${option.color}18` : '#FFFFFF',
                              borderColor: isSelected ? option.color : 'rgba(17,17,17,0.08)',
                            },
                            pressed && webStyles.planTabPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Choose ${option.label}`}
                          accessibilityState={{ selected: isSelected }}
                        >
                          <View style={[webStyles.planTabIcon, { backgroundColor: `${option.color}14` }]}>
                            <option.Icon size={18} weight={isSelected ? 'fill' : 'regular'} color={option.color} />
                          </View>
                          <Text variant="body" weight="bold" style={webStyles.planTabTitle}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={[webStyles.planPreviewStats, !isDashboardTablet && webStyles.planPreviewStatsMobile]}>
                    <View style={[webStyles.planField, isDashboardCompact ? webStyles.planFieldCompact : undefined]}>
                      <Text variant="caption" style={webStyles.planFieldLabel}>Focus</Text>
                      <Text variant="body" weight="semibold" style={isDashboardCompact ? [webStyles.planFieldValue, webStyles.planFieldValueCompact] : webStyles.planFieldValue}>{selectedPlanPreview.focus}</Text>
                    </View>
                    <View style={[webStyles.planField, isDashboardCompact ? webStyles.planFieldCompact : undefined]}>
                      <Text variant="caption" style={webStyles.planFieldLabel}>Weekly rhythm</Text>
                      <Text variant="body" weight="semibold" style={isDashboardCompact ? [webStyles.planFieldValue, webStyles.planFieldValueCompact] : webStyles.planFieldValue}>{selectedPlanRhythm}</Text>
                    </View>
                    <View style={[webStyles.planField, isDashboardCompact ? webStyles.planFieldCompact : undefined]}>
                      <Text variant="caption" style={webStyles.planFieldLabel}>Target</Text>
                      <Text variant="body" weight="semibold" style={isDashboardCompact ? [webStyles.planFieldValue, webStyles.planFieldValueCompact] : webStyles.planFieldValue}>{selectedPlanTarget}</Text>
                    </View>
                  </View>

                  <Text variant="caption" style={webStyles.planCitation}>
                    Plan built uses the{' '}
                    <Text
                      variant="caption"
                      style={webStyles.planCitationLink}
                      onPress={() => openExternalUrl('https://pubmed.ncbi.nlm.nih.gov/2305711/')}
                    >
                      Mifflin-St Jeor formula
                    </Text>
                  </Text>

                  <Pressable
                    onPress={() => navigation.navigate('BuildPlan', { initialGoal: planPreviewGoal })}
                    style={({ pressed }) => [webStyles.planCta, pressed && webStyles.heroCtaPressed]}
                  >
                    <Text variant="body" weight="bold" style={webStyles.planCtaText}>
                      Build my plan
                    </Text>
                  </Pressable>

                  {isDashboardDesktop && (
                    <Image
                      source={illustrationWorkouts}
                      style={webStyles.planIllustration as any}
                      contentFit="contain"
                    />
                  )}
                </View>

                <View style={webStyles.planBenefitsPanel}>
                  <Text variant="heading3" weight="bold" style={webStyles.planBenefitsTitle}>
                    Benefits
                  </Text>

                  <View style={webStyles.benefitRow}>
                    <View style={[webStyles.benefitIcon, { backgroundColor: '#FFF1E7' }]}>
                      <Target size={20} weight="bold" color="#C96A34" />
                    </View>
                    <View style={webStyles.benefitCopy}>
                      <Text variant="body" weight="semibold" style={webStyles.benefitTitle}>Personalized targets</Text>
                      <Text variant="body" style={webStyles.benefitBody}>AI generates your daily calorie and macro targets from your goal.</Text>
                    </View>
                  </View>

                  <View style={webStyles.benefitRow}>
                    <View style={[webStyles.benefitIcon, { backgroundColor: '#E0F5EF' }]}>
                      <Barbell size={20} weight="bold" color="#2F7A6A" />
                    </View>
                    <View style={webStyles.benefitCopy}>
                      <Text variant="body" weight="semibold" style={webStyles.benefitTitle}>Adaptive weekly structure</Text>
                      <Text variant="body" style={webStyles.benefitBody}>Strength, meals, and recovery stay aligned to your weekly schedule.</Text>
                    </View>
                  </View>

                  <View style={[webStyles.benefitRow, webStyles.benefitRowLast]}>
                    <View style={[webStyles.benefitIcon, { backgroundColor: '#E9F5FF' }]}>
                      <ChartLine size={20} weight="bold" color="#3B82F6" />
                    </View>
                    <View style={webStyles.benefitCopy}>
                      <Text variant="body" weight="semibold" style={webStyles.benefitTitle}>Exportable progress</Text>
                      <Text variant="body" style={webStyles.benefitBody}>Review your week and export nutrition data as CSV with one tap.</Text>
                    </View>
                  </View>
                </View>
                </View>
              </View>
            </View>

            {isDashboardDesktop && (
              <View style={webStyles.footerWrap}>
                <LandingFooter
                  onGetStarted={() => navigation.navigate('Profile')}
                  onLogin={() => navigation.navigate('Profile')}
                  showFinalCTA={false}
                  onLinkPress={handleLandingFooterLink}
                />
              </View>
            )}
          </RNScrollView>
        </View>

        {/* Apple HIG pre-permission modal — shown before system dialog */}
        <PermissionRequestModal
          visible={permissionModal.visible}
          permissionType={permissionModal.type}
          onAllow={handlePermissionAllowed}
          onCancel={() => setPermissionModal((p) => ({ ...p, visible: false }))}
        />
      </SafeAreaWrapper>
    );
  };

  const renderGoalsSection = (styleOverride?: object) => {
    if (generatedGoals) {
      return (
        <View style={[Platform.OS !== 'web' ? MOBILE_CARD_STYLES : BENTO_CARD_STYLES, BENTO_CARD_WEB_STYLES as any, styles.goalsCard, styleOverride]}>
          <View style={styles.goalsHeader}>
            <View style={styles.goalsHeaderLeft}>
              {goalTypeConfig && (
                <View style={[styles.goalTypeIconSmall, { backgroundColor: `${goalTypeConfig.color}15` }]}>
                  <goalTypeConfig.Icon
                    size={20}
                    color={goalTypeConfig.color}
                    weight="regular"
                  />
                </View>
              )}
              <View>
                <Text variant="caption" style={styles.goalLabel}>{Platform.OS !== 'web' ? 'ACTIVE PLAN' : 'Your Goal'}</Text>
                {goalTypeConfig && (
                  <Text variant="body" weight="bold" style={{ color: goalTypeConfig.color }}>
                    {goalTypeConfig.label}
                  </Text>
                )}
              </View>
            </View>
            <Pressable
              style={styles.editGoalsButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <PencilSimple size={16} color={BRAND_COLORS.primary} weight="regular" />
            </Pressable>
          </View>

          <View style={styles.goalsGrid}>
            <Pressable 
              style={({ pressed }) => [styles.goalItem, styles.goalItemCalories, pressed && { opacity: 0.7 }]}
              onPress={() => handleMacroSearch('calories')}
            >
              <Fire size={20} weight="fill" color={BRAND_COLORS.macros.calories} />
              <Text variant="heading3" weight="bold">{generatedGoals.dailyCalories.target}</Text>
              <Text variant="caption" style={styles.goalItemLabel}>kcal/day</Text>
            </Pressable>
            <Pressable 
              style={({ pressed }) => [styles.goalItem, styles.goalItemProtein, pressed && { opacity: 0.7 }]}
              onPress={() => handleMacroSearch('protein')}
            >
              <Barbell size={20} weight="fill" color={BRAND_COLORS.macros.protein} />
              <Text variant="heading3" weight="bold">{generatedGoals.macros_grams.protein_g}g</Text>
              <Text variant="caption" style={styles.goalItemLabel}>Protein</Text>
            </Pressable>
            <Pressable 
              style={({ pressed }) => [styles.goalItem, styles.goalItemCarbs, pressed && { opacity: 0.7 }]}
              onPress={() => handleMacroSearch('carbs')}
            >
              <Grains size={20} weight="fill" color={BRAND_COLORS.macros.carbs} />
              <Text variant="heading3" weight="bold">{generatedGoals.macros_grams.carbs_g}g</Text>
              <Text variant="caption" style={styles.goalItemLabel}>Carbs</Text>
            </Pressable>
            <Pressable 
              style={({ pressed }) => [styles.goalItem, styles.goalItemFat, pressed && { opacity: 0.7 }]}
              onPress={() => handleMacroSearch('fat')}
            >
              <Drop size={20} weight="fill" color={BRAND_COLORS.macros.fat} />
              <Text variant="heading3" weight="bold">{generatedGoals.macros_grams.fat_g}g</Text>
              <Text variant="caption" style={styles.goalItemLabel}>Fat</Text>
            </Pressable>
          </View>

          {/* Activity targets row */}
          <View style={styles.activityRow}>
            <View style={styles.activityItem}>
              <PersonSimpleRun size={16} color={BRAND_COLORS.secondary} weight="regular" />
              <Text variant="caption">
                {generatedGoals.weeklyActivityPlan.cardio_minutes_per_week} min cardio/week
              </Text>
            </View>
            <View style={styles.activityItem}>
              <Sneaker size={16} color={BRAND_COLORS.primary} weight="regular" />
              <Text variant="caption">
                {generatedGoals.weeklyActivityPlan.steps_per_day_target.toLocaleString()} steps/day
              </Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <Pressable
        style={({ pressed }) => [
          styles.setGoalsPrompt,
          styleOverride,
          pressed && { opacity: 0.9 },
        ]}
        onPress={() => navigation.navigate('Profile')}
      >
        <View style={styles.setGoalsGradient}>
          <View style={styles.setGoalsIconBox}>
            <Target size={20} color={BRAND_COLORS.textPrimary} weight="regular" />
          </View>
          <View style={styles.setGoalsText}>
            <Text variant="body" weight="bold" style={styles.setGoalsTitle}>Set Your Fitness Goals</Text>
            <Text variant="caption" style={styles.setGoalsSubtext}>
              Build clear calorie and macro targets
            </Text>
          </View>
          <View style={styles.setGoalsChevron}>
            <CaretRight size={16} color={BRAND_COLORS.textPrimary} weight="regular" />
          </View>
        </View>
      </Pressable>
    );
  };

  const renderNutritionCard = () => (
    <TourGuideZone
      zone={TODAYS_NUTRITION_STEP.zone}
      text={TODAYS_NUTRITION_STEP.text}
      title={TODAYS_NUTRITION_STEP.title}
      icon="📊"
    >
      {/* Only show loading on initial load; once data exists, keep component alive */}
      {showNutritionLoading ? (
        <NutritionRingsSkeleton />
      ) : (
        <NutritionRingsCard
          data={{
            calories: { current: nutritionData.calories, target: calorieGoal },
            protein: { current: nutritionData.protein.current, target: proteinGoal },
            carbs: { current: nutritionData.carbs.current, target: carbsGoal },
            fat: { current: nutritionData.fat.current, target: fatGoal },
            bloodSugarRise: nutritionData.bloodSugarRise,
          }}
          showFat={true}
          onMacroPress={(macro) => setRingDetail(macro)}
          onSourcesPress={() => navigation.navigate('AboutNutritionData' as any)}
        />
      )}
    </TourGuideZone>
  );

  // Section header — Uber bold labels above each card section (mobile only)
  const SectionHeader = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => (
    <View style={styles.sectionHeader}>
      <Text variant="heading4" weight="bold" style={styles.sectionTitle}>{title}</Text>
      {action && onAction && (
        <Pressable onPress={onAction}><Text variant="caption" weight="semibold" style={styles.sectionAction}>{action}</Text></Pressable>
      )}
    </View>
  );

  // Render right panel widgets (only shown on wide screens)
  const renderRightPanel = () => (
    <DashboardWidgets
      generatedGoals={generatedGoals}
    />
  );

  return (
    <>
      {renderSharedDashboard()}
      <DetailBottomSheet
        visible={!!achievementDetail}
        onClose={() => setAchievementDetail(null)}
        title={achievementDetail?.label}
        maxHeightRatio={0.55}
      >
        {achievementDetail ? (
          <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: achievementDetail.unlocked ? '#FFF3D6' : 'rgba(17,17,17,0.06)',
                borderWidth: 3,
                borderColor: achievementDetail.unlocked ? '#F8C24F' : 'rgba(17,17,17,0.10)',
              }}
            >
              <Text style={{ fontSize: 40 }}>
                {achievementDetail.unlocked ? achievementDetail.emoji : '🔒'}
              </Text>
            </View>
            <Text variant="heading3" weight="bold" style={{ textAlign: 'center' }}>
              {achievementDetail.label}
            </Text>
            <Text variant="body" style={{ textAlign: 'center', color: '#666' }}>
              {achievementDetail.description}
            </Text>
            <View
              style={{
                width: '90%',
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(17,17,17,0.08)',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.round(achievementDetail.progress * 100)}%`,
                  height: '100%',
                  backgroundColor: '#F97316',
                }}
              />
            </View>
            <Text variant="caption" weight="semibold" style={{ color: '#666' }}>
              {achievementDetail.unlocked
                ? 'Unlocked'
                : `${Math.round(achievementDetail.progress * 100)}% complete`}
            </Text>
          </View>
        ) : null}
      </DetailBottomSheet>

      {/* Ring detail: where / why / what's next (rings as action entries, Whoop/Oura pattern) */}
      <DetailBottomSheet
        visible={!!ringDetail}
        onClose={() => setRingDetail(null)}
        title={ringDetail ? buildRingInsight(nutritionData, ringDetail).title : undefined}
        maxHeightRatio={0.55}
      >
        {ringDetail ? (() => {
          const insight = buildRingInsight(nutritionData, ringDetail);
          return (
            <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
              <View style={{ gap: 4 }}>
                <Text variant="label" weight="bold" style={{ color: '#9A8F80' }}>WHERE YOU ARE</Text>
                <Text variant="heading3" weight="bold">{insight.whereLine}</Text>
              </View>
              <View style={{ gap: 4 }}>
                <Text variant="label" weight="bold" style={{ color: '#9A8F80' }}>WHY</Text>
                <Text variant="body" style={{ color: '#3E3C38' }}>{insight.whyLine}</Text>
              </View>
              <View style={{ gap: 4 }}>
                <Text variant="label" weight="bold" style={{ color: '#9A8F80' }}>NEXT</Text>
                <Text variant="body" style={{ color: '#3E3C38' }}>{insight.nextLine}</Text>
              </View>
              <Pressable
                onPress={() => {
                  const macro = ringDetail;
                  setRingDetail(null);
                  if (macro) handleMacroSearch(macro);
                }}
                style={{
                  minHeight: 46,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(17,17,17,0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FFFFFF',
                }}
                accessibilityRole="button"
                accessibilityLabel={`Find recipes for ${ringDetail}`}
              >
                <Text variant="body" weight="semibold">Find matching recipes</Text>
              </Pressable>
            </View>
          );
        })() : null}
      </DetailBottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#FFF9F2',
  },
  mobileBackdropLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  mobileBackdropBand: {
    position: 'absolute',
    borderRadius: 999,
  },
  mobileBackdropBandWarm: {
    width: 240,
    height: 240,
    top: -70,
    right: -60,
    backgroundColor: 'rgba(255, 209, 178, 0.42)',
  },
  mobileBackdropBandMint: {
    width: 220,
    height: 220,
    top: 240,
    left: -110,
    backgroundColor: 'rgba(190, 241, 226, 0.4)',
  },
  mobileBackdropBandSky: {
    width: 260,
    height: 260,
    bottom: 140,
    right: -120,
    backgroundColor: 'rgba(205, 232, 255, 0.32)',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    width: '100%',
    alignSelf: 'center',
    ...(Platform.OS === 'web' && {
      maxWidth: 1360,
    }),
    // paddingBottom is set dynamically via useContentBottomPadding
  },
  // Desktop layout wrapper - grows with content; no fixed viewport height
  desktopContentWrapper: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.lg,
  },
  sidebarContentWrapper: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.lg,
  },
  inlineTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: spacing.lg,
  },
  inlineColumn: {
    flexBasis: 320,
    minWidth: 0,
    flexGrow: 1,
    flexShrink: 1,
  },
  inlineCard: {
    marginBottom: 0,
  },
  // Loading placeholder for nutrition card - matches card height
  nutritionLoadingContainer: {
    ...BENTO_CARD_STYLES,
    ...(BENTO_CARD_WEB_STYLES as object),
    minHeight: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Platform.OS !== 'web' ? spacing.lg : spacing.xl,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: Platform.select({
    web: {
      color: BRAND_COLORS.textMuted,
      marginBottom: 2,
      fontSize: 14,
      letterSpacing: 0.6,
    },
    default: {
      color: '#5F5A52',
      fontSize: 14,
      fontWeight: '700' as const,
      letterSpacing: 0.8,
      marginBottom: 2,
    },
  }),
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  userName: Platform.select({
    web: {
      color: BRAND_COLORS.textPrimary,
      letterSpacing: -0.7,
    },
    default: {
      color: '#111111',
      fontSize: 28,
      fontWeight: '700' as const,
      letterSpacing: -0.8,
    },
  }),
  contextLine: {
    color: '#6B665F',
    marginTop: Platform.OS !== 'web' ? 4 : 6,
    fontSize: Platform.OS !== 'web' ? 13 : 14,
  },
  mobileHeroCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: 32,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E9E0D2',
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 28,
    shadowOpacity: 0.07,
    elevation: 8,
  },
  mobileHeroHeader: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  mobileHeroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mobileHeroKicker: {
    color: '#8A7560',
    letterSpacing: 1.3,
  },
  mobileHeroTitle: {
    color: '#111111',
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.4,
  },
  mobileHeroSubtitle: {
    color: '#374151',
    marginTop: 6,
    fontSize: 16,
    lineHeight: 24,
  },
  mobileHeroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: '#FFF3E6',
    borderWidth: 1,
    borderColor: '#F1D7B8',
  },
  mobileHeroBadgeText: {
    color: '#8C4A1D',
  },
  mobileHeroFocusCard: {
    backgroundColor: '#121212',
    borderRadius: 26,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  mobileHeroFocusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  mobileHeroFocusKicker: {
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 1,
  },
  mobileHeroPlanChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  mobileHeroPlanChipText: {
    color: '#FFFFFF',
  },
  mobileHeroFocusTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  mobileHeroFocusMeta: {
    color: 'rgba(255,255,255,0.68)',
    marginTop: spacing.sm,
  },
  mobileHeroMetricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  mobileHeroMetric: {
    flex: 1,
    minWidth: 100,
    minHeight: 108,
    padding: spacing.md,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECE3D7',
    justifyContent: 'space-between',
  },
  mobileHeroMetricWarm: {
    backgroundColor: '#FFF4EA',
    borderColor: '#F3D7BE',
    borderTopWidth: 3,
    borderTopColor: '#F97316',
  },
  mobileHeroMetricMint: {
    backgroundColor: '#ECF9F3',
    borderColor: '#CBEBDD',
    borderTopWidth: 3,
    borderTopColor: '#2F7A6A',
  },
  mobileHeroMetricSky: {
    backgroundColor: '#EEF6FF',
    borderColor: '#D7E8FB',
    borderTopWidth: 3,
    borderTopColor: '#3B82F6',
  },
  mobileHeroMetricLabel: {
    color: '#6B665F',
  },
  mobileHeroMetricValue: {
    color: '#111111',
    fontSize: 30,
    letterSpacing: -0.7,
  },
  mobileHeroMetricMeta: {
    color: '#4B5563',
  },
  mobileHeroProgressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden' as const,
    marginTop: 4,
  },
  mobileHeroProgressFill: {
    height: '100%' as any,
    borderRadius: 3,
  },
  // Quick-log bar — Uber "Where to?" pattern
  quickLogRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  quickLogBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: EXPERIENCE_COLORS.ink,
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  quickLogBarIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLogBarCopy: {
    flex: 1,
  },
  quickLogWeightBtn: {
    minWidth: 98,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E4DACE',
  },
  quickLogBarPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  quickLogBarText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' as const },
  quickLogBarSubtext: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    marginTop: 1,
  },
  quickLogWeightText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  // Section headers — Uber bold labels
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#111111', fontSize: 20, letterSpacing: -0.5 },
  sectionAction: { color: '#111111', fontSize: 14 },
  // Mobile content wrapper — uniform P3 gap between sections
  mobileContentWrapper: { gap: spacing.lg },
  mobilePerfTitle: {
    color: '#111111',
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 240, 225, 0.7)',
    borderWidth: 0.5,
    borderColor: 'rgba(246, 194, 143, 0.6)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
    ...saasShadows.subtle,
  },
  streakText: {
    color: BRAND_COLORS.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND_COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'all 0.15s ease-out',
      boxShadow: '0 10px 22px rgba(17,17,17,0.04)',
    }),
  },
  // Goals card - extends BentoCard with margin
  goalsCard: {
    ...(Platform.OS !== 'web' ? {
      backgroundColor: '#FFFEFB',
      borderColor: '#E8DED2',
      borderRadius: 28,
      shadowOpacity: 0.05,
    } : {}),
  },
  goalsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  goalsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  goalTypeIconSmall: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalLabel: {
    color: Platform.OS !== 'web' ? '#8A7560' : BRAND_COLORS.textSecondary,
    marginBottom: 2,
  },
  editGoalsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Platform.OS !== 'web' ? '#F8EFE4' : BRAND_COLORS.primaryTint,
    borderWidth: Platform.OS !== 'web' ? 1 : 0,
    borderColor: Platform.OS !== 'web' ? '#EADAC4' : 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'all 0.15s ease-out',
    }),
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  goalItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 64,
    minHeight: 84,
    borderRadius: 18,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(242,233,222,0.8)',
    backgroundColor: Platform.OS !== 'web' ? '#F8F4ED' : 'rgba(255,255,255,0.58)',
  },
  goalItemCalories: { backgroundColor: '#FFF1E5', borderColor: '#F4D5B9' },
  goalItemProtein: { backgroundColor: '#EAF8F2', borderColor: '#CEE8DB' },
  goalItemCarbs: { backgroundColor: '#F0F5E8', borderColor: '#DAE4C2' },
  goalItemFat: { backgroundColor: '#FFF4E9', borderColor: '#F2D8BF' },
  goalItemLabel: {
    color: '#6B665F',
    marginTop: 4,
    textAlign: 'center',
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    ...(Platform.OS === 'web'
      ? { paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.light.border }
      : { marginTop: spacing.md }),
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: Platform.OS !== 'web' ? '#F8F4ED' : 'transparent',
    borderWidth: Platform.OS !== 'web' ? 1 : 0,
    borderColor: Platform.OS !== 'web' ? '#EADFD0' : 'transparent',
  },
  // Set goals prompt - Aura look with SaaS shadow
  setGoalsPrompt: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Platform.OS !== 'web' ? '#E7DCCF' : BRAND_COLORS.border,
    backgroundColor: '#FFFEFB',
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#111111',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.05,
      shadowRadius: 22,
      elevation: 6,
    } : {}),
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'all 0.2s ease-out',
      boxShadow: '0 10px 22px rgba(17,17,17,0.04)',
    }),
  },
  setGoalsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Platform.OS !== 'web' ? spacing.lg : spacing.md,
    gap: spacing.md,
  },
  setGoalsIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: BRAND_COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setGoalsText: {
    flex: 1,
  },
  setGoalsTitle: {
    color: BRAND_COLORS.textPrimary,
  },
  setGoalsSubtext: {
    color: BRAND_COLORS.textMuted,
    marginTop: 2,
  },
  setGoalsChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BRAND_COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: BRAND_COLORS.border,
  },
  // Calorie card - Stripe/Linear style
  calorieCard: {
    padding: spacing.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: '#E9E6F5',
    ...saasShadows.card,
  },
  addFoodButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'all 0.2s ease-out',
    }),
  },
  addFoodButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  addFoodGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  addFoodTextContainer: {
    flex: 1,
  },
  addFoodTitle: {
    color: '#FFF',
  },
  addFoodSubtitle: {
    color: 'rgba(255,255,255,0.8)',
  },
  // Compact Snap Button
  compactSnapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#111111',
    gap: 6,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'opacity 0.2s',
    }),
  },
  compactSnapBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  compactSnapBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Meals card — web uses BentoCard styles, mobile uses MOBILE_CARD_STYLES from render
  mealsCard: {
    ...(Platform.OS === 'web' ? { ...BENTO_CARD_STYLES, ...(BENTO_CARD_WEB_STYLES as object) } : {}),
  },
  mealsCardDesktop: {
    flex: 1,
    minHeight: 200,
  },
  mealsCardSidebar: {
    flex: 0,
  },
  mealsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  mealsTitle: {
    color: BRAND_COLORS.textPrimary,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  mealsSubtitle: {
    color: '#7A6B5C',
  },
  emptyMealsWrapper: {
    flex: 1,
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMealsContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Platform.OS !== 'web' ? spacing['2xl'] : spacing.xl,
    backgroundColor: '#F7F6F3',
    borderRadius: radii.lg, // 16
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: BRAND_COLORS.border,
    gap: spacing.sm,
    width: '100%',
  },
  emptyMealsContentPressed: {
    backgroundColor: '#F1EFEB',
    transform: [{ scale: 0.99 }],
  },
  emptyMealsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND_COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: BRAND_COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyMealsTextContainer: {
    alignItems: 'center',
  },
  emptyMealsTitle: {
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  emptyMealsHint: {
    color: '#8B7A6A',
    marginTop: 2,
    textAlign: 'center',
  },
  mealsList: {
    gap: spacing.sm,
  },
  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Platform.OS !== 'web' ? spacing.md : spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BRAND_COLORS.borderSubtle,
    gap: Platform.OS !== 'web' ? spacing.lg : spacing.md,
  },
  mealDetails: {
    flex: 1,
    gap: 2,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealCalories: {
    color: Platform.OS !== 'web' ? '#111111' : BRAND_COLORS.primaryDark,
    fontSize: 14,
    fontWeight: '700',
  },
  mealMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mealTime: {
    color: colors.light.textSecondary,
    fontSize: 12,
  },
  mealMacros: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mealMacroText: {
    color: colors.light.textSecondary,
    fontSize: 11,
  },
  mealMacroDivider: {
    color: colors.light.textMuted,
    fontSize: 11,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
  },
  supportText: {
    color: '#4B5563',
  },

});

const webStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  scrollContentMobile: {},
  scrollStack: {
    width: '100%',
  },
  scrollStackMobile: {
    gap: spacing['2xl'],
  },
  heroSection: {
    flexDirection: 'row',
    gap: 64,
    maxWidth: 1360,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 56,
    paddingBottom: 56,
  },
  heroSectionMobile: {
    flexDirection: 'column',
    gap: spacing.xl,
    paddingTop: 0,
    paddingBottom: 0,
  },
  heroSectionCompact: {
    paddingHorizontal: spacing.lg,
  },
  heroLeft: {
    flex: 1,
    maxWidth: 560,
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroEyebrowRowMobile: {
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  heroEyebrowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroEyebrowText: {
    color: '#111111',
  },
  heroInlineLink: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,17,17,0.18)',
    paddingBottom: 2,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
    }),
  },
  heroInlineLinkPressed: {
    opacity: 0.72,
  },
  heroInlineLinkText: {
    color: '#111111',
  },
  heroTitle: {
    color: '#111111',
    fontSize: 52,
    lineHeight: 62,
    letterSpacing: -1.5,
    maxWidth: 520,
  },
  heroTitleMobile: {
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -1.2,
  },
  heroTitleCompact: {
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1,
  },
  // Uber home widget stop rows: fixed 56px rows + 12px gaps so the rail glyphs
  // (row centers at 28 / 96 / 164) and the connecting line stay aligned.
  heroStops: {
    position: 'relative',
    marginTop: 32,
    maxWidth: 480,
    alignSelf: 'stretch',
  },
  heroStopsRail: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    width: 10,
    zIndex: 2,
  },
  heroStopsLine: {
    position: 'absolute',
    left: 4,
    width: 2,
    top: 28,
    bottom: 28,
    backgroundColor: '#111111',
  },
  heroStopCircle: {
    position: 'absolute',
    left: 0,
    top: 23,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStopMid: {
    position: 'absolute',
    left: 2,
    top: 93,
    width: 6,
    height: 6,
    backgroundColor: '#111111',
  },
  heroStopSquare: {
    position: 'absolute',
    left: 0,
    top: 159,
    width: 10,
    height: 10,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStopInnerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  heroStopInnerSquare: {
    width: 3,
    height: 3,
    backgroundColor: '#FFFFFF',
  },
  heroStopRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F3F3',
    borderRadius: 8,
    paddingLeft: 40,
    paddingRight: 16,
    marginBottom: 12,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'background-color 0.15s ease-out',
    }),
  },
  heroStopRowLast: {
    marginBottom: 0,
  },
  heroStopLabel: {
    color: '#5E5E5E',
    fontSize: 16,
  },
  heroInputPressed: {
    backgroundColor: '#ECECEC',
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  heroActionsMobile: {
    gap: spacing.md,
  },
  heroPrimaryCta: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 8,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
    }),
  },
  heroPrimaryCtaText: {
    color: '#FFFFFF',
  },
  heroSecondaryLink: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,17,17,0.18)',
    paddingBottom: 4,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
    }),
  },
  heroSecondaryLinkText: {
    color: '#111111',
  },
  heroCtaPressed: {
    opacity: 0.9,
  },
  heroRight: {
    flex: 1.05,
    paddingTop: 92,
  },
  // Full-width band under the hero for shelves and feeds (same page gutter as heroSection)
  engageSection: {
    maxWidth: 1360,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: 24,
  },
  engageSectionMobile: {
    paddingHorizontal: spacing.md,
  },
  insightsRow: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
    marginVertical: spacing.md,
  },
  insightsRowMobile: {
    flexDirection: 'column',
    gap: 0,
  },
  insightsCol: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  heroLeftMobile: {
    flexBasis: 'auto' as any,
    flexShrink: 0,
  },
  heroRightMobile: {
    paddingTop: 0,
    flexBasis: 'auto' as any,
    flexShrink: 0,
  },
  suggestionsTitle: {
    color: '#111111',
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    marginBottom: 20,
  },
  suggestionsTitleCompact: {
    fontSize: 24,
    lineHeight: 28,
  },
  section: {
    maxWidth: 1360,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 32,
    paddingBottom: 40,
  },
  sectionMobile: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  sectionCompact: {
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  sectionEyebrow: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sectionEyebrowWarm: {
    backgroundColor: '#FFF1D7',
  },
  sectionEyebrowCool: {
    backgroundColor: '#E9F4FF',
  },
  sectionEyebrowPink: {
    backgroundColor: '#FCE4EC',
  },
  sectionEyebrowText: {
    color: '#111111',
  },
  sectionHeading: {
    color: '#111111',
    fontSize: 56,
    lineHeight: 58,
    letterSpacing: -2.2,
  },
  sectionHeadingMobile: {
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.4,
  },
  sectionHeadingCompact: {
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1.1,
  },
  sectionSubheading: {
    color: '#111111',
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 760,
  },
  activityCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E7E7E7',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  activityCardMobile: {
    flexDirection: 'column',
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  activityCol1: {
    flex: 2.1,
    padding: 24,
    borderRightWidth: 1,
    borderRightColor: '#ECECEC',
  },
  activityCol2: {
    flex: 2,
    padding: 24,
    borderRightWidth: 1,
    borderRightColor: '#ECECEC',
  },
  activityCol3: {
    flex: 1.9,
    padding: 24,
  },
  activityColMobile: {
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginBottom: spacing.lg,
    paddingBottom: spacing.sm,
    flexBasis: 'auto' as any,
    flexShrink: 0,
  },
  activityColMobileSeparated: {
    marginTop: spacing.sm,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: '#ECECEC',
  },
  activityColMobileLast: {
    padding: spacing.xl,
    paddingBottom: spacing.sm,
    marginBottom: 0,
    flexBasis: 'auto' as any,
    flexShrink: 0,
  },
  colTitle: {
    color: '#111111',
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.4,
    marginBottom: spacing.lg,
  },
  programCard: {
    backgroundColor: '#FFF2D5',
    borderRadius: 18,
    padding: spacing.xl,
    minHeight: 260,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'opacity 0.15s ease-out',
    }),
  },
  programCardMobile: {
    minHeight: 220,
    padding: 18,
  },
  programCardPressed: {
    opacity: 0.92,
  },
  programCardCopy: {
    maxWidth: 240,
    zIndex: 1,
  },
  programCardLabel: {
    color: 'rgba(17,17,17,0.62)',
    marginBottom: 10,
  },
  programCardTitle: {
    color: '#111111',
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.6,
  },
  programCardTitleMobile: {
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1.2,
  },
  programCardBody: {
    color: '#343434',
    marginTop: 12,
  },
  programCardAction: {
    alignSelf: 'flex-start',
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  programCardActionText: {
    color: '#111111',
  },
  programCardIllustration: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 180,
    height: 180,
  },
  programCardIllustrationMobile: {
    width: 140,
    height: 140,
  },
  metricStack: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLabel: {
    color: '#111111',
  },
  metricValue: {
    color: '#666666',
  },
  metricTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#EFEFEF',
    overflow: 'hidden',
    marginBottom: 4,
  },
  metricFill: {
    height: '100%',
    borderRadius: 999,
  },
  mealsList: {
    gap: 16,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
  },
  mealRowCopy: {
    flex: 1,
  },
  mealRowTitle: {
    color: '#111111',
  },
  mealRowMeta: {
    color: '#6B6B6B',
    marginTop: 2,
  },
  seeDetailsBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#F3F3F3',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
    }),
  },
  seeDetailsText: {
    color: '#111111',
  },
  viewAllBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#F3F3F3',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
    }),
  },
  viewAllBtnText: {
    color: '#111111',
  },
  emptyMeals: {
    flexDirection: 'row',
    gap: 12,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#F7F7F7',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
    }),
  },
  emptyMealsCopy: {
    flex: 1,
  },
  emptyMealsTitle: {
    color: '#111111',
  },
  emptyMealsSubtitle: {
    color: '#6B6B6B',
    marginTop: 4,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#F6F6F6',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
    }),
  },
  serviceCardPressed: {
    opacity: 0.92,
  },
  serviceIllustration: {
    width: 52,
    height: 52,
  },
  serviceCopy: {
    flex: 1,
  },
  serviceTitle: {
    color: '#111111',
    marginBottom: 2,
  },
  serviceBody: {
    color: '#6B6B6B',
  },
  // ── PERFORMANCE TODAY — matches "Your account and activity" heading ──
  perfTitle: {
    color: '#111111',
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '700',
    letterSpacing: -1.6,
    marginBottom: 28,
  },
  perfTitleMobile: {
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.2,
  },
  perfHero: {
    marginBottom: 20,
  },
  perfRow: {
    flexDirection: 'row',
    gap: 20,
  },
  perfHalf: {
    flex: 1,
  },
  // Legacy — kept so TS doesn't break on any remaining refs
  performanceContainer: {},
  performanceRow: { flexDirection: 'row', gap: 16 },
  performancePrimary: { flex: 1 },
  performanceSecondary: { flex: 1, gap: 16 },
  planRow: {
    flexDirection: 'row',
    gap: 28,
  },
  planRowMobile: {
    flexDirection: 'column',
  },
  planAccentCard: {
    flex: 2.2,
    borderRadius: 28,
    padding: 32,
    overflow: 'hidden',
    minHeight: 460,
    borderWidth: 1,
    borderColor: '#E6E1D8',
    backgroundColor: '#FFF7EA',
  },
  planAccentCardMobile: {
    minHeight: 0,
    padding: 22,
  },
  planBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#EAE4D9',
  },
  planBadgeText: {
    color: '#111111',
  },
  planAccentTitle: {
    color: '#111111',
    fontSize: 52,
    lineHeight: 54,
    letterSpacing: -2,
    maxWidth: 560,
  },
  planAccentTitleMobile: {
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -1.3,
  },
  planAccentBody: {
    color: '#2C2C2C',
    fontSize: 18,
    lineHeight: 28,
    marginTop: 16,
    maxWidth: 520,
  },
  planTabsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  planTabsRowMobile: {
    flexDirection: 'column',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  planTab: {
    flex: 1,
    minHeight: 88,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out',
      boxShadow: '0 10px 22px rgba(17,17,17,0.04)',
    }),
  },
  planTabPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  planTabMobile: {
    width: '100%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planTabIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTabTitle: {
    color: '#111111',
  },
  planPreviewStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  planPreviewStatsMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  planField: {
    flex: 1,
    minHeight: 72,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#EAE4D9',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 10px 22px rgba(17,17,17,0.04)' } as any)
      : {}),
  },
  planFieldCompact: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 64,
  },
  planFieldLabel: {
    color: 'rgba(17,17,17,0.62)',
    marginBottom: 6,
  },
  planFieldValue: {
    color: '#111111',
  },
  planFieldValueCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  planCitation: {
    color: 'rgba(17,17,17,0.45)',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
    marginBottom: 4,
  },
  planCitationLink: {
    color: BRAND_COLORS.primary,
    fontSize: 12,
    lineHeight: 16,
    textDecorationLine: 'underline',
  },
  planCta: {
    alignSelf: 'flex-start',
    backgroundColor: '#111111',
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 12,
    zIndex: 2,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
    }),
  },
  planCtaText: {
    color: '#FFFFFF',
  },
  planIllustration: {
    position: 'absolute',
    right: -10,
    bottom: -12,
    width: 220,
    height: 220,
    opacity: 0.25,
  },
  planIllustrationMobile: {
    width: 140,
    height: 140,
    right: -10,
    bottom: -10,
  },
  planBenefitsPanel: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E7E7E7',
    padding: 24,
    justifyContent: 'space-between',
  },
  planBenefitsTitle: {
    color: '#111111',
    marginBottom: 12,
  },
  benefitRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 0,
    alignItems: 'flex-start',
  },
  benefitRowLast: {
    borderBottomWidth: 0,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitCopy: {
    flex: 1,
  },
  benefitTitle: {
    color: '#111111',
    marginBottom: 4,
  },
  benefitBody: {
    color: '#5E5E5E',
    lineHeight: 24,
  },
  footerWrap: {
    maxWidth: 1360,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 32,
    paddingBottom: 56,
  },
  footerWrapCompact: {
    paddingHorizontal: spacing.lg,
  },
});

export default DashboardScreen;
