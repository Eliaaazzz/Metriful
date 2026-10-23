/**
 * StreakSafetyCard — the streak, made safe.
 *
 * Duolingo's streak drives retention; its dark side is punishment anxiety. This card:
 *  - mounts the existing StreakBadge (previously built but unmounted);
 *  - adds a user-controlled pause (trip, illness, holiday) with calm copy while paused;
 *  - keeps zero-streak copy invitational ("fresh start"), never shaming a break.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { PauseCircle, PlayCircle } from 'phosphor-react-native';

import { StreakBadge } from '@/components/dashboard/StreakBadge';
import { Text } from '@/components/Text';
import { useStreakShieldStore } from '@/stores/useStreakShieldStore';
import { BRAND_COLORS, spacing } from '@/utils';

interface StreakSafetyCardProps {
  streak: number;
}

export function StreakSafetyCard({ streak }: StreakSafetyCardProps) {
  const pausedUntil = useStreakShieldStore((s) => s.pausedUntil);
  const pause = useStreakShieldStore((s) => s.pause);
  const resume = useStreakShieldStore((s) => s.resume);
  const [showPauseOptions, setShowPauseOptions] = useState(false);

  const paused = pausedUntil != null && pausedUntil > Date.now();

  if (paused) {
    const until = new Date(pausedUntil!).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return (
      <View style={styles.card}>
        <View style={styles.pausedRow}>
          <PauseCircle size={22} color={BRAND_COLORS.textMuted} weight="duotone" />
          <View style={{ flex: 1 }}>
            <Text variant="body" weight="semibold" style={styles.pausedTitle}>
              Streak paused until {until}
            </Text>
            <Text variant="caption" style={styles.pausedBody}>
              No pressure while you’re away — it picks back up when you do.
            </Text>
          </View>
          <Pressable
            onPress={resume}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Resume streak now"
          >
            <PlayCircle size={24} color="#111111" weight="duotone" />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <StreakBadge streak={streak} />
      {streak === 0 && (
        <Text variant="caption" style={styles.freshStart}>
          Every day is a fresh start — one logged meal begins a new streak.
        </Text>
      )}
      {showPauseOptions ? (
        <View style={styles.pauseOptionsRow}>
          <Text variant="caption" style={styles.pauseLabel}>
            Pause for:
          </Text>
          {[3, 7, 14].map((days) => (
            <Pressable
              key={days}
              onPress={() => {
                pause(days);
                setShowPauseOptions(false);
              }}
              style={styles.pauseChip}
              accessibilityRole="button"
              accessibilityLabel={`Pause streak for ${days} days`}
            >
              <Text variant="caption" weight="semibold" style={styles.pauseChipText}>
                {days} days
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowPauseOptions(false)} hitSlop={8}>
            <Text variant="caption" style={styles.pauseCancel}>
              Cancel
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setShowPauseOptions(true)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Pause streak for a trip, illness or holiday"
        >
          <Text variant="caption" style={styles.pauseLink}>
            Traveling or unwell? Pause the streak
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pausedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
    padding: spacing.md,
  },
  pausedTitle: {
    color: BRAND_COLORS.textPrimary,
  },
  pausedBody: {
    color: BRAND_COLORS.textMuted,
    marginTop: 1,
  },
  freshStart: {
    color: BRAND_COLORS.textMuted,
  },
  pauseLink: {
    color: BRAND_COLORS.textMuted,
    textDecorationLine: 'underline',
  },
  pauseOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pauseLabel: {
    color: BRAND_COLORS.textMuted,
  },
  pauseChip: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: '#F3F3F3',
  },
  pauseChipText: {
    color: BRAND_COLORS.textPrimary,
  },
  pauseCancel: {
    color: BRAND_COLORS.textMuted,
    marginLeft: 4,
  },
});

export default StreakSafetyCard;
