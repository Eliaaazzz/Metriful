import { TourGuideZone } from '@/components/tour/TourProvider';
import { Image as ExpoImage } from 'expo-image';
import { Barbell, WarningCircle } from 'phosphor-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { FAB } from 'react-native-paper';

import { Container, EmptyStateCard, ListSkeleton, ResponsiveGrid, SafeAreaWrapper, SearchBar, SearchSuggestions, StrengthLogModal, Text, WorkoutCard, type SuggestionItem } from '@/components';
import { ScreenLayout } from '@/components/layout';
import { WORKOUTS_TOUR_STEP } from '@/config/tourSteps';
import useCurrentUser from '@/hooks/useCurrentUser';
import { useRecommendedWorkouts, useRemoveWorkout, useSavedWorkouts, useSaveWorkout } from '@/services';
import { searchWorkouts, WorkoutSearchResult } from '@/services/searchApi';
import type { SavedWorkout } from '@/types';
import { BRAND_COLORS, getTheme, spacing, useContentBottomPadding, useFABBottomPosition, useSidebarVisible } from '@/utils';

// Workout search suggestions with fun icons
const WORKOUT_SUGGESTIONS: SuggestionItem[] = [
  { id: 'hiit', label: 'HIIT', icon: 'fire', color: '#EF4444' },
  { id: 'yoga', label: 'Yoga', icon: 'yoga', color: '#8B5CF6' },
  { id: 'strength', label: 'Strength', icon: 'dumbbell', color: '#F59E0B' },
  { id: 'cardio', label: 'Cardio', icon: 'run-fast', color: '#EC4899' },
  { id: 'abs', label: 'Abs', icon: 'human', color: '#06B6D4' },
  { id: 'stretch', label: 'Stretching', icon: 'human-handsup', color: '#10B981' },
  { id: 'legs', label: 'Legs', icon: 'walk', color: '#F97316' },
  { id: 'arms', label: 'Arms', icon: 'arm-flex', color: '#3B82F6' },
];

const SUGGESTION_SEARCH_FALLBACKS: Record<string, string[]> = {
  hiit: ['hiit', 'cardio', 'full body'],
  yoga: ['yoga', 'stretching', 'mobility'],
  strength: ['strength', 'arms', 'legs', 'core'],
  cardio: ['cardio', 'hiit', 'full body'],
  abs: ['core', 'abs'],
  stretch: ['stretching', 'yoga', 'mobility'],
  legs: ['legs', 'glutes', 'lower body'],
  arms: ['arms', 'shoulders', 'upper body'],
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
    width: 220,
    height: 220,
    top: -80,
    right: -70,
    backgroundColor: 'rgba(255, 211, 182, 0.4)',
  },
  mobileBackdropBandMint: {
    width: 210,
    height: 210,
    top: 280,
    left: -100,
    backgroundColor: 'rgba(197, 242, 225, 0.34)',
  },
  mobileBackdropBandSky: {
    width: 240,
    height: 240,
    bottom: 120,
    right: -120,
    backgroundColor: 'rgba(208, 231, 255, 0.28)',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: spacing.md,
    paddingBottom: 0,
  },
  card: {
    gap: spacing.sm,
  },
  listContent: {
    gap: spacing.md,
  },
  header: {
    gap: spacing.md,
    marginBottom: 0,
  },
  subtitle: {
    color: '#6B665F',
    marginTop: 2,
  },
  searchContainer: {
    marginTop: 0,
  },
  suggestionsSection: {
    marginTop: spacing.xs,
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: '#111111',
    letterSpacing: -0.5,
  },
  recommendedList: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  recommendedCard: {
    width: 276,
  },
  recommendedNote: {
    opacity: 0.7,
  },
  searchResults: {
    gap: spacing.md,
  },
  searchResultCard: {
    marginBottom: spacing.sm,
  },
  noResultsText: {
    opacity: 0.6,
  },
  savedHeader: {
    marginTop: spacing.lg,
  },
  // Error state card styling
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    paddingVertical: spacing['3xl'],
    gap: spacing.md,
  },
  errorTitle: {
    textAlign: 'center',
  },
  errorBody: {
    textAlign: 'center',
    opacity: 0.7,
  },
  savedAt: {
    opacity: 0.68,
    marginTop: spacing.xs,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
  },
});

// Moved outside component to prevent recreation on every render
const ItemSeparator = () => <View style={{ height: spacing.md }} />;

export const WorkoutsScreen = () => {
  // Always use light mode
  const theme = getTheme('light');
  const reduceMotion = useReducedMotion();
  const currentUser = useCurrentUser();
  const userId = currentUser.data?.userId;
  const showSidebar = useSidebarVisible();

  const hasAnimated = useRef(false);
  const staggerEnter = useCallback((index: number) => {
    if (reduceMotion || hasAnimated.current) return undefined;
    return FadeInDown.duration(300).delay(index * 80);
  }, [reduceMotion]);
  useEffect(() => { hasAnimated.current = true; }, []);
  const saved = useSavedWorkouts(userId);
  const recommended = useRecommendedWorkouts(currentUser.data?.profile?.fitnessGoal, userId);

  // F12 — Strength log modal
  const [strengthModalOpen, setStrengthModalOpen] = useState(false);

  // Warm the disk cache for the first batch of thumbnails so scrolling feels instant.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const urls = (recommended.data ?? [])
      .slice(0, 6)
      .map((w) => w.thumbnailUrl?.replace(/\/(maxres|sd|hq)default\.jpg/i, '/mqdefault.jpg'))
      .filter((u): u is string => !!u);
    if (urls.length > 0) {
      ExpoImage.prefetch(urls, 'memory-disk').catch(() => {});
    }
  }, [recommended.data]);
  const saveWorkout = useSaveWorkout(userId);
  const removeWorkout = useRemoveWorkout(userId);
  const listRef = useRef<FlatList<SavedWorkout>>(null);
  const [showFab, setShowFab] = useState(false);
  const savedWorkouts = saved.data ?? [];
  const savedWorkoutIds = useMemo(() => new Set(savedWorkouts.map((item) => item.id)), [savedWorkouts]);
  const recommendedItems = recommended.data ?? [];
  const workoutFocus = currentUser.data?.profile?.fitnessGoal === 'GAIN_MUSCLE'
    ? 'Lean into strength sessions and save the lifts you want to repeat.'
    : currentUser.data?.profile?.fitnessGoal === 'LOSE_WEIGHT'
      ? 'Bias toward shorter, higher-output sessions you can repeat consistently.'
      : 'Keep your week balanced with movement you can actually sustain.';

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WorkoutSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBlurTimeout = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  }, []);

  const handleSearchFocusChange = useCallback((focused: boolean) => {
    clearBlurTimeout();

    if (focused) {
      setIsSearchFocused(true);
      return;
    }

    blurTimeoutRef.current = setTimeout(() => {
      setIsSearchFocused(false);
      blurTimeoutRef.current = null;
    }, 120);
  }, [clearBlurTimeout]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchWorkouts(query, 20);
        setSearchResults(results);
      } catch (error) {
        console.error('[WorkoutsScreen] Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  }, []);

  const handleSuggestionSelect = useCallback(async (suggestion: SuggestionItem) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    clearBlurTimeout();

    setIsSearchFocused(true);
    setSearchQuery(suggestion.label);
    setIsSearching(true);

    const queries = SUGGESTION_SEARCH_FALLBACKS[suggestion.id] ?? [suggestion.label];
    let resolvedResults: WorkoutSearchResult[] = [];

    for (const query of queries) {
      try {
        const results = await searchWorkouts(query, 20);
        if (results.length > 0) {
          resolvedResults = results;
          break;
        }
      } catch (error) {
        console.error('[WorkoutsScreen] Suggestion search failed:', error);
      }
    }

    setSearchResults(resolvedResults);
    setIsSearching(false);
  }, [clearBlurTimeout]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Calculate bottom padding using shared utility (reduced on desktop with sidebar)
  const mobileBottomPadding = useContentBottomPadding(spacing.lg);
  const listBottomPadding = showSidebar ? spacing['2xl'] : mobileBottomPadding;
  const fabBottomPosition = useFABBottomPosition(spacing.md);

  // Memoize empty component BEFORE any conditional returns
  const listEmptyComponent = useMemo(() => (
    <EmptyStateCard
      icon={<Barbell size={32} color={BRAND_COLORS.secondary} />}
      title="Your saved workouts will appear here"
      variant="single"
    />
  ), []);

  const handleRefresh = useCallback(() => {
    if (!saved.isLoading) {
      saved.refetch();
    }
  }, [saved]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const shouldShow = offsetY > 240;
    setShowFab(currentValue => {
      if (currentValue !== shouldShow) {
        return shouldShow;
      }
      return currentValue;
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: SavedWorkout }) => {
      const duration = item.durationMinutes ?? 0;
      const levelText = item.level?.toUpperCase?.() ?? '—';
      const meta = duration + ' min · level ' + levelText;

      return (
        <View style={styles.card}>
          <WorkoutCard
            item={item}
            isSaved
            onRemove={(id) => removeWorkout.mutateAsync(id).then(() => true)}
          />
          <Text variant="caption" style={[styles.savedAt, { color: theme.colors.textSecondary }]}>
            {meta}
          </Text>
        </View>
      );
    },
    [removeWorkout, theme],
  );

  // Loading state
  if (currentUser.isLoading || saved.isLoading) {
    return (
      <SafeAreaWrapper>
        <Container>
          <View style={styles.header}>
            <Text variant="heading1" weight="bold" style={{ color: BRAND_COLORS.textPrimary }}>
              Workouts
            </Text>
            <Text variant="body" style={styles.subtitle}>
              Find focused routines, then save the ones you want to repeat.
            </Text>
          </View>
          <ListSkeleton rows={4} showAvatar primaryWidth="55%" secondaryWidth="32%" />
        </Container>
      </SafeAreaWrapper>
    );
  }

  // Error state
  if (currentUser.isError || saved.isError) {
    return (
      <SafeAreaWrapper>
        <Container>
          <EmptyStateCard
            icon={<WarningCircle size={32} color={theme.colors.error} />}
            title="Unable to load workouts"
            subtitle="Check your network connection and try again."
            ctaLabel="Retry"
            onCtaPress={() => {
              currentUser.refetch();
              saved.refetch();
            }}
          />
        </Container>
      </SafeAreaWrapper>
    );
  }

  const workouts = savedWorkouts;
  const isRefreshing = saved.isRefetching;
  const isSearchMode = searchQuery.trim().length > 0;
  // Show search UI when focused or has query text
  const showSearchUI = isSearchFocused || isSearchMode;

  const listHeaderComponent = (
    <View style={styles.header}>
      {/* Search Bar - Tour Zone 4 */}
      <Animated.View entering={staggerEnter(0)}>
        <TourGuideZone
          zone={WORKOUTS_TOUR_STEP.zone}
          text={WORKOUTS_TOUR_STEP.text}
          title={WORKOUTS_TOUR_STEP.title}
          shape="rectangle"
          borderRadius={12}
        >
          <View style={styles.searchContainer}>
            <SearchBar
              placeholder="Search by focus, duration, or equipment"
              value={searchQuery}
              onChangeText={handleSearch}
              onClear={clearSearch}
              onFocusChange={handleSearchFocusChange}
              isLoading={isSearching}
            />
          </View>
        </TourGuideZone>
      </Animated.View>

      {/* Search Suggestions - only when focused and query is empty */}
      {isSearchFocused && !isSearchMode && (
        <View style={styles.suggestionsSection}>
          <SearchSuggestions
            suggestions={WORKOUT_SUGGESTIONS}
            onSelect={handleSuggestionSelect}
            title="Popular searches"
          />
        </View>
      )}

      {/* Search Results - only when has query text */}
      {isSearchMode && (
        <View style={styles.section}>
          <Text variant="heading2" weight="semibold" style={{ color: BRAND_COLORS.textPrimary }}>
            Search Results
          </Text>
          {isSearching ? (
            <Text variant="caption" style={[styles.recommendedNote, { color: theme.colors.textSecondary }]}>
              Searching...
            </Text>
          ) : searchResults.length === 0 ? (
            <Text variant="caption" style={[styles.noResultsText, { color: theme.colors.textSecondary }]}>
              No workouts found for "{searchQuery}"
            </Text>
          ) : (
            <ResponsiveGrid columns={{ mobile: 1, tablet: 2, desktop: 3, wide: 4 }} gap={spacing.md}>
              {searchResults.map((item) => (
                <WorkoutCard
                  key={item.id}
                  item={{
                    id: item.id,
                    title: item.exerciseName,
                    thumbnailUrl: item.thumbnailUrl ?? undefined,
                    youtubeId: item.youtubeId,
                    durationMinutes: 5,
                    level: 'intermediate',
                    equipment: [],
                    bodyPart: [item.primaryCategory],
                  }}
                  disableHoverEffect
                  isSaved={savedWorkoutIds.has(item.id)}
                  onSave={(id) => saveWorkout.mutateAsync(id).then(() => true)}
                  onRemove={(id) => removeWorkout.mutateAsync(id).then(() => true)}
                />
              ))}
            </ResponsiveGrid>
          )}
        </View>
      )}

      {/* Recommended Section - hidden when search UI is active */}
      {!showSearchUI && (
        <Animated.View entering={staggerEnter(1)} style={styles.section}>
          <Text variant="heading2" weight="semibold" style={styles.sectionTitle}>
            Recommended for you
          </Text>
          {recommended.isLoading ? (
            <Text variant="caption" style={[styles.recommendedNote, { color: theme.colors.textSecondary }]}>
              Loading recommendations...
            </Text>
          ) : recommended.isError ? (
            <Text variant="caption" style={[styles.recommendedNote, { color: theme.colors.textSecondary }]}>
              Unable to load recommendations.
            </Text>
          ) : recommendedItems.length === 0 ? (
            <Text variant="caption" style={[styles.recommendedNote, { color: theme.colors.textSecondary }]}>
              No recommendations yet.
            </Text>
          ) : (
            <ResponsiveGrid columns={{ mobile: 1, tablet: 2, desktop: 3, wide: 4 }} gap={spacing.md}>
              {recommendedItems.map((item) => (
                <WorkoutCard
                  key={item.id}
                  item={item}
                  isSaved={savedWorkoutIds.has(item.id)}
                  onSave={(id) => saveWorkout.mutateAsync(id).then(() => true)}
                  onRemove={(id) => removeWorkout.mutateAsync(id).then(() => true)}
                />
              ))}
            </ResponsiveGrid>
          )}
        </Animated.View>
      )}
    </View>
  );

  return (
    <SafeAreaWrapper>
      <View style={styles.screenRoot}>
        {Platform.OS !== 'web' && (
          <View pointerEvents="none" style={styles.mobileBackdropLayer}>
            <View style={[styles.mobileBackdropBand, styles.mobileBackdropBandWarm]} />
            <View style={[styles.mobileBackdropBand, styles.mobileBackdropBandMint]} />
            <View style={[styles.mobileBackdropBand, styles.mobileBackdropBandSky]} />
          </View>
        )}
        <ScreenLayout scrollable={false}>
          <Container style={styles.container}>
            <FlatList
              ref={listRef}
              data={[]} // Saved workouts moved to SavedWorkoutsScreen
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
              ItemSeparatorComponent={ItemSeparator}
              ListHeaderComponent={listHeaderComponent}
              ListEmptyComponent={null}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={theme.colors.primary}
                />
              }
              onScroll={handleScroll}
              scrollEventThrottle={16}
            />
          </Container>
          {!showSidebar && (
            <FAB
              icon="arrow-up"
              style={[styles.fab, { bottom: fabBottomPosition, backgroundColor: '#111111' }]}
              color="#FFF"
              mode="elevated"
              onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
              visible={showFab}
            />
          )}
          {!showSidebar && (
            <FAB
              icon="dumbbell"
              label="Log strength"
              style={[styles.fab, { bottom: fabBottomPosition + 64, right: 16, backgroundColor: '#F97316' }]}
              color="#FFF"
              mode="elevated"
              onPress={() => setStrengthModalOpen(true)}
            />
          )}
        </ScreenLayout>

        {/* F12 — Strength session log */}
        <StrengthLogModal
          visible={strengthModalOpen}
          onClose={() => setStrengthModalOpen(false)}
        />
      </View>
    </SafeAreaWrapper>
  );
};
