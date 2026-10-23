import { Text } from '@/components';
import type { MealHistoryItem } from '@/types/mealHistory';
import { colors, radii, spacing } from '@/utils';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { ArrowsClockwise, ForkKnife } from 'phosphor-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

interface LogAgainCardProps {
  meals: MealHistoryItem[];
  isLoading?: boolean;
  onReLog: (meal: MealHistoryItem) => Promise<void> | void;
  inFlightMealId?: number | null;
}

/**
 * LogAgainCard — Uber Eats "Order again" inspired.
 * Surfaces meals from the last 7 days, one-tap re-log at today's timestamp.
 * Pattern source: Uber Eats home "Reorder" row.
 */
export const LogAgainCard: React.FC<LogAgainCardProps> = ({
  meals,
  isLoading,
  onReLog,
  inFlightMealId,
}) => {
  if (!isLoading && meals.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.iconBubble}>
            <ArrowsClockwise size={16} color={colors.light.primary} weight="bold" />
          </View>
          <View>
            <Text variant="body" weight="bold" style={styles.title}>Log again</Text>
            <Text variant="caption" style={styles.subtitle}>
              Meals you ate this week — one tap to re-log
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.light.primary} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {meals.map((meal) => {
            const isLogging = inFlightMealId === meal.id;
            const label =
              meal.foodItems?.[0]?.displayName ||
              meal.notes ||
              (meal.mealType ? meal.mealType.charAt(0) + meal.mealType.slice(1).toLowerCase() : 'Meal');
            return (
              <Pressable
                key={meal.id}
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  await onReLog(meal);
                }}
                style={({ pressed }) => [
                  styles.mealCard,
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
                disabled={isLogging}
              >
                {meal.imageUrl ? (
                  <ExpoImage
                    source={{ uri: meal.imageUrl }}
                    style={styles.mealImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={150}
                  />
                ) : (
                  <View style={[styles.mealImage, styles.mealImagePlaceholder]}>
                    <ForkKnife size={20} color={colors.light.textSecondary} />
                  </View>
                )}
                <View style={styles.mealInfo}>
                  <Text
                    variant="caption"
                    weight="semibold"
                    numberOfLines={1}
                    style={styles.mealTitle}
                  >
                    {label}
                  </Text>
                  <Text variant="caption" style={styles.mealCalories} numberOfLines={1}>
                    {Math.round(meal.totalCalories || 0)} cal · {Math.round(meal.totalProtein || 0)}g P
                  </Text>
                </View>
                <View style={styles.reLogChip}>
                  {isLogging ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text variant="caption" weight="bold" style={styles.reLogChipText}>
                      + Log
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F3F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.light.textPrimary },
  subtitle: { color: colors.light.textSecondary, opacity: 0.8 },
  loadingRow: { height: 100, alignItems: 'center', justifyContent: 'center' },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  mealCard: {
    width: 220,
    backgroundColor: '#F6F6F6',
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  mealImage: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(17,17,17,0.06)',
  },
  mealImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealInfo: {
    flex: 1,
    minWidth: 0,
  },
  mealTitle: {
    color: colors.light.textPrimary,
  },
  mealCalories: {
    color: colors.light.textSecondary,
    fontSize: 11,
  },
  reLogChip: {
    backgroundColor: colors.light.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 50,
    alignItems: 'center',
  },
  reLogChipText: { color: '#FFFFFF', fontSize: 11 },
});

export default LogAgainCard;
