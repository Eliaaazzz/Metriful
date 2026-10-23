import { RecipeCard, Text } from '@/components';
import type { RecipeCard as Recipe } from '@/types';
import { colors, spacing } from '@/utils';
import { CaretRight } from 'phosphor-react-native';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

const CARD_SPACING = spacing.md;

interface HorizontalRecipeRowProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  recipes: Recipe[];
  isLoading?: boolean;
  isError?: boolean;
  emptyHint?: string;
  savedRecipeIds?: Set<string>;
  onSeeAll?: () => void;
  onSave?: (id: string) => Promise<boolean> | boolean | void;
  onRemove?: (id: string) => Promise<boolean> | boolean | void;
  onOpenDetail?: (item: Recipe) => void;
  accentColor?: string;
}

/**
 * HorizontalRecipeRow — Uber Eats-style themed carousel.
 * One row, one theme (Quick / High-Protein / Trending / Goal-matched).
 * Pattern source: Uber Eats home discovery rows.
 */
export const HorizontalRecipeRow: React.FC<HorizontalRecipeRowProps> = ({
  title,
  subtitle,
  icon,
  recipes,
  isLoading,
  isError,
  emptyHint,
  savedRecipeIds,
  onSeeAll,
  onSave,
  onRemove,
  onOpenDetail,
  accentColor,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.min(260, windowWidth * 0.72);
  const snapInterval = cardWidth + CARD_SPACING;
  const accent = accentColor || colors.light.primary;

  // Hide the whole row when not loading + truly empty (keeps the page tidy).
  if (!isLoading && !isError && recipes.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Row header */}
      <View style={styles.rowHeader}>
        <View style={styles.titleGroup}>
          {icon ? <View style={[styles.iconBubble, { backgroundColor: `${accent}1A` }]}>{icon}</View> : null}
          <View style={{ flexShrink: 1 }}>
            <Text variant="body" weight="semibold" style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="caption" style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {onSeeAll && recipes.length > 0 && (
          <Pressable onPress={onSeeAll} style={styles.seeAllButton} hitSlop={8}>
            <Text variant="caption" style={{ color: accent }}>See all</Text>
            <CaretRight size={14} color={accent} />
          </Pressable>
        )}
      </View>

      {/* Body */}
      {isLoading ? (
        <View style={[styles.loadingRow, { height: 220 }]}>
          <ActivityIndicator size="small" color={accent} />
        </View>
      ) : isError ? (
        <View style={[styles.loadingRow, { height: 80 }]}>
          <Text variant="caption" style={styles.subtitle}>
            {emptyHint || 'Couldn’t load this row.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          snapToInterval={snapInterval}
          decelerationRate="fast"
          snapToAlignment="start"
          renderItem={({ item, index }) => (
            <View
              style={[styles.cardWrapper, { width: cardWidth }, index === 0 && styles.firstCard]}
            >
              <RecipeCard
                item={item}
                isSaved={savedRecipeIds?.has(item.id)}
                onSave={onSave}
                onRemove={onRemove}
                onOpenDetail={onOpenDetail}
              />
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.light.textPrimary,
  },
  subtitle: {
    color: colors.light.textSecondary,
    opacity: 0.8,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  loadingRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  listContent: {
    paddingRight: spacing.lg,
  },
  cardWrapper: {
    marginLeft: CARD_SPACING,
    ...(Platform.OS === 'web' && {
      transition: 'transform 0.2s ease',
    }),
  },
  firstCard: {
    marginLeft: spacing.lg,
  },
});

export default HorizontalRecipeRow;
