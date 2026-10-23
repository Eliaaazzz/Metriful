import { House, Barbell, Camera, BookOpen, User } from 'phosphor-react-native';
import {
  BottomTabBar,
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer, useIsFocused } from '@react-navigation/native';
import { CardStyleInterpolators, createStackNavigator } from '@react-navigation/stack';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import {
  Platform,
  Pressable,
  type PressableStateCallbackType,
  Text as RNText,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { navigationRef } from './navigationService';

import { ErrorBoundary } from '@/components';
import { AuthenticatedNav, Sidebar } from '@/components/layout';
import DashboardScreen from '@/screens/DashboardScreen';
import LoginScreen from '@/screens/LoginScreen';
import RegisterScreen from '@/screens/RegisterScreen';
import OnboardingScreen from '@/screens/OnboardingScreen';
import { MealHistoryScreen } from '@/screens/MealHistoryScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import { RecipeDetailScreen } from '@/screens/RecipeDetailScreen';
import { RecipesScreen } from '@/screens/RecipesScreen';
import { ResultsScreen } from '@/screens/ResultsScreen';
import { ReviewMealScreen } from '@/screens/ReviewMealScreen';
import { SavedRecipesScreen } from '@/screens/SavedRecipesScreen';
import { SavedWorkoutsScreen } from '@/screens/SavedWorkoutsScreen';
import LandingScreen from '@/screens/LandingScreen';
import SplashScreen from '@/screens/SplashScreen';
import { AboutNutritionDataScreen } from '@/screens/AboutNutritionDataScreen';
import { BuildPlanScreen } from '@/screens/BuildPlanScreen';
import { HelpScreen } from '@/screens/HelpScreen';
import { ManageAccountScreen } from '@/screens/ManageAccountScreen';
import { WeeklyInsightsScreen } from '@/screens/WeeklyInsightsScreen';
import { WorkoutsScreen } from '@/screens/WorkoutsScreen';
import { recordInitialScreen, trackScreenView } from '@/services/analytics';
import { BRAND_COLORS, TAB_ICON_SIZE, useResponsive, useSidebarVisible } from '@/utils';

// Wrap screens with ErrorBoundary to prevent white screen crashes
const withErrorBoundary = (Component: React.ComponentType<any>, _screenName: string) => {
  return function WrappedScreen(props: any) {
    return (
      <ErrorBoundary>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
};

const SafeDashboardScreen = withErrorBoundary(DashboardScreen, 'Dashboard');
const SafeWorkoutsScreen = withErrorBoundary(WorkoutsScreen, 'Workouts');
const SafeRecipesScreen = withErrorBoundary(RecipesScreen, 'Recipes');
const SafeProfileScreen = withErrorBoundary(ProfileScreen, 'Profile');
const SafeRecipeDetailScreen = withErrorBoundary(RecipeDetailScreen, 'RecipeDetail');
const SafeResultsScreen = withErrorBoundary(ResultsScreen, 'Results');
const SafeReviewMealScreen = withErrorBoundary(ReviewMealScreen, 'ReviewMeal');
const SafeMealHistoryScreen = withErrorBoundary(MealHistoryScreen, 'MealHistory');
const SafeWeeklyInsightsScreen = withErrorBoundary(WeeklyInsightsScreen, 'WeeklyInsights');
const SafeSavedWorkoutsScreen = withErrorBoundary(SavedWorkoutsScreen, 'SavedWorkouts');
const SafeSavedRecipesScreen = withErrorBoundary(SavedRecipesScreen, 'SavedRecipes');
const SafeAboutNutritionDataScreen = withErrorBoundary(AboutNutritionDataScreen, 'AboutNutritionData');
const SafeBuildPlanScreen = withErrorBoundary(BuildPlanScreen, 'BuildPlan');
const SafeHelpScreen = withErrorBoundary(HelpScreen, 'Help');
const SafeManageAccountScreen = withErrorBoundary(ManageAccountScreen, 'ManageAccount');
const SafeOnboardingScreen = withErrorBoundary(OnboardingScreen, 'Onboarding');

const Tab = createBottomTabNavigator();
// Use createStackNavigator instead of createNativeStackNavigator for Web compatibility
const Stack = createStackNavigator();

/**
 * Subtle floating tab bar.
 * Keep the layered feel, but avoid turning the tab bar into the main visual.
 */
const TabBarBackground = () => (
  <View style={tabBarStyles.shell}>
    {Platform.OS === 'web' ? (
      <View style={tabBarStyles.webFallbackBlur} />
    ) : (
      <BlurView intensity={34} tint="light" style={tabBarStyles.blurLayer} />
    )}
    <View style={tabBarStyles.fillLayer} />
    <View style={tabBarStyles.topHighlight} />
    <View style={tabBarStyles.outline} />
  </View>
);

const TabIconShell = ({ focused, children }: { focused: boolean; children: React.ReactNode }) => {
  const scale = useSharedValue(focused ? 1 : 1);
  const bgOpacity = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    if (focused) {
      scale.value = 0.95;
      scale.value = withSpring(1, { damping: 12, stiffness: 150 });
      bgOpacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withSpring(1, { damping: 20, stiffness: 200 });
      bgOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [focused, scale, bgOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 0.64 + bgOpacity.value * 0.36,
  }));

  return (
    <Animated.View style={[tabBarStyles.iconShell, focused && tabBarStyles.iconShellFocused, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

const TabBarLabel = ({ focused, label }: { focused: boolean; label: string }) => (
  <RNText
    allowFontScaling
    maxFontSizeMultiplier={1.1}
    style={[tabBarStyles.label, focused ? tabBarStyles.labelFocused : tabBarStyles.labelInactive]}
  >
    {label}
  </RNText>
);

const tabBarStyles = StyleSheet.create({
  frame: {
    width: '92%',
    minWidth: 0,
  },
  shell: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    overflow: 'hidden',
  },
  blurLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  webFallbackBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.86)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  } as any,
  fillLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.52)',
  },
  outline: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.06)',
  },
  iconShell: {
    width: 44,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  iconShellFocused: {
    backgroundColor: 'rgba(17,17,17,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.06)',
  },
  label: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.15,
    marginTop: 2,
    paddingBottom: 1,
    textAlign: 'center',
  },
  labelFocused: {
    color: BRAND_COLORS.textPrimary,
  },
  labelInactive: {
    color: BRAND_COLORS.textMuted,
  },
});

// Desktop layout styles
const styles = StyleSheet.create({
  desktopContainerVertical: {
    flex: 1,
    flexDirection: 'column',
  },
  mainContent: {
    flex: 1,
  },
});

const LightNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: BRAND_COLORS.primary,
    background: BRAND_COLORS.background,
    card: BRAND_COLORS.surfaceElevated,
    text: BRAND_COLORS.textPrimary,
    border: BRAND_COLORS.border,
    notification: BRAND_COLORS.secondary,
  },
};

const DarkNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: BRAND_COLORS.primary,
    background: BRAND_COLORS.background,
    card: BRAND_COLORS.surface,
    text: BRAND_COLORS.textPrimary,
    border: 'rgba(255,255,255,0.1)',
    notification: BRAND_COLORS.secondary,
  },
};

/**
 * Web-compatible Stack screen options
 *
 * IMPORTANT: `cardStyle: { flex: 1 }` is critical for Web platform.
 * Without this, the Stack Navigator's card container collapses to height 0,
 * breaking FlatList/ScrollView scrolling.
 *
 * This is the industry standard pattern for Tab > Stack > Screen architecture.
 * Native platforms handle this automatically, but Web requires explicit flex.
 */
const webCompatibleStackScreenOptions = {
  headerShown: false,
  cardStyle: { flex: 1 },
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
  gestureEnabled: true,
};

/**
 * Creates a Stack Navigator wrapper for a tab with detail screens.
 * Use this factory function to ensure consistent Web-compatible configuration.
 *
 * @example
 * const RecipesStackScreen = createTabStackNavigator([
 *   { name: 'RecipesList', component: RecipesScreen },
 *   { name: 'RecipeDetail', component: RecipeDetailScreen },
 * ]);
 */
type StackScreenConfig = {
  name: string;
  component: React.ComponentType<any>;
};

const createTabStackNavigator = (screens: StackScreenConfig[]) => {
  const TabStack = createStackNavigator();
  return function TabStackScreen() {
    return (
      <TabStack.Navigator screenOptions={webCompatibleStackScreenOptions}>
        {screens.map((screen) => (
          <TabStack.Screen
            key={screen.name}
            name={screen.name}
            component={screen.component}
          />
        ))}
      </TabStack.Navigator>
    );
  };
};

// Stack navigator for Recipes tab: RecipesList -> RecipeDetail
const RecipesStackScreen = createTabStackNavigator([
  { name: 'RecipesList', component: SafeRecipesScreen },
  { name: 'RecipeDetail', component: SafeRecipeDetailScreen },
]);

// Stack navigator for Profile tab: Profile -> WeeklyInsights / MealHistory / SavedWorkouts / SavedRecipes
const ProfileStackScreen = createTabStackNavigator([
  { name: 'ProfileMain', component: SafeProfileScreen },
  { name: 'WeeklyInsights', component: SafeWeeklyInsightsScreen },
  { name: 'MealHistory', component: SafeMealHistoryScreen },
  { name: 'SavedWorkouts', component: SafeSavedWorkoutsScreen },
  { name: 'SavedRecipes', component: SafeSavedRecipesScreen },
  { name: 'AboutNutritionData', component: SafeAboutNutritionDataScreen },
  { name: 'Help', component: SafeHelpScreen },
  { name: 'ManageAccount', component: SafeManageAccountScreen },
]);

// Tab configuration for cleaner code
const TAB_CONFIG = [
  {
    name: 'Dashboard',
    component: SafeDashboardScreen,
    label: 'Home',
    phosphorIcon: House,
    accessibilityLabel: 'Home tab',
  },
  {
    name: 'Workouts',
    component: SafeWorkoutsScreen,
    label: 'Workouts',
    phosphorIcon: Barbell,
    accessibilityLabel: 'Workouts tab',
  },
  {
    name: 'Capture',
    component: SafeDashboardScreen, // Placeholder - actual action handled by custom button
    label: '',
    phosphorIcon: Camera,
    isCamera: true, // Special flag for camera button
    accessibilityLabel: 'Capture meal photo',
  },
  {
    name: 'Recipes',
    component: RecipesStackScreen, // Use Stack navigator for proper navigation hierarchy
    label: 'Recipes',
    phosphorIcon: BookOpen,
    accessibilityLabel: 'Recipes tab',
  },
  {
    name: 'Profile',
    component: ProfileStackScreen, // Stack navigator for Profile -> WeeklyInsights / MealHistory
    label: 'Profile',
    phosphorIcon: User,
    accessibilityLabel: 'Profile tab',
  },
];

// Custom camera button component for bottom tab
type CameraTabButtonProps = Partial<BottomTabBarButtonProps>;

const CameraTabButton = ({
  children: _children,
  style,
  onPress,
  onLongPress,
  testID,
  accessibilityLabel,
  accessibilityState,
  role,
  android_ripple,
}: CameraTabButtonProps) => (
  <Pressable
    onPress={onPress}
    onLongPress={onLongPress}
    testID={testID}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel || 'Capture meal photo'}
    accessibilityHint="Opens the camera to photograph a meal"
    accessibilityState={accessibilityState}
    role={role as any}
    android_ripple={android_ripple}
    style={({ pressed }: PressableStateCallbackType) => [
      style,
      cameraButtonStyles.button,
      cameraButtonStyles.container,
      pressed && cameraButtonStyles.pressed,
    ]}
  >
    <View style={cameraButtonStyles.shell}>
      <Camera size={24} color="#FFFFFF" weight="fill" />
    </View>
  </Pressable>
);

const cameraButtonStyles = StyleSheet.create({
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: 'transparent',
  },
  container: {
    position: 'relative',
    top: -18,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    shadowColor: '#171511',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  shell: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
});

const MainTabs = () => {
  const { isDesktop, isTablet, isWeb } = useResponsive();
  const showSidebar = useSidebarVisible();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const tabBarLabelFontSize = isDesktop ? 11 : 12;
  const tabBarLabelLineHeight = tabBarLabelFontSize + 2;
  // Calculate safe tab bar height with proper bottom inset
  // Keep extra vertical room for the custom glass icon shell and tab label stack.
  const baseTabBarHeight = isDesktop ? 68 : isTablet ? 76 : 76;
  const tabBarPaddingBottom = Platform.select({
    ios: Math.max(insets.bottom, 4) + 2,
    android: Math.max(insets.bottom, 4) + 2,
    default: 8, // web
  });
  const tabBarHeight = baseTabBarHeight + tabBarPaddingBottom;
  const tabBarPaddingTop = 10;
  // Two-layer approach:
  // - Outer wrapper: position + centering only (left:0, right:0, alignItems:'center')
  // - Inner frame: width constraint only
  // - BottomTabBar: visuals only
  // React Navigation's internal BottomTabBar root still carries start/end positioning,
  // so keeping width on a parent frame avoids the right-shift drift.
  const renderTabBar = (props: React.ComponentProps<typeof BottomTabBar>) => (
    !isFocused ? null : (
    <View
      pointerEvents="box-none"
      style={{
        position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as 'absolute',
        left: 0,
        right: 0,
        bottom: isWeb ? 12 : 8,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        width: '100%',
      }}
    >
      <View style={[tabBarStyles.frame, { maxWidth: isWeb ? 560 : 520, alignSelf: 'center' }]}>
        <BottomTabBar {...props} />
      </View>
    </View>
    )
  );

  const getTabBarIcon = (routeName: string, focused: boolean, color: string) => {
    const config = TAB_CONFIG.find(t => t.name === routeName);
    if (!config) return null;

    // Camera button has custom rendering
    if ((config as any).isCamera) {
      return null;
    }

    const size = focused ? TAB_ICON_SIZE.focused : TAB_ICON_SIZE.default;
    const IconComponent = config.phosphorIcon;

    return (
      <TabIconShell focused={focused}>
        <IconComponent size={size} color={color} weight={focused ? 'fill' : 'regular'} />
      </TabIconShell>
    );
  };

  // Desktop layout with sidebar - filter out the Capture tab
  const desktopTabs = TAB_CONFIG.filter(tab => !(tab as any).isCamera);

  if (showSidebar) {
    return (
      <View style={styles.desktopContainerVertical}>
        <AuthenticatedNav />
        <View style={styles.mainContent}>
          <Tab.Navigator
            initialRouteName="Dashboard"
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: 'none' }, // Hide tab bar on desktop
            }}
          >
            {desktopTabs.map((tab) => (
              <Tab.Screen
                key={tab.name}
                name={tab.name}
                component={tab.component}
                options={{ title: tab.label }}
              />
            ))}
          </Tab.Navigator>
        </View>
      </View>
    );
  }

  // Mobile layout with bottom tabs
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      safeAreaInsets={{ left: 0, right: 0, top: 0, bottom: 0 }}
      tabBar={renderTabBar}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: BRAND_COLORS.textPrimary,
        tabBarInactiveTintColor: BRAND_COLORS.textSecondary,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: {
          fontSize: tabBarLabelFontSize,
          lineHeight: tabBarLabelLineHeight,
          fontWeight: '700',
          marginTop: 4,
          letterSpacing: 0.2,
          paddingBottom: 1,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarItemStyle: {
          flex: 1,
          minHeight: 56,
          paddingTop: 2,
          paddingBottom: 0,
        },
        tabBarStyle: {
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: tabBarPaddingTop,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          borderRadius: 30,
          shadowColor: '#0F172A',
          shadowOpacity: 0.08,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 0,
          width: '100%',
        },
        tabBarBackground: TabBarBackground,
        tabBarIcon: ({ focused, color }) => getTabBarIcon(route.name, focused, color),
      })}
    >
      {TAB_CONFIG.map((tab) => {
        const isCamera = (tab as any).isCamera;
        return (
          <Tab.Screen
            key={tab.name}
            name={tab.name}
            component={tab.component}
            options={({ navigation }) => ({
              title: tab.label,
              tabBarAccessibilityLabel: tab.accessibilityLabel,
              tabBarLabel: isCamera
                ? () => null
                : ({ focused }) => <TabBarLabel focused={focused} label={tab.label} />,
              tabBarButton: isCamera
                ? () => (
                    <CameraTabButton
                      onPress={() => {
                        navigation.navigate('Dashboard', { triggerCamera: true });
                      }}
                      accessibilityLabel="Capture meal photo"
                    />
                  )
                : undefined,
            })}
            listeners={({ navigation }) => ({
              tabPress: (e) => {
                if (isCamera) {
                  e.preventDefault();
                  navigation.navigate('Dashboard', { triggerCamera: true }); 
                }
              }
            })}
          />
        );
      })}
      </Tab.Navigator>
  );
};

// F11 — Floating workout session strip mounted at navigator root.
const WorkoutSessionStripRoot = () => {
  // Lazy import to keep the navigator file lean.
  const { WorkoutSessionStrip } = require('@/components/WorkoutSessionStrip') as typeof import('@/components/WorkoutSessionStrip');
  const { usePostWorkoutStore } = require('@/stores/usePostWorkoutStore') as typeof import('@/stores/usePostWorkoutStore');
  const recordFinish = usePostWorkoutStore((s) => s.recordFinish);
  // Finishing a session feeds the training→nutrition loop: the Dashboard offers a
  // recovery-meal log for the next 2 hours (see RecoveryMealCard).
  return <WorkoutSessionStrip bottomInset={96} onFinish={recordFinish} />;
};

export const AppNavigator = () => {
  // Always use light mode
  return (
    <NavigationContainer
      ref={navigationRef}
      theme={LightNavigationTheme}
      // GA4 screen tracking: seed with the initial route (its page load is
      // already counted by the head snippet), then log each screen change.
      onReady={() => recordInitialScreen(navigationRef.getCurrentRoute()?.name)}
      onStateChange={() => trackScreenView(navigationRef.getCurrentRoute()?.name)}
    >
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={webCompatibleStackScreenOptions}
      >
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{ cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter }}
        />
        <Stack.Screen
          name="Landing"
          component={LandingScreen}
          options={{ cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
        />
        <Stack.Screen
          name="Onboarding"
          component={SafeOnboardingScreen}
          options={{ cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS }}
        />
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{ cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter }}
        />
        <Stack.Screen
          name="Results"
          component={SafeResultsScreen}
          options={{ cardStyleInterpolator: CardStyleInterpolators.forModalPresentationIOS }}
        />
        <Stack.Screen
          name="ReviewMeal"
          component={SafeReviewMealScreen}
          options={{ cardStyleInterpolator: CardStyleInterpolators.forModalPresentationIOS }}
        />
        <Stack.Screen
          name="AboutNutritionData"
          component={SafeAboutNutritionDataScreen}
        />
        <Stack.Screen
          name="Help"
          component={SafeHelpScreen}
        />
        <Stack.Screen
          name="BuildPlan"
          component={SafeBuildPlanScreen}
          options={{ cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS }}
        />
      </Stack.Navigator>
      {/* F11 — Floating workout session strip; renders only when a session is active. */}
      <WorkoutSessionStripRoot />
    </NavigationContainer>
  );
};
