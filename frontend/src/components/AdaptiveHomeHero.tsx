import { Text } from '@/components';
import { colors, radii, spacing, springPresets } from '@/utils';
import { CaretRight, Coffee, MoonStars, SunDim, Sun } from 'phosphor-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

type DaySlot = 'morning' | 'afternoon' | 'evening' | 'night';

interface AdaptiveHomeHeroProps {
  /** User's first name for personalization */
  userName?: string;
  /** Today's calories consumed so far */
  caloriesConsumed?: number;
  /** Today's calorie target */
  caloriesTarget?: number;
  /** Today's protein consumed so far (g) */
  proteinConsumed?: number;
  /** Today's protein target (g) */
  proteinTarget?: number;
  /** Today's composite score 0-100, when available */
  dailyScore?: number;
  /** Number of meals logged today */
  mealsLoggedToday?: number;
  /** Primary CTA tap handler (snap meal, view recap, etc) */
  onPrimaryAction?: () => void;
  /** Secondary CTA tap handler (browse recipes, view targets) */
  onSecondaryAction?: () => void;
  /** Tightens the card for narrow dashboard layouts. */
  compact?: boolean;
}

const getSlot = (date = new Date()): DaySlot => {
  const h = date.getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 16) return 'afternoon';
  if (h >= 16 && h < 21) return 'evening';
  return 'night';
};

interface SlotContent {
  greeting: string;
  headline: string;
  body: string;
  primaryLabel: string;
  secondaryLabel?: string;
  icon: React.ReactNode;
}

/**
 * AdaptiveHomeHero — single hero card that morphs by time of day.
 * Pattern source: Uber's homepage suggestion tiles — one contextual task, restrained
 * surface, compact illustration, and a clear action without competing with the page hero.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const AdaptiveHomeHero: React.FC<AdaptiveHomeHeroProps> = ({
  userName,
  caloriesConsumed,
  caloriesTarget,
  proteinConsumed,
  proteinTarget,
  dailyScore,
  mealsLoggedToday = 0,
  onPrimaryAction,
  onSecondaryAction,
  compact = false,
}) => {
  const slot = useMemo(() => getSlot(), []);
  const nameBit = userName ? `, ${userName}` : '';
  const reduceMotion = useReducedMotion();
  const primaryScale = useSharedValue(1);
  const secondaryScale = useSharedValue(1);
  const [primaryFocused, setPrimaryFocused] = useState(false);
  const [secondaryFocused, setSecondaryFocused] = useState(false);

  const remainingCals = useMemo(() => {
    if (!caloriesTarget) return null;
    return Math.max(0, caloriesTarget - (caloriesConsumed ?? 0));
  }, [caloriesTarget, caloriesConsumed]);

  const remainingProtein = useMemo(() => {
    if (!proteinTarget) return null;
    return Math.max(0, proteinTarget - (proteinConsumed ?? 0));
  }, [proteinTarget, proteinConsumed]);

  const content: SlotContent = useMemo(() => {
    switch (slot) {
      case 'morning':
        return {
          greeting: `Good morning${nameBit}`,
          headline:
            mealsLoggedToday > 0
              ? 'Strong start.'
              : 'Plan breakfast first.',
          body:
            mealsLoggedToday > 0
              ? `${mealsLoggedToday} ${mealsLoggedToday === 1 ? 'meal' : 'meals'} logged. Stay ahead of your day.`
              : 'Snap or pick a high-protein breakfast to win the morning.',
          primaryLabel: mealsLoggedToday > 0 ? 'Log a meal' : 'Snap breakfast',
          secondaryLabel: 'Browse recipes',
          icon: <Coffee size={28} color="#111111" weight="fill" />,
        };
      case 'afternoon':
        return {
          greeting: `Good afternoon${nameBit}`,
          headline:
            remainingCals !== null
              ? `${remainingCals.toLocaleString()} kcal left today`
              : 'Keep momentum.',
          body:
            remainingProtein !== null && remainingProtein > 0
              ? `${remainingProtein}g protein remaining. A protein-forward snack can keep today on track.`
              : 'Stay on plan with a balanced lunch or smart snack.',
          primaryLabel: 'Log a meal',
          secondaryLabel: 'Find a snack',
          icon: <Sun size={28} color="#111111" weight="fill" />,
        };
      case 'evening':
        return {
          greeting: `Good evening${nameBit}`,
          headline:
            dailyScore !== undefined
              ? `Today’s score: ${Math.round(dailyScore)}`
              : 'Close the loop on today.',
          body:
            remainingCals !== null
              ? `${remainingCals} kcal budget left. Plan a balanced dinner to finish strong.`
              : 'Log dinner to wrap up today’s plan.',
          primaryLabel: 'Log dinner',
          secondaryLabel: 'Browse recipes',
          icon: <SunDim size={28} color="#111111" weight="fill" />,
        };
      case 'night':
      default:
        return {
          greeting: `Good night${nameBit}`,
          headline:
            dailyScore !== undefined
              ? `Today landed at ${Math.round(dailyScore)}/100`
              : 'Set up tomorrow.',
          body:
            mealsLoggedToday > 0
              ? `${mealsLoggedToday} ${mealsLoggedToday === 1 ? 'meal' : 'meals'} logged. Lock in the streak — tomorrow starts fresh.`
              : 'A quick meal log now keeps your week complete.',
          primaryLabel: 'Log a meal',
          secondaryLabel: 'Browse recipes',
          icon: <MoonStars size={28} color="#111111" weight="fill" />,
        };
    }
  }, [slot, nameBit, mealsLoggedToday, remainingCals, remainingProtein, dailyScore]);

  const primaryAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: primaryScale.value }],
  }));
  const secondaryAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: secondaryScale.value }],
  }));

  const handlePrimaryPressIn = useCallback(() => {
    if (!reduceMotion) {
      primaryScale.value = withSpring(0.98, springPresets.tabBounce);
    }
  }, [primaryScale, reduceMotion]);
  const handlePrimaryPressOut = useCallback(() => {
    primaryScale.value = reduceMotion
      ? 1
      : withSpring(1, springPresets.tabBounce);
  }, [primaryScale, reduceMotion]);
  const handleSecondaryPressIn = useCallback(() => {
    if (!reduceMotion) {
      secondaryScale.value = withSpring(0.98, springPresets.tabBounce);
    }
  }, [reduceMotion, secondaryScale]);
  const handleSecondaryPressOut = useCallback(() => {
    secondaryScale.value = reduceMotion
      ? 1
      : withSpring(1, springPresets.tabBounce);
  }, [reduceMotion, secondaryScale]);

  return (
    <View
      style={[styles.container, compact && styles.containerCompact]}
      accessibilityLabel={`Daily suggestion. ${content.headline}`}
    >
      <View style={styles.contentRow}>
        <View style={styles.copyColumn}>
          <View style={styles.greetingRow}>
            <View style={styles.greetingRule} />
            <Text variant="caption" weight="semibold" style={styles.greeting}>
              {content.greeting}
            </Text>
          </View>
          <Text variant="heading3" weight="bold" style={styles.headline}>
            {content.headline}
          </Text>
          <Text variant="body" style={styles.body}>
            {content.body}
          </Text>

          <View style={styles.actionRow}>
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel={content.primaryLabel}
              disabled={!onPrimaryAction}
              onPress={onPrimaryAction}
              onPressIn={handlePrimaryPressIn}
              onPressOut={handlePrimaryPressOut}
              onFocus={() => setPrimaryFocused(true)}
              onBlur={() => setPrimaryFocused(false)}
              style={[
                styles.primaryBtn,
                primaryAnimatedStyle,
                primaryFocused && styles.focusRing,
              ]}
            >
              <Text variant="body" weight="bold" style={styles.primaryBtnText}>
                {content.primaryLabel}
              </Text>
              <CaretRight size={14} color={colors.light.surfaceElevated} weight="bold" />
            </AnimatedPressable>
            {content.secondaryLabel && (
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityLabel={content.secondaryLabel}
                disabled={!onSecondaryAction}
                onPress={onSecondaryAction}
                onPressIn={handleSecondaryPressIn}
                onPressOut={handleSecondaryPressOut}
                onFocus={() => setSecondaryFocused(true)}
                onBlur={() => setSecondaryFocused(false)}
                style={[
                  styles.secondaryBtn,
                  secondaryAnimatedStyle,
                  secondaryFocused && styles.focusRing,
                ]}
              >
                <Text variant="body" weight="medium" style={styles.secondaryBtnText}>
                  {content.secondaryLabel}
                </Text>
              </AnimatedPressable>
            )}
          </View>
        </View>
        <View pointerEvents="none" style={[styles.iconTile, compact && styles.iconTileCompact]}>
          {content.icon}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F6F6F6',
    borderRadius: 12,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  containerCompact: {
    padding: spacing.lg,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  copyColumn: {
    flex: 1,
    minWidth: 0,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  greetingRule: {
    width: 20,
    height: 3,
    borderRadius: radii.full,
    backgroundColor: '#111111',
  },
  greeting: {
    color: colors.light.textSecondary,
  },
  headline: {
    color: colors.light.textPrimary,
    marginBottom: spacing.xs,
  },
  body: {
    color: colors.light.textSecondary,
    maxWidth: 540,
  },
  iconTile: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    backgroundColor: '#EAEAEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileCompact: {
    width: 52,
    height: 52,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 48,
    backgroundColor: colors.light.textPrimary,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as const,
      transition: 'opacity 150ms ease-out',
    }),
  },
  primaryBtnText: { color: colors.light.surfaceElevated },
  secondaryBtn: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as const,
      transition: 'opacity 150ms ease-out',
    }),
  },
  secondaryBtnText: {
    color: colors.light.textPrimary,
    textDecorationColor: colors.light.borderStrong,
    textDecorationLine: 'underline',
  },
  focusRing: {
    ...(Platform.OS === 'web' && {
      outlineColor: '#111111',
      outlineOffset: 3,
      outlineStyle: 'solid',
      outlineWidth: 2,
    }),
  },
});

export default AdaptiveHomeHero;
