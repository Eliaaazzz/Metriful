import { BookmarkButton, Button, Text, useSnackbar } from '@/components';
import type { RecipeCard as Recipe, RecipeImageUrls } from '@/types';
import { cardStyles, getTheme, radii, spacing, useResponsiveValue } from '@/utils';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SmartRecipeImage } from './RecipeImage';

/**
 * Build a fallback image object from a single URL.
 * Used when recipe.image is not available.
 */
function buildFallbackImageUrls(url: string): RecipeImageUrls {
  return {
    thumb: url,
    medium: url,
    large: url,
  };
}

// Food image collection from Unsplash - curated list of food photos
const FOOD_IMAGES = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800', // colorful salad
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800', // pancakes
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800', // salad bowl
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800', // pizza
  'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800', // fruit bowl
  'https://images.unsplash.com/photo-1482049016gy-c69e7f5f7e42?w=800', // healthy bowl
  'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800', // french toast
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800', // food platter
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800', // veggie bowl
  'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800', // avocado toast
  'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800', // pasta
  'https://images.unsplash.com/photo-1547592180-85f173990554?w=800', // healthy meal
  'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800', // cooking ingredients
  'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800', // salmon
  'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800', // vegetables
  'https://images.unsplash.com/photo-1485921325833-c519f76c4927?w=800', // fish
  'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800', // grilled chicken
  'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=800', // chicken dish
  'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=800', // food spread
  'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=800', // steak
  'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800', // pasta bake
  'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800', // grilled meat
  'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=800', // breakfast
  'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800', // soup
  'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800', // asian food
  'https://images.unsplash.com/photo-1432139509613-5c4255815697?w=800', // tacos
  'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800', // beef
  'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800', // spaghetti
  'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800', // eggs benedict
  'https://images.unsplash.com/photo-1551326844-4df70f78d0e9?w=800', // korean food
];

/**
 * Generate a unique placeholder image for each recipe.
 * Uses recipe ID to select from a curated list of food images.
 * Ensures each recipe gets a unique but stable image.
 */
const getPlaceholderImage = (id: string, title: string): RecipeImageUrls => {
  // Create a hash from the recipe ID for consistent selection
  const seed = id || title;
  const hash = seed.split('').reduce((acc, char, idx) => {
    return acc + (char.codePointAt(0) || 0) * (idx + 1);
  }, 0);
  
  // Select image from the pool based on hash
  const url = FOOD_IMAGES[hash % FOOD_IMAGES.length];
  
  return buildFallbackImageUrls(url);
};

type Props = {
  item: Recipe;
  onSave?: (id: string) => Promise<boolean> | boolean | void;
  onRemove?: (id: string) => Promise<boolean> | boolean | void;
  onStart?: (item: Recipe) => void;
  /** F4 — tap-to-open hook. When supplied, RecipeCard fires this instead of route push. */
  onOpenDetail?: (item: Recipe) => void;
  isSaved?: boolean;
  /** Image variant to use - 'thumb' for lists, 'medium' for cards */
  imageVariant?: 'thumb' | 'medium' | 'large';
  /** Disable hover/press scale micro-animation (useful for dense lists like search results). */
  disableHoverEffect?: boolean;
};

/**
 * RecipeCard - Material Design 3 Style
 * Clean design, purple palette, micro-animations
 * Uses optimized images with small thumbnails for lists.
 */
export const RecipeCard = ({ item, onSave, onRemove, onStart, onOpenDetail, isSaved, imageVariant = 'thumb', disableHoverEffect = false }: Props) => {
  // Always use light mode
  const theme = getTheme('light');
  const [saving, setSaving] = useState(false);
  const { showSnackbar } = useSnackbar();
  const navigation = useNavigation<any>();

  // Animation for floating card effect - each card has its own state
  // Disable hover effect for saved items
  const [isHovered, setIsHovered] = useState(false);
  const enableHover = !isSaved && !disableHoverEffect;

  // Spring press animation (mobile)
  const pressScale = useSharedValue(1);
  const pressAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  // Web hover handlers
  const webHoverProps = Platform.OS === 'web' && enableHover ? {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
  } : {};

  // Mobile press handlers
  const handlePressIn = useCallback(() => {
    if (enableHover) setIsHovered(true);
    if (Platform.OS !== 'web') {
      pressScale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
    }
  }, [enableHover, pressScale]);
  const handlePressOut = useCallback(() => {
    if (enableHover) setIsHovered(false);
    if (Platform.OS !== 'web') {
      pressScale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  }, [enableHover, pressScale]);

  const time = item.timeMinutes ? `${item.timeMinutes} min` : '—';
  const difficulty = item.difficulty?.toUpperCase() ?? '—';
  const calories = item.calories ? `${item.calories} cal` : null;

  // Resolve image URLs with fallback
  const imageUrls = useMemo((): RecipeImageUrls => {
    // Prefer the new image object with variants
    if (item.image) {
      return item.image;
    }
    // Fall back to legacy imageUrl
    if (item.imageUrl) {
      return buildFallbackImageUrls(item.imageUrl);
    }
    // Use unique placeholder based on recipe ID
    return getPlaceholderImage(item.id, item.title);
  }, [item.image, item.imageUrl, item.id, item.title]);

  // Responsive image height - same values as WorkoutCard for consistency
  const imageHeight = useResponsiveValue({
    mobile: 160,
    tablet: 180,
    desktop: 180,
    wide: 180,
  });

  const handleBookmark = async () => {
    const removeAction = isSaved && onRemove;
    const handler = removeAction ? onRemove : onSave;
    if (!handler || saving) return;
    try {
      setSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const result = await Promise.resolve(handler(item.id));
      const ok = result === undefined ? true : Boolean(result);
      if (ok) {
        showSnackbar(removeAction ? 'Removed' : 'Saved!', { variant: 'success' });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        showSnackbar('Failed', { variant: 'error' });
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showSnackbar(getFriendlyErrorMessage(e), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCardPress = () => {
    if (onOpenDetail) {
      onOpenDetail(item);
      return;
    }
    if (onStart) {
      onStart(item);
    } else {
      // Navigate to recipe detail screen
      navigation.navigate('RecipeDetail', { recipe: item });
    }
  };

  // Reuse handleCardPress for button as behavior is identical
  const handleStartPress = handleCardPress;

  // Dynamic styles for hover/press effect
  const showHover = enableHover && isHovered;
  const cardDynamicStyle = {
    transform: [{ scale: showHover ? 1.02 : 1 }],
    ...(Platform.OS === 'web' && {
      transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s ease-out',
      ...(showHover ? cardStyles.hover : cardStyles.rest),
    }),
  };

  return (
    <Animated.View style={[styles.card, cardDynamicStyle, Platform.OS !== 'web' && pressAnimatedStyle]} {...webHoverProps}>
      {/* Image - Clickable area */}
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handleCardPress}
        style={[styles.imageContainer, { height: imageHeight }]}
      >
        {/* Use SmartRecipeImage for optimized loading */}
        <SmartRecipeImage 
          image={imageUrls} 
          variant={imageVariant}
          style={styles.image}
          borderRadius={0}
          accessibilityLabel={`${item.title} recipe image`}
        />

        {/* Chips */}
        <View style={styles.chipRow}>
          {item.isAiGenerated && (
            <View style={styles.chip}>
              <Text variant="label" style={styles.chipText}>AI</Text>
            </View>
          )}
          <View style={styles.chip}>
            <Text variant="label" style={styles.chipText}>{difficulty}</Text>
          </View>
        </View>
      </Pressable>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Text variant="body" weight="semibold" numberOfLines={2} style={{ color: theme.colors.textPrimary }}>
            {item.title}
          </Text>
        </View>

        <Text variant="caption" style={{ color: theme.colors.textSecondary }}>
          {time}{calories ? ` · ${calories}` : ''}
        </Text>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Start"
            variant="primary"
            size="small"
            onPress={handleStartPress}
          />
          <BookmarkButton
            isSaved={!!isSaved}
            isLoading={saving}
            onPress={handleBookmark}
            color={theme.colors.textPrimary}
          />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.06)',
    shadowColor: '#171511',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  chipRow: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.06)',
  },
  chipText: {
    color: '#111111',
    fontSize: 11,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  titleContainer: {
    height: 40, // Fixed height for 2 lines of text (body variant ~16px * 1.4 lineHeight * 2)
    justifyContent: 'flex-start',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});
