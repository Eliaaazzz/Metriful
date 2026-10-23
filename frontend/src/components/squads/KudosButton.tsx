/**
 * KudosButton — toggleable flame button on a meal log card.
 *
 * Inspired by Strava's Kudos pattern — one tap, count visible. Optimistic UI:
 * the flame fills immediately; if the API call fails the state reverts and an
 * onError callback fires.
 */
import * as Haptics from 'expo-haptics';
import { Flame } from 'phosphor-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { squadsApi } from '@/services/squadsApi';
import { BRAND_COLORS, spacing } from '@/utils';

interface KudosButtonProps {
  mealLogId: number;
  initialCount: number;
  initialKudoed: boolean;
  /** When false, a tap surfaces an inline disabled hint (e.g. own meal). */
  enabled?: boolean;
  onError?: (err: unknown) => void;
}

export function KudosButton({
  mealLogId,
  initialCount,
  initialKudoed,
  enabled = true,
  onError,
}: KudosButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [kudoed, setKudoed] = useState(initialKudoed);
  const [pending, setPending] = useState(false);
  const scale = useSharedValue(1);

  useEffect(() => { setCount(initialCount); }, [initialCount]);
  useEffect(() => { setKudoed(initialKudoed); }, [initialKudoed]);

  const animateTap = () => {
    scale.value = withSequence(
      withSpring(0.9,  { damping: 14, stiffness: 220 }),
      withSpring(1.15, { damping: 12, stiffness: 200 }),
      withSpring(1.0,  { damping: 12, stiffness: 150 }),
    );
  };

  const onPress = useCallback(async () => {
    if (!enabled || pending) return;

    // Optimistic update
    const nextKudoed = !kudoed;
    const nextCount = Math.max(0, count + (nextKudoed ? 1 : -1));
    setKudoed(nextKudoed);
    setCount(nextCount);
    animateTap();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    setPending(true);
    try {
      const response = await squadsApi.toggleKudos(mealLogId);
      // Reconcile with server-truth (handles e.g. concurrent kudos from another device)
      setKudoed(response.kudoed);
      setCount(response.kudosCount);
    } catch (err) {
      // Revert
      setKudoed(!nextKudoed);
      setCount(count);
      onError?.(err);
    } finally {
      setPending(false);
    }
  }, [enabled, pending, kudoed, count, mealLogId, onError, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const tint = kudoed ? BRAND_COLORS.primary : BRAND_COLORS.textMuted;

  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: kudoed, disabled: !enabled }}
      accessibilityLabel={kudoed ? `Remove kudos. ${count} kudos.` : `Give kudos. ${count} kudos.`}
      testID={`kudos-button-${mealLogId}`}
    >
      <Animated.View style={[styles.container, kudoed && styles.containerActive, animatedStyle]}>
        <Flame size={14} color={tint} weight={kudoed ? 'fill' : 'regular'} />
        {count > 0 && (
          <Text variant="caption" weight="bold" style={[styles.count, { color: tint }]}>
            {count}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  containerActive: {
    backgroundColor: 'rgba(249,115,22,0.10)',
    borderColor: 'rgba(249,115,22,0.25)',
  },
  count: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});

export default KudosButton;
