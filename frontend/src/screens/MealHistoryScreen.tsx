/**
 * Meal History Screen — the visual Diary.
 *
 * SnapCalorie-style photo timeline of everything logged, upgraded with:
 * meal-type + favorites filter chips, food-name search, day grouping with daily
 * totals, one-tap favorite (star), and one-tap repeat (Uber Eats "order again").
 */

import { ArrowLeft, ArrowsClockwise, CaretRight, Coffee, Cookie, Fire, ForkKnife, Heart, Orange, WarningCircle } from 'phosphor-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { Card, SafeAreaWrapper, Text } from '@/components';
import { MealImage } from '@/components/nutrition/MealImage';
import { useMealHistory, useReLogMeal } from '@/hooks/useMealHistory';
import { useMealFavoritesStore } from '@/stores/useMealFavoritesStore';
import type { MealHistoryItem } from '@/types/mealHistory';
import { BRAND_COLORS, spacing } from '@/utils';

type DiaryFilter = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'favorites';

const FILTERS: Array<{ id: DiaryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
  { id: 'favorites', label: '♥ Favorites' },
];

type DiaryRow =
  | { kind: 'header'; key: string; label: string; totalKcal: number }
  | { kind: 'meal'; key: string; meal: MealHistoryItem };

const dayLabel = (isoString: string): string => {
  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// Simple date formatting helper (avoiding date-fns dependency)
const formatDate = (isoString: string) => {
  const date = new Date(isoString);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
};

const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const MealHistoryScreen = () => {
  const navigation = useNavigation();
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<DiaryFilter>('all');
  const [search, setSearch] = useState('');
  const pageSize = 20;

  const { data, isLoading, error, refetch, isFetching } = useMealHistory({
    page,
    size: pageSize,
    sort: 'consumedAt,desc', // Most recent first
  });
  const reLog = useReLogMeal();
  const [reLogInFlightId, setReLogInFlightId] = useState<number | null>(null);
  const { isFavorite, toggleFavorite } = useMealFavoritesStore();

  const handleRepeat = useCallback(
    async (meal: MealHistoryItem) => {
      if (reLogInFlightId != null) return;
      setReLogInFlightId(meal.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      try {
        await reLog.mutateAsync(meal);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch {
        // Mutation error surfaces via query state; keep the diary calm.
      } finally {
        setReLogInFlightId(null);
      }
    },
    [reLog, reLogInFlightId]
  );

  // Client-side filter + search over the loaded pages, then group by day with daily totals.
  const rows = useMemo<DiaryRow[]>(() => {
    const meals = (data?.content || []).filter((meal) => {
      if (filter === 'favorites' && !isFavorite(meal.id)) return false;
      if (filter !== 'all' && filter !== 'favorites' && meal.mealType.toLowerCase() !== filter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = [meal.mealType, meal.notes ?? '', ...(meal.foodItems?.map((f) => f.displayName) ?? [])]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const out: DiaryRow[] = [];
    let currentDay = '';
    let headerIndex = -1;
    meals.forEach((meal) => {
      const label = dayLabel(meal.consumedAt);
      if (label !== currentDay) {
        currentDay = label;
        headerIndex = out.length;
        out.push({ kind: 'header', key: `header-${label}-${meal.id}`, label, totalKcal: 0 });
      }
      const header = out[headerIndex];
      if (header.kind === 'header') {
        header.totalKcal += meal.totalCalories || 0;
      }
      out.push({ kind: 'meal', key: `meal-${meal.id}`, meal });
    });
    return out;
  }, [data?.content, filter, search, isFavorite]);

  // Refetch data when screen comes into focus (for real-time sync after meal snap)
  // Note: We only reset to page 0 on initial focus, not during scrolling
  // The page dependency is intentionally excluded to prevent scroll bounce
  useFocusEffect(
    useCallback(() => {
      // Simply refetch current page data on focus - don't reset pagination
      // This prevents the scroll bounce bug where changing page triggers re-render
      refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refetch])
  );

  const handleLoadMore = () => {
    // Spring Page uses flat structure: data.totalPages, not data.page.totalPages
    if (data && page < data.totalPages - 1 && !isFetching) {
      setPage((prev) => prev + 1);
    }
  };

  const handleRefresh = () => {
    setPage(0);
    refetch();
  };

  const renderMealItem = ({ item }: { item: MealHistoryItem }) => {
    const dateStr = formatDate(item.consumedAt);
    const timeStr = formatTime(item.consumedAt);

    // Get meal type icon as Phosphor component - returns null for unrecognized types
    const getMealTypeIcon = (type: string, size: number, color: string): React.ReactNode => {
      switch (type.toLowerCase()) {
        case 'breakfast':
          return <Coffee size={size} color={color} />;
        case 'lunch':
          return <Orange size={size} color={color} />;
        case 'dinner':
          return <ForkKnife size={size} color={color} />;
        case 'snack':
          return <Cookie size={size} color={color} />;
        default:
          return null;
      }
    };

    // Check if meal type should be displayed
    const isKnownMealType = ['breakfast', 'lunch', 'dinner', 'snack'].includes(
      item.mealType.toLowerCase()
    );
    const mealIcon = getMealTypeIcon(item.mealType, 16, BRAND_COLORS.primary);

    const handleViewDetails = () => {
      (navigation as any).navigate('ReviewMeal', { meal: item });
    };

    const favorite = isFavorite(item.id);
    const repeating = reLogInFlightId === item.id;

    return (
      <Pressable onPress={handleViewDetails}>
        <Card style={styles.mealCard}>
          {/* Date & Time Header Row + quick actions */}
          <View style={styles.cardHeaderRow}>
            <Text variant="caption" style={styles.dateTimeText}>
              {dateStr} • {timeStr}
            </Text>
            <View style={styles.cardActions}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  toggleFavorite(item);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart
                  size={20}
                  color={favorite ? BRAND_COLORS.primary : BRAND_COLORS.textSecondary}
                  weight={favorite ? 'fill' : 'regular'}
                />
              </Pressable>
              <Pressable
                onPress={() => handleRepeat(item)}
                disabled={repeating}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Log this meal again now"
              >
                {repeating ? (
                  <ActivityIndicator size="small" color={BRAND_COLORS.primary} />
                ) : (
                  <ArrowsClockwise size={20} color={BRAND_COLORS.textSecondary} />
                )}
              </Pressable>
              <CaretRight size={20} color={BRAND_COLORS.textSecondary} />
            </View>
          </View>

          <View style={styles.mealCardRow}>
            {/* Image on the left */}
            <MealImage
              imageUrl={item.imageUrl}
              size={80}
              borderRadius={12}
              fallbackIcon="silverware-fork-knife"
              fallbackIconSize={36}
            />

            {/* Details on the right */}
            <View style={styles.mealDetailsContainer}>
              {/* Meal Type - only show for known types */}
              {isKnownMealType && (
                <View style={styles.mealTypeRow}>
                  {mealIcon}
                  <Text variant="body" weight="semibold" style={styles.mealType}>
                    {item.mealType.charAt(0).toUpperCase() + item.mealType.slice(1)}
                  </Text>
                </View>
              )}

              {/* Food Items */}
              <View style={styles.foodItemsContainer}>
                {item.foodItems?.slice(0, 2).map((food, index) => (
                  <View key={index} style={styles.foodItem}>
                    <Text variant="caption" style={styles.foodName} numberOfLines={1}>
                      {food.displayName}
                    </Text>
                  </View>
                ))}
                {item.foodItems && item.foodItems.length > 2 && (
                  <Text variant="caption" style={styles.moreFoods}>
                    +{item.foodItems.length - 2} more
                  </Text>
                )}
              </View>

              {/* Nutrition Summary */}
              <View style={styles.nutritionRow}>
                <View style={styles.nutritionItem}>
                  <Fire size={14} color="#EF4444" />
                  <Text variant="caption" weight="semibold" style={styles.nutritionValue}>
                    {item.totalCalories}
                  </Text>
                </View>

                <View style={styles.nutritionItem}>
                  <Text variant="caption" style={styles.nutritionValue}>
                    P: {Math.round(item.totalProtein || 0)}g
                  </Text>
                </View>

                <View style={styles.nutritionItem}>
                  <Text variant="caption" style={styles.nutritionValue}>
                    C: {Math.round(item.totalCarbs || 0)}g
                  </Text>
                </View>

                <View style={styles.nutritionItem}>
                  <Text variant="caption" style={styles.nutritionValue}>
                    F: {Math.round(item.totalFat || 0)}g
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Notes if present */}
          {item.notes && (
            <View style={styles.notesContainer}>
              <Text variant="caption" style={styles.notesText} numberOfLines={2}>
                {item.notes}
              </Text>
            </View>
          )}
        </Card>
      </Pressable>
    );
  };

  const renderRow = ({ item }: { item: DiaryRow }) => {
    if (item.kind === 'header') {
      return (
        <View style={styles.dayHeader}>
          <Text variant="heading4" weight="bold" style={styles.dayHeaderLabel}>
            {item.label}
          </Text>
          <Text variant="caption" style={styles.dayHeaderTotal}>
            {Math.round(item.totalKcal)} kcal
          </Text>
        </View>
      );
    }
    return renderMealItem({ item: item.meal });
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <ForkKnife size={64} color={BRAND_COLORS.textSecondary} />
      <Text variant="body" style={styles.emptyText}>
        {filter !== 'all' || search.trim() ? 'Nothing matches this view' : 'No meal history yet'}
      </Text>
      <Text variant="caption" style={styles.emptySubtext}>
        {filter === 'favorites'
          ? 'Tap the heart on any meal to keep it here'
          : filter !== 'all' || search.trim()
            ? 'Try a different filter or search'
            : 'Start logging your meals to see them here'}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!isFetching || page === 0) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={BRAND_COLORS.primary} />
      </View>
    );
  };

  if (error) {
    return (
      <SafeAreaWrapper>
        <View style={styles.errorContainer}>
          <WarningCircle size={48} color="#EF4444" />
          <Text variant="body" style={styles.errorText}>
            Failed to load meal history
          </Text>
          <Text variant="caption" style={styles.errorSubtext}>
            {error.message}
          </Text>
          <Pressable style={styles.retryButton} onPress={handleRefresh}>
            <Text variant="body" weight="semibold" style={styles.retryText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={24} color={BRAND_COLORS.textPrimary} />
            </Pressable>
            <View style={styles.headerTextContainer}>
              <Text variant="heading2" weight="bold">
                Diary
              </Text>
              {data && (
                <Text variant="caption" style={styles.totalCount}>
                  {data.totalElements} meals logged
                </Text>
              )}
            </View>
          </View>

          {/* Search over food names, meal types and notes */}
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search foods you’ve eaten…"
            placeholderTextColor={BRAND_COLORS.textMuted}
            style={styles.searchInput}
            accessibilityLabel="Search meal history"
            returnKeyType="search"
          />

          {/* Meal-type + favorites filter chips */}
          <View style={styles.filterRow}>
            {FILTERS.map(({ id, label }) => {
              const selected = filter === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setFilter(id)}
                  style={[styles.filterChip, selected && styles.filterChipSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter: ${label}`}
                >
                  <Text
                    variant="caption"
                    weight="semibold"
                    style={selected ? styles.filterChipTextSelected : styles.filterChipText}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Timeline list grouped by day */}
        <FlatList
          data={rows}
          renderItem={renderRow}
          keyExtractor={(item) => item.key}
          ListEmptyComponent={isLoading ? null : renderEmpty}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading && page === 0}
              onRefresh={handleRefresh}
              tintColor={BRAND_COLORS.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
        />
      </View>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_COLORS.background,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BRAND_COLORS.surfaceVariant,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
    borderRadius: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  totalCount: {
    color: BRAND_COLORS.textSecondary,
    marginTop: spacing.xs,
  },
  searchInput: {
    marginTop: spacing.md,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND_COLORS.border,
    backgroundColor: BRAND_COLORS.surfaceElevated,
    paddingHorizontal: spacing.md,
    color: BRAND_COLORS.textPrimary,
    fontSize: 15,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  filterChip: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.border,
  },
  filterChipSelected: {
    backgroundColor: BRAND_COLORS.primaryTint,
    borderColor: BRAND_COLORS.primary,
  },
  filterChipText: {
    color: BRAND_COLORS.textSecondary,
  },
  filterChipTextSelected: {
    color: BRAND_COLORS.primaryDark,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  dayHeaderLabel: {
    color: BRAND_COLORS.textPrimary,
  },
  dayHeaderTotal: {
    color: BRAND_COLORS.textMuted,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  listContent: {
    padding: spacing.md,
    flexGrow: 1,
  },
  mealCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dateTimeText: {
    color: BRAND_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  mealCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  mealDetailsContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  mealTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  mealType: {
    marginLeft: spacing.xs,
    color: BRAND_COLORS.textPrimary,
    fontSize: 14,
  },
  foodItemsContainer: {
    gap: 2,
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  foodName: {
    color: BRAND_COLORS.textPrimary,
    flex: 1,
  },
  moreFoods: {
    color: BRAND_COLORS.textSecondary,
    fontStyle: 'italic',
    fontSize: 11,
  },
  nutritionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  nutritionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  nutritionValue: {
    color: BRAND_COLORS.textSecondary,
  },
  nutritionLabel: {
    color: BRAND_COLORS.textSecondary,
  },
  notesContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: BRAND_COLORS.surface,
    borderRadius: 8,
  },
  notesText: {
    color: BRAND_COLORS.textSecondary,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    color: BRAND_COLORS.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    color: BRAND_COLORS.textSecondary,
    marginTop: spacing.xs,
  },
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    color: BRAND_COLORS.textPrimary,
    marginTop: spacing.md,
  },
  errorSubtext: {
    color: BRAND_COLORS.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: BRAND_COLORS.primary,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFF',
  },
});
