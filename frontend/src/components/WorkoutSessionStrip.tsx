import { Text } from '@/components';
import { useWorkoutSessionStore } from '@/stores/useWorkoutSessionStore';
import { colors, radii, spacing } from '@/utils';
import * as Haptics from 'expo-haptics';
import { Pause, Play, Stop } from 'phosphor-react-native';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

interface WorkoutSessionStripProps {
  onFinish?: (result: { durationMs: number; estimatedCalories: number }) => void;
  /** Bottom inset (above tab bar). Default 80. */
  bottomInset?: number;
}

const formatHMS = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * WorkoutSessionStrip — persistent bottom strip while a workout session is active.
 * Pattern source: Uber Eats order-in-progress bar + Strava activity recording.
 * Mount at the navigator root so it persists across tabs.
 */
export const WorkoutSessionStrip: React.FC<WorkoutSessionStripProps> = ({
  onFinish,
  bottomInset = 80,
}) => {
  const session = useWorkoutSessionStore((s) => s.session);
  const pause = useWorkoutSessionStore((s) => s.pause);
  const resume = useWorkoutSessionStore((s) => s.resume);
  const finish = useWorkoutSessionStore((s) => s.finish);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [session]);

  if (!session) return null;

  const now = Date.now();
  const pausedTotal =
    session.totalPausedMs + (session.pausedAt ? now - session.pausedAt : 0);
  const elapsedMs = now - session.startedAt - pausedTotal;
  const isPaused = !!session.pausedAt;

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: bottomInset }]}>
      <View style={styles.pill}>
        <View style={styles.left}>
          <View style={[styles.dot, isPaused ? styles.dotPaused : styles.dotLive]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="caption" weight="bold" numberOfLines={1} style={styles.title}>
              {session.title}
            </Text>
            <Text variant="caption" style={styles.time} numberOfLines={1}>
              {formatHMS(elapsedMs)}{isPaused ? ' · Paused' : ' · Recording'}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              isPaused ? resume() : pause();
            }}
            hitSlop={6}
            style={styles.iconBtn}
          >
            {isPaused ? (
              <Play size={16} color={colors.light.textPrimary} weight="fill" />
            ) : (
              <Pause size={16} color={colors.light.textPrimary} weight="fill" />
            )}
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              const result = finish();
              if (result) onFinish?.(result);
            }}
            hitSlop={6}
            style={[styles.iconBtn, styles.finishBtn]}
          >
            <Stop size={16} color="#FFFFFF" weight="fill" />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'stretch',
    zIndex: 999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(17,17,17,0.92)',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.sm,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 12 },
      default: { boxShadow: '0 6px 20px rgba(0,0,0,0.25)' } as any,
    }),
  },
  left: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotLive: { backgroundColor: '#10B981' },
  dotPaused: { backgroundColor: '#F59E0B' },
  title: { color: '#FFFFFF' },
  time: { color: 'rgba(255,255,255,0.7)' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  finishBtn: { backgroundColor: '#EF4444' },
});

export default WorkoutSessionStrip;
