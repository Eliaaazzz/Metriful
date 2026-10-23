import type { RecipeImageUrls } from '@/utils/spoonacular';
import { FALLBACK_RECIPE_IMAGE } from '@/utils/spoonacular';
import { Image as ExpoImage } from 'expo-image';
import React, { useCallback, useState } from 'react';
import { ImageStyle, Platform, StyleSheet, View, ViewStyle } from 'react-native';

// ============================================================================
// Types
// ============================================================================

export type RecipeImageVariant = 'thumb' | 'medium' | 'large';

export interface RecipeImageProps {
  /** Image URLs object from normalized recipe */
  image: RecipeImageUrls | null | undefined;
  /** Which image variant to display */
  variant?: RecipeImageVariant;
  /** Container style */
  style?: ViewStyle;
  /** Image style override (applies to the Image component) */
  imageStyle?: ImageStyle; // eslint-disable-line react/no-unused-prop-types
  /** Border radius (default: 8) */
  borderRadius?: number;
  /** Accessibility label */
  accessibilityLabel?: string;
  /** Show loading placeholder (default: true) */
  showPlaceholder?: boolean; // eslint-disable-line react/no-unused-prop-types
  /** Callback when image fails to load (for analytics) */
  onLoadError?: (error: Error) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_BORDER_RADIUS = 8;

// Themed placeholder color matching the app's dark theme
const PLACEHOLDER_COLOR = 'rgba(55, 65, 81, 0.5)';

// ============================================================================
// RecipeImage Component
// ============================================================================

/**
 * RecipeImage - Optimized image component for recipe cards and detail pages.
 * 
 * Features:
 * - Automatically selects correct image size based on variant
 * - Handles loading and error states internally
 * - Falls back to placeholder on error
 * - Does NOT affect page-level loading state
 * - Uses resizeMode="cover" for consistent cropping
 * 
 * @example
 * // In a recipe list (use thumb for performance)
 * <RecipeImage image={recipe.image} variant="thumb" style={{ height: 160 }} />
 * 
 * // In recipe detail page (use large for quality)
 * <RecipeImage image={recipe.image} variant="large" style={{ height: 300 }} />
 */
export const RecipeImage: React.FC<RecipeImageProps> = ({
  image,
  variant = 'medium',
  style,
  imageStyle,
  borderRadius = DEFAULT_BORDER_RADIUS,
  accessibilityLabel,
  showPlaceholder = true,
  onLoadError,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Select appropriate URL based on variant
  const getImageUrl = useCallback((): string => {
    if (!image) {
      return FALLBACK_RECIPE_IMAGE;
    }
    
    switch (variant) {
      case 'thumb':
        return image.thumb || image.medium || image.large || FALLBACK_RECIPE_IMAGE;
      case 'large':
        return image.large || image.medium || image.thumb || FALLBACK_RECIPE_IMAGE;
      case 'medium':
      default:
        return image.medium || image.large || image.thumb || FALLBACK_RECIPE_IMAGE;
    }
  }, [image, variant]);

  const imageUrl = hasError ? FALLBACK_RECIPE_IMAGE : getImageUrl();

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);

    if (onLoadError) {
      onLoadError(new Error(`Failed to load image: ${imageUrl}`));
    }
  }, [imageUrl, onLoadError]);

  return (
    <View style={[styles.container, { borderRadius }, style]}>
      {/* Placeholder background */}
      {showPlaceholder && isLoading && (
        <View
          style={[
            styles.placeholder,
            { borderRadius, backgroundColor: PLACEHOLDER_COLOR }
          ]}
        />
      )}

      {/* Actual image (expo-image: memory+disk cache, smooth transition) */}
      <ExpoImage
        source={{ uri: imageUrl }}
        style={[styles.image, { borderRadius }, imageStyle]}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
        onLoad={handleLoad}
        onError={handleError}
        accessibilityLabel={accessibilityLabel || 'Recipe image'}
        accessible
      />
    </View>
  );
};

// ============================================================================
// Web-Optimized Version
// ============================================================================

/**
 * RecipeImageWeb - Web-optimized version using native img tag.
 * 
 * For better web performance, this uses:
 * - Native <img> element with objectFit: cover
 * - loading="lazy" for deferred loading
 * - decoding="async" for non-blocking decode
 * 
 * @example
 * <RecipeImageWeb image={recipe.image} variant="medium" style={{ height: 200 }} />
 */
export const RecipeImageWeb: React.FC<RecipeImageProps> = ({
  image,
  variant = 'medium',
  style,
  borderRadius = DEFAULT_BORDER_RADIUS,
  accessibilityLabel,
  onLoadError,
}) => {
  const [hasError, setHasError] = useState(false);

  // Select appropriate URL based on variant
  const getImageUrl = (): string => {
    if (!image) {
      return FALLBACK_RECIPE_IMAGE;
    }
    
    switch (variant) {
      case 'thumb':
        return image.thumb || image.medium || image.large || FALLBACK_RECIPE_IMAGE;
      case 'large':
        return image.large || image.medium || image.thumb || FALLBACK_RECIPE_IMAGE;
      case 'medium':
      default:
        return image.medium || image.large || image.thumb || FALLBACK_RECIPE_IMAGE;
    }
  };

  const imageUrl = hasError ? FALLBACK_RECIPE_IMAGE : getImageUrl();

  const handleError = () => {
    setHasError(true);
    if (onLoadError) {
      onLoadError(new Error(`Failed to load image: ${imageUrl}`));
    }
  };

  // Web-specific rendering
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { borderRadius }, style]}>
        <img
          src={imageUrl}
          alt={accessibilityLabel || 'Recipe image'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius,
          }}
          loading="lazy"
          decoding="async"
          onError={handleError}
        />
      </View>
    );
  }

  // Fall back to native Image for non-web
  return (
    <RecipeImage
      image={image}
      variant={variant}
      style={style}
      borderRadius={borderRadius}
      accessibilityLabel={accessibilityLabel}
      onLoadError={onLoadError}
    />
  );
};

// ============================================================================
// Cross-Platform Smart Component
// ============================================================================

/**
 * SmartRecipeImage - Automatically chooses the best implementation.
 * 
 * - Uses web-optimized img tag on web
 * - Uses React Native Image on native platforms
 * - Handles all error states gracefully
 * - Never blocks page loading
 */
export const SmartRecipeImage: React.FC<RecipeImageProps> = (props) => {
  if (Platform.OS === 'web') {
    return <RecipeImageWeb {...props} />;
  }
  return <RecipeImage {...props} />;
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: PLACEHOLDER_COLOR,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

// ============================================================================
// Exports
// ============================================================================

export default RecipeImage;
