import { TourGuideZone } from '@/components/tour/TourProvider';
import { Image as ExpoImage } from 'expo-image';
import { WarningCircle } from 'phosphor-react-native';
import { useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { FAB } from 'react-native-paper';

import { Container, DetailBottomSheet, EmptyStateCard, FilterChipBar, type FilterChip, HorizontalRecipeRow, ListSkeleton, RecipeCard, ResponsiveGrid, SafeAreaWrapper, SearchBar, SearchSuggestions, Text, type SuggestionItem } from '@/components';
import { ScreenLayout } from '@/components/layout';
import { RECIPES_TOUR_STEP } from '@/config/tourSteps';
import useCurrentUser from '@/hooks/useCurrentUser';
import { Clock, FireSimple, Heart, Leaf, Target } from 'phosphor-react-native';
import { useRecipesByTag, useRecommendedRecipes, useRemoveRecipe, useSavedRecipes, useSaveRecipe } from '@/services';
import { RecipeSearchResult, searchRecipes } from '@/services/searchApi';
import type { SavedRecipe } from '@/types';
import { BRAND_COLORS, getTheme, spacing, useContentBottomPadding, useFABBottomPosition, useSidebarVisible } from '@/utils';

// Recipe search suggestions with fun icons
const RECIPE_SUGGESTIONS: SuggestionItem[] = [
  { id: 'salad', label: 'Salad', icon: 'food-apple', color: '#10B981' },
  { id: 'chicken', label: 'Chicken', icon: 'food-drumstick', color: '#F59E0B' },
  { id: 'smoothie', label: 'Smoothie', icon: 'cup-water', color: '#EC4899' },
  { id: 'pasta', label: 'Pasta', icon: 'pasta', color: '#EF4444' },
  { id: 'breakfast', label: 'Breakfast', icon: 'egg-fried', color: '#F97316' },
  { id: 'soup', label: 'Soup', icon: 'bowl-mix', color: '#8B5CF6' },
  { id: 'fish', label: 'Fish', icon: 'fish', color: '#06B6D4' },
  { id: 'vegetarian', label: 'Vegetarian', icon: 'leaf', color: '#22C55E' },
];

const RECIPE_SUGGESTION_SEARCH_FALLBACKS: Record<string, string[]> = {
  salad: ['salad', 'vegetable', 'veggie'],
  chicken: ['chicken', 'grilled chicken', 'protein'],
  smoothie: ['smoothie', 'shake', 'drink'],
  pasta: ['pasta', 'noodle', 'spaghetti'],
  breakfast: ['breakfast', 'egg', 'oatmeal'],
  soup: ['soup', 'broth', 'stew'],
  fish: ['fish', 'salmon', 'seafood'],
  vegetarian: ['vegetarian', 'veggie', 'plant based'],
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
    top: 300,
    left: -100,
    backgroundColor: 'rgba(197, 242, 225, 0.34)',
  },
  mobileBackdropBandSky: {
    width: 240,
    height: 240,
    bottom: 110,
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

export const RecipesScreen = () => {
  // Always use light mode
  const theme = getTheme('light');
  const reduceMotion = useReducedMotion();
  const route = useRoute<any>();
  const currentUser = useCurrentUser();
  const userId = currentUser.data?.userId;
  const userGoal = currentUser.data?.profile?.fitnessGoal;
  const showSidebar = useSidebarVisible();

  const hasAnimated = useRef(false);
  const staggerEnter = useCallback((index: number) => {
    if (reduceMotion || hasAnimated.current) return undefined;
    return FadeInDown.duration(300).delay(index * 80);
  }, [reduceMotion]);
  useEffect(() => { hasAnimated.current = true; }, []);

  const saved = useSavedRecipes(userId);
  // Use dedicated recipe recommendations API
  const recommended = useRecommendedRecipes(userGoal, userId);

  // Uber-Eats-style themed discovery rows.
  const quickRow = useRecipesByTag('quick easy', 10);
  const proteinRow = useRecipesByTag('high protein', 10);
  const trendingRow = useRecipesByTag('healthy', 10);

  // Filter chips (F2). Multi-select chips that filter recipes shown in rows.
  const RECIPE_FILTER_CHIPS: FilterChip[] = useMemo(() => [
    { id: 'quick', label: '≤20 min', emoji: '⏱️' },
    { id: 'lowcal', label: '≤500 cal', emoji: '🔥' },
    { id: 'highprotein', label: 'High protein', emoji: '💪' },
    { id: 'vegan', label: 'Vegan', emoji: '🌱' },
    { id: 'budget', label: 'Budget', emoji: '💰' },
    { id: 'saved', label: 'Saved', emoji: '⭐' },
  ], []);
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
  const toggleFilter = useCallback((id: string) => {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearFilters = useCallback(() => setSelectedFilters(new Set()), []);

  // F4 — Bottom-sheet detail
  const [detailRecipe, setDetailRecipe] = useState<any | null>(null);
  const openDetail = useCallback((r: any) => setDetailRecipe(r), []);
  const closeDetail = useCallback(() => setDetailRecipe(null), []);

  // Warm the disk cache for the first batch of recipe thumbnails.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const urls = (recommended.data ?? [])
      .slice(0, 6)
      .map((r: any) => r?.image?.thumb || r?.image?.medium || r?.imageUrl)
      .filter((u: unknown): u is string => typeof u === 'string' && !!u);
    if (urls.length > 0) {
      ExpoImage.prefetch(urls, 'memory-disk').catch(() => {});
    }
  }, [recommended.data]);
  const saveRecipe = useSaveRecipe(userId);
  const removeRecipe = useRemoveRecipe(userId);
  const listRef = useRef<FlatList<SavedRecipe>>(null);
  const [showFab, setShowFab] = useState(false);
  const savedRecipes = saved.data ?? [];
  const savedRecipeIds = useMemo(() => new Set(savedRecipes.map((item) => item.id)), [savedRecipes]);
  const recommendedRecipes = recommended.data ?? [];

  const applyFilters = useCallback((items: any[]): any[] => {
    if (selectedFilters.size === 0) return items;
    return items.filter((r) => {
      if (selectedFilters.has('quick') && (r.timeMinutes ?? 999) > 20) return false;
      if (selectedFilters.has('lowcal') && (r.calories ?? 9999) > 500) return false;
      if (selectedFilters.has('highprotein') && (r.protein ?? 0) < 25) return false;
      if (selectedFilters.has('vegan')) {
        const tags: string[] = r.tags ?? r.dietTags ?? [];
        const hit = tags.some((t) => /vegan|plant/i.test(String(t)));
        if (!hit) return false;
      }
      if (selectedFilters.has('budget') && (r.estimatedCost ?? 99) > 5) return false;
      if (selectedFilters.has('saved') && !savedRecipeIds.has(r.id)) return false;
      return true;
    });
  }, [selectedFilters, savedRecipeIds]);
  const recipeFocus = userGoal === 'GAIN_MUSCLE'
    ? 'Keep meal ideas protein-forward so your training days are easier to support.'
    : userGoal === 'LOSE_WEIGHT'
      ? 'Lean toward lighter, repeatable meals that keep calories under control.'
      : 'Use the library to keep meals balanced, simple, and easy to repeat.';

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RecipeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [hasActiveSearch, setHasActiveSearch] = useState(false); // Track if user has initiated a search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mobileBottomPadding = useContentBottomPadding(spacing.lg);
  const listBottomPadding = showSidebar ? spacing['2xl'] : mobileBottomPadding;
  const fabBottomPosition = useFABBottomPosition(spacing.md);

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

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchRecipes(query, 20);
        setSearchResults(results);
      } catch (error) {
        console.error('[RecipesScreen] Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  // Handle initial search from navigation params (e.g. from Dashboard macro icons)
  useEffect(() => {
    const initialQuery = route.params?.initialSearchQuery;
    if (initialQuery) {
      handleSearch(initialQuery);
      setHasActiveSearch(true);
      // Optional: scroll to top if not already there
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [route.params?.initialSearchQuery, handleSearch]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    setHasActiveSearch(false);
  }, []);

  const handleSuggestionSelect = useCallback(async (suggestion: SuggestionItem) => {
    // Clear any pending debounce
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    clearBlurTimeout();

    // Set query and mark active search BEFORE async call to prevent UI from hiding
    setIsSearchFocused(true);
    setSearchQuery(suggestion.label);
    setHasActiveSearch(true);
    setIsSearching(true);

    const queries = RECIPE_SUGGESTION_SEARCH_FALLBACKS[suggestion.id] ?? [suggestion.label];
    let resolvedResults: RecipeSearchResult[] = [];

    for (const query of queries) {
      try {
        const results = await searchRecipes(query, 20);
        if (results.length > 0) {
          resolvedResults = results;
          break;
        }
      } catch (error) {
        console.error('[RecipesScreen] Suggestion search failed:', error);
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
    ({ item }: { item: SavedRecipe }) => {
      const time = item.timeMinutes ?? 0;
      const calories = item.calories ?? 0;
      const meta = time + ' min · ' + calories + ' cal';

      return (
        <View style={styles.card}>
          <RecipeCard
            item={item}
            isSaved
            onRemove={(id) => removeRecipe.mutateAsync(id).then(() => true)}
          />
          <Text variant="caption" style={[styles.savedAt, { color: theme.colors.textSecondary }]}>
            {meta}
          </Text>
        </View>
      );
    },
    [removeRecipe, theme],
  );

  // Loading state
  if (currentUser.isLoading || saved.isLoading) {
    return (
      <SafeAreaWrapper>
        <Container>
          <View style={styles.header}>
            <Text variant="heading1" weight="bold" style={{ color: BRAND_COLORS.textPrimary }}>
              Recipes
            </Text>
            <Text variant="body" style={styles.subtitle}>
              Recommended meals and your saved list.
            </Text>
          </View>
          <ListSkeleton rows={6} showAvatar primaryWidth="55%" secondaryWidth="32%" />
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
            title="Unable to load recipes"
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

  const recipes = savedRecipes;
  const isRefreshing = saved.isRefetching;
  const isSearchMode = searchQuery.trim().length > 0;
  // Show search UI when focused, has query text, or has an active search in progress
  const showSearchUI = isSearchFocused || isSearchMode || hasActiveSearch;

  const listHeaderComponent = (
    <View style={styles.header}>
      {/* Search Bar - Tour Zone 5 */}
      <Animated.View entering={staggerEnter(0)}>
        <TourGuideZone
          zone={RECIPES_TOUR_STEP.zone}
          text={RECIPES_TOUR_STEP.text}
          title={RECIPES_TOUR_STEP.title}
          shape="rectangle"
          borderRadius={12}
        >
          <View style={styles.searchContainer}>
            <SearchBar
              placeholder="Search recipes..."
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
            suggestions={RECIPE_SUGGESTIONS}
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
              No recipes found for "{searchQuery}"
            </Text>
          ) : (
            <ResponsiveGrid columns={{ mobile: 1, tablet: 2, desktop: 3, wide: 4 }} gap={spacing.md}>
              {searchResults.map((item) => (
                <RecipeCard
                  key={item.id}
                  item={{
                    id: item.id,
                    title: item.title,
                    imageUrl: item.imageUrl ?? undefined,
                    timeMinutes: item.timeMinutes,
                    difficulty: (item.difficulty as 'easy' | 'medium' | 'hard') || 'easy',
                    calories: item.calories ?? undefined,
                  }}
                  disableHoverEffect
                  isSaved={savedRecipeIds.has(item.id)}
                  onSave={(id) => saveRecipe.mutateAsync(id).then(() => true)}
                  onRemove={(id) => removeRecipe.mutateAsync(id).then(() => true)}
                />
              ))}
            </ResponsiveGrid>
          )}
        </View>
      )}

      {/* Discovery Rows - Uber Eats inspired (hidden when searching) */}
      {!showSearchUI && (
        <Animated.View entering={staggerEnter(1)}>
          {/* F2 — Smart Filter Chips */}
          <FilterChipBar
            chips={RECIPE_FILTER_CHIPS}
            selectedIds={selectedFilters}
            onToggle={toggleFilter}
            onClear={clearFilters}
          />

          <HorizontalRecipeRow
            title="Recommended for you"
            subtitle={recipeFocus}
            icon={<Target size={16} color={BRAND_COLORS.primary} weight="fill" />}
            recipes={applyFilters(recommendedRecipes)}
            isLoading={recommended.isLoading}
            isError={recommended.isError}
            savedRecipeIds={savedRecipeIds}
            onSave={(id) => saveRecipe.mutateAsync(id).then(() => true)}
            onRemove={(id) => removeRecipe.mutateAsync(id).then(() => true)}
            onOpenDetail={openDetail}
            accentColor={BRAND_COLORS.primary}
          />

          <HorizontalRecipeRow
            title="Quick & easy"
            subtitle="20 minutes or less"
            icon={<Clock size={16} color="#0EA5E9" weight="fill" />}
            recipes={applyFilters(quickRow.data ?? [])}
            isLoading={quickRow.isLoading}
            isError={quickRow.isError}
            savedRecipeIds={savedRecipeIds}
            onSave={(id) => saveRecipe.mutateAsync(id).then(() => true)}
            onRemove={(id) => removeRecipe.mutateAsync(id).then(() => true)}
            onOpenDetail={openDetail}
            accentColor="#0EA5E9"
          />

          <HorizontalRecipeRow
            title="High protein"
            subtitle="Power up your training days"
            icon={<FireSimple size={16} color="#EF4444" weight="fill" />}
            recipes={applyFilters(proteinRow.data ?? [])}
            isLoading={proteinRow.isLoading}
            isError={proteinRow.isError}
            savedRecipeIds={savedRecipeIds}
            onSave={(id) => saveRecipe.mutateAsync(id).then(() => true)}
            onRemove={(id) => removeRecipe.mutateAsync(id).then(() => true)}
            onOpenDetail={openDetail}
            accentColor="#EF4444"
          />

          <HorizontalRecipeRow
            title="Trending healthy"
            subtitle="Loved by the community"
            icon={<Heart size={16} color="#EC4899" weight="fill" />}
            recipes={applyFilters(trendingRow.data ?? [])}
            isLoading={trendingRow.isLoading}
            isError={trendingRow.isError}
            savedRecipeIds={savedRecipeIds}
            onSave={(id) => saveRecipe.mutateAsync(id).then(() => true)}
            onRemove={(id) => removeRecipe.mutateAsync(id).then(() => true)}
            onOpenDetail={openDetail}
            accentColor="#EC4899"
          />

          <HorizontalRecipeRow
            title="Plant-forward"
            subtitle="Veggie-led ideas worth saving"
            icon={<Leaf size={16} color="#10B981" weight="fill" />}
            recipes={applyFilters((quickRow.data ?? []).filter((r: any) => r?.tags?.some?.((t: string) => /veg|plant|salad/i.test(t))).slice(0, 10))}
            isLoading={quickRow.isLoading}
            isError={quickRow.isError}
            savedRecipeIds={savedRecipeIds}
            onSave={(id) => saveRecipe.mutateAsync(id).then(() => true)}
            onRemove={(id) => removeRecipe.mutateAsync(id).then(() => true)}
            onOpenDetail={openDetail}
            accentColor="#10B981"
          />
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
              data={[]} // Saved recipes moved to SavedRecipesScreen
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
              color="#FFFFFF"
              mode="elevated"
              onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
              visible={showFab}
            />
          )}
        </ScreenLayout>

        {/* F4 — Recipe detail bottom sheet */}
        <DetailBottomSheet
          visible={!!detailRecipe}
          onClose={closeDetail}
          title={detailRecipe?.title || 'Recipe'}
        >
          {detailRecipe ? (
            <View style={{ gap: spacing.md }}>
              {detailRecipe.imageUrl ? (
                <View
                  style={{
                    width: '100%',
                    height: 200,
                    borderRadius: 16,
                    overflow: 'hidden',
                    backgroundColor: 'rgba(17,17,17,0.06)',
                  }}
                />
              ) : null}
              <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
                {detailRecipe.timeMinutes ? (
                  <View style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(17,17,17,0.06)', borderRadius: 999 }}>
                    <Text variant="caption" weight="semibold">⏱ {detailRecipe.timeMinutes} min</Text>
                  </View>
                ) : null}
                {detailRecipe.calories ? (
                  <View style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(17,17,17,0.06)', borderRadius: 999 }}>
                    <Text variant="caption" weight="semibold">🔥 {detailRecipe.calories} cal</Text>
                  </View>
                ) : null}
                {detailRecipe.protein ? (
                  <View style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(17,17,17,0.06)', borderRadius: 999 }}>
                    <Text variant="caption" weight="semibold">💪 {detailRecipe.protein}g protein</Text>
                  </View>
                ) : null}
                {detailRecipe.difficulty ? (
                  <View style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(17,17,17,0.06)', borderRadius: 999 }}>
                    <Text variant="caption" weight="semibold">{String(detailRecipe.difficulty).toUpperCase()}</Text>
                  </View>
                ) : null}
              </View>
              {detailRecipe.description ? (
                <Text variant="body" style={{ color: theme.colors.textSecondary, lineHeight: 22 }}>
                  {detailRecipe.description}
                </Text>
              ) : (
                <Text variant="caption" style={{ color: theme.colors.textSecondary }}>
                  Tap “See full recipe” to view the complete ingredient list and steps.
                </Text>
              )}
            </View>
          ) : null}
        </DetailBottomSheet>
      </View>
    </SafeAreaWrapper>
  );
};
