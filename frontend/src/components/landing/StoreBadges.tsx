/**
 * StoreBadges — official App Store + Google Play download badges
 *
 * Inspired by Apple's "Marketing Resources" badge guidelines and Google Play's
 * "Branding guidelines" — shipping the official artwork is required by both
 * stores and avoids us drawing trademarked logos by hand. The Apple SVG is the
 * canonical "Black" lockup from developer.apple.com; the Google Play asset is
 * the canonical "Get it on Google Play" PNG from play.google.com/intl/en_us/badges.
 *
 * Designed for placement on dark surfaces (the landing page CTA banner).
 */

import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { trackEvent } from '@/services/analytics';
import { openExternalUrl, spacing } from '@/utils';

export const APP_STORE_URL = 'https://apps.apple.com/app/metriful/id6760930295';

const appStoreBadge = require('@/../assets/store-badges/app-store-badge.svg');
const googlePlayBadge = require('@/../assets/store-badges/google-play-badge.png');

// Apple guidelines: minimum badge height 40pt; aspect ratio of the official
// "Black" lockup is ~3:1 (119.66 × 40 in the source SVG).
const APPLE_RATIO = 119.66407 / 40;
// Google Play "Get it on" badge: 646 × 250 (asset) → ~2.584:1.
const GOOGLE_RATIO = 646 / 250;
const MIN_TAP_HEIGHT = 44;

interface StoreBadgesProps {
  playStoreUrl?: string;
  height?: number;
  style?: ViewStyle;
  align?: 'flex-start' | 'center' | 'stretch';
}

export function StoreBadges({ playStoreUrl, height = 48, style, align = 'flex-start' }: StoreBadgesProps) {
  const playEnabled = !!playStoreUrl;
  const wrapMinHeight = Math.max(height, MIN_TAP_HEIGHT);

  return (
    <View
      style={[
        styles.row,
        { alignSelf: align, justifyContent: align === 'center' ? 'center' : 'flex-start' },
        style,
      ]}
    >
      <Pressable
        onPress={() => {
          trackEvent('app_store_click', { placement: 'app' });
          void openExternalUrl(APP_STORE_URL, 'Unable to open the App Store', 'Please try opening the App Store manually.');
        }}
        accessibilityRole="link"
        accessibilityLabel="Download Metriful on the App Store"
        style={({ pressed }) => [{ minHeight: wrapMinHeight, justifyContent: 'center' }, pressed && styles.pressed]}
      >
        <Image
          source={appStoreBadge}
          style={{ height, width: height * APPLE_RATIO }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </Pressable>

      <View style={styles.googleColumn}>
        <Pressable
          onPress={playStoreUrl ? () => {
            trackEvent('play_store_click', { placement: 'app' });
            void openExternalUrl(playStoreUrl, 'Unable to open Google Play', 'Please try opening Google Play manually.');
          } : undefined}
          disabled={!playEnabled}
          accessibilityRole={playEnabled ? 'link' : 'image'}
          accessibilityLabel={playEnabled ? 'Get Metriful on Google Play' : 'Metriful on Google Play — coming soon'}
          accessibilityState={{ disabled: !playEnabled }}
          style={({ pressed }) => [
            { minHeight: wrapMinHeight, justifyContent: 'center' },
            !playEnabled && styles.disabled,
            pressed && playEnabled && styles.pressed,
          ]}
        >
          <Image
            source={googlePlayBadge}
            style={{ height, width: height * GOOGLE_RATIO }}
            contentFit="contain"
            accessibilityIgnoresInvertColors
          />
        </Pressable>
        {!playEnabled && (
          <Text style={styles.comingSoon} accessibilityElementsHidden importantForAccessibility="no">
            Coming soon
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  googleColumn: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  comingSoon: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.55,
  },
});

export default StoreBadges;
