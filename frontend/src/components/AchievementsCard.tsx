import { Text } from '@/components';
import { badgeArtFor, colors, radii, spacing } from '@/utils';
import { Image } from 'expo-image';
import { Lock, Trophy } from 'phosphor-react-native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

export interface Achievement {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** 0-1 progress toward unlock */
  progress: number;
  unlocked: boolean;
}

interface AchievementsCardProps {
  achievements: Achievement[];
  onSeeAll?: () => void;
  onTap?: (a: Achievement) => void;
}

/**
 * AchievementsCard — Strava-style badge wall.
 * Shows a horizontally scrollable strip of badges with locked/unlocked states.
 * Pattern source: Strava Achievements + Duolingo Trophy room.
 */
export const AchievementsCard: React.FC<AchievementsCardProps> = ({
  achievements,
  onSeeAll,
  onTap,
}) => {
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.iconBubble}>
            <Trophy size={16} color={colors.light.primary} weight="fill" />
          </View>
          <View>
            <Text variant="body" weight="bold" style={styles.title}>
              Achievements
            </Text>
            <Text variant="caption" style={styles.subtitle}>
              {unlockedCount} of {achievements.length} unlocked
            </Text>
          </View>
        </View>
        {onSeeAll && (
          <Pressable onPress={onSeeAll} hitSlop={6}>
            <Text variant="caption" weight="semibold" style={styles.seeAllText}>
              See all
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {achievements.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => onTap?.(a)}
            style={({ pressed }) => [
              styles.badge,
              !a.unlocked && styles.badgeLocked,
              pressed && { transform: [{ scale: 0.96 }] },
            ]}
          >
            <View
              style={[
                styles.badgeMedal,
                a.unlocked ? styles.badgeMedalUnlocked : styles.badgeMedalLocked,
              ]}
            >
              {badgeArtFor(a.emoji) ? (
                <Image
                  source={badgeArtFor(a.emoji)}
                  style={[styles.badgeIcon, !a.unlocked && styles.badgeIconLocked] as any}
                  contentFit="contain"
                />
              ) : (
                <Text style={styles.badgeEmoji}>{a.emoji}</Text>
              )}
              {!a.unlocked && (
                <View style={styles.lockCorner}>
                  <Lock size={10} color={colors.light.textSecondary} weight="bold" />
                </View>
              )}
            </View>
            <Text
              variant="caption"
              weight="semibold"
              numberOfLines={1}
              style={[styles.badgeLabel, !a.unlocked && styles.badgeLabelLocked]}
            >
              {a.label}
            </Text>
            {!a.unlocked && a.progress < 1 ? (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(a.progress * 100)}%` },
                  ]}
                />
              </View>
            ) : (
              <View style={{ height: 4 }} />
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  seeAllText: {
    color: colors.light.textPrimary,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(17,17,17,0.3)',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  badge: {
    width: 92,
    alignItems: 'center',
    gap: 6,
  },
  badgeLocked: { opacity: 0.78 },
  badgeMedal: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMedalUnlocked: {
    backgroundColor: '#F6F6F6',
    borderWidth: 2,
    borderColor: '#111111',
  },
  badgeMedalLocked: {
    backgroundColor: 'rgba(17,17,17,0.05)',
  },
  badgeEmoji: { fontSize: 28 },
  badgeIcon: {
    width: 52,
    height: 52,
  },
  badgeIconLocked: {
    opacity: 0.55,
  },
  lockCorner: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    color: colors.light.textPrimary,
    textAlign: 'center',
    width: '100%',
  },
  badgeLabelLocked: { color: colors.light.textSecondary },
  progressTrack: {
    width: '85%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(17,17,17,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#111111',
  },
});

export default AchievementsCard;
