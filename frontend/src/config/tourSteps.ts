/**
 * Tour Steps Configuration
 * Defines the content and order of the "Take a Tour" feature
 *
 * Web: 5 steps (includes Quick Actions)
 * Native: 4 steps (Quick Actions removed from dashboard flow)
 */
import { Platform } from 'react-native';

export interface TourStep {
  zone: number;
  screen: string;
  title: string;
  text: string;
}

// Step 1: Snap Your Meal (Dashboard)
export const SNAP_MEAL_STEP: TourStep = {
  zone: 1,
  screen: 'Dashboard',
  title: 'Snap Your Meal',
  text: 'Start here to log a meal with the camera or photo library.',
};

// Step 2: Today's Nutrition (Dashboard)
export const TODAYS_NUTRITION_STEP: TourStep = {
  zone: 2,
  screen: 'Dashboard',
  title: "Today's Nutrition",
  text: "See today's calories, macros, and estimated glycemic impact in one place.",
};

// Step 3: Quick Actions (Dashboard)
export const QUICK_ACTIONS_STEP: TourStep = {
  zone: 3,
  screen: 'Dashboard',
  title: 'Quick Actions',
  text: 'Open history, weekly insights, and tools from one place.',
};

// Step 4: Workouts (Workouts screen)
export const WORKOUTS_TOUR_STEP: TourStep = {
  zone: 4,
  screen: 'Workouts',
  title: 'Find Workouts',
  text: 'Search workouts by goal, muscle group, or equipment.',
};

// Step 5: Recipes (Recipes screen)
export const RECIPES_TOUR_STEP: TourStep = {
  zone: 5,
  screen: 'Recipes',
  title: 'Discover Recipes',
  text: 'Browse recipes by ingredient, diet, or prep time.',
};

const DASHBOARD_TOUR_STEPS: TourStep[] = Platform.OS === 'web'
  ? [SNAP_MEAL_STEP, TODAYS_NUTRITION_STEP, QUICK_ACTIONS_STEP]
  : [SNAP_MEAL_STEP, TODAYS_NUTRITION_STEP];

// All tour steps in order
export const ALL_TOUR_STEPS: TourStep[] = [
  ...DASHBOARD_TOUR_STEPS,
  WORKOUTS_TOUR_STEP,
  RECIPES_TOUR_STEP,
];

// Total number of zones in the tour
export const TOTAL_TOUR_ZONES = ALL_TOUR_STEPS.length;

// AsyncStorage key for tour status
export const TOUR_STATUS_KEY = '@app_tour_completed';
