/**
 * SuggestionGrid - Uber-style 2x3 illustration card grid.
 *
 * Pattern: Uber homepage suggestion tiles (Ride, Reserve, Food, Grocery).
 * Each card: light grey bg, CENTERED illustration on top, title centered below.
 * No subtitles. Square-ish proportions. Clean and minimal.
 */

import { Image } from 'expo-image';
import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/Text';
import { spacing } from '@/utils';

interface SuggestionCard {
  title: string;
  illustration: any;
  description?: string;
  backgroundColor?: string;
  onPress: () => void;
}

interface SuggestionGridProps {
  cards: SuggestionCard[];
}

const GRID_GAP = 16;
const MOBILE_HORIZONTAL_GUTTER = spacing.lg * 2;
const DESKTOP_HORIZONTAL_GUTTER = spacing.xl * 2;

export function SuggestionGrid({ cards }: SuggestionGridProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 420;
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  const fallbackWidth = useMemo(() => {
    const gutter = isCompact ? MOBILE_HORIZONTAL_GUTTER : DESKTOP_HORIZONTAL_GUTTER;
    return Math.max(0, width - gutter);
  }, [isCompact, width]);

  const gridWidth = measuredWidth && measuredWidth > 0 ? measuredWidth : fallbackWidth;
  // Uber-style shelf: one row of tiles on wide screens, wrapping down to 2-up on phones.
  const columns = gridWidth >= 1080 ? 6 : gridWidth >= 640 ? 3 : 2;
  const cardWidth = Math.max(0, (gridWidth - GRID_GAP * (columns - 1)) / columns);
  const illustrationStyle = isCompact
    ? [styles.illustration, styles.illustrationCompact]
    : styles.illustration;
  const cardTitleStyle = isCompact
    ? [styles.cardTitle, styles.cardTitleCompact]
    : styles.cardTitle;

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setMeasuredWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  }, []);

  return (
    <View onLayout={handleLayout} style={styles.grid}>
      {cards.map((card) => (
        <Pressable
          key={card.title}
          onPress={card.onPress}
          style={({ pressed }) => [
            styles.card,
            isCompact && styles.cardCompact,
            { width: cardWidth },
            card.backgroundColor ? { backgroundColor: card.backgroundColor } : null,
            pressed && styles.cardPressed,
          ]}
        >
          <Image
            source={card.illustration}
            style={illustrationStyle}
            contentFit="contain"
          />
          <Text
            variant="body"
            weight="medium"
            numberOfLines={2}
            style={cardTitleStyle}
          >
            {card.title}
          </Text>
          {card.description ? (
            <Text variant="caption" style={styles.cardDescription}>
              {card.description}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  card: {
    minWidth: 0,
    minHeight: 164,
    backgroundColor: '#F3F3F3',
    borderRadius: 16,
    paddingTop: 20,
    paddingBottom: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'flex-start',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'background-color 0.15s ease-out',
    }),
  },
  cardCompact: {
    minHeight: 152,
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 12,
  },
  cardPressed: {
    opacity: 0.92,
  },
  illustration: {
    width: 76,
    height: 76,
    marginBottom: 12,
  },
  illustrationCompact: {
    width: 68,
    height: 68,
    marginBottom: 10,
  },
  cardTitle: {
    color: '#111111',
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: '100%',
    flexShrink: 1,
  },
  cardTitleCompact: {
    fontSize: 13,
    lineHeight: 17,
  },
  cardDescription: {
    color: 'rgba(17,17,17,0.64)',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default SuggestionGrid;
