import { Text } from '@/components';
import {
  CHALLENGE_TEMPLATES,
  useChallengeStore,
  type ChallengeTemplate,
} from '@/stores/useChallengeStore';
import { badgeArtFor, colors, radii, spacing } from '@/utils';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Lightning, Plus, Trophy } from 'phosphor-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

interface ChallengesCardProps {
  /** Max active+available to render. */
  limit?: number;
}

const daysLeft = (endsAt: string): number => {
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
};

/**
 * ChallengesCard — joinable challenges with progress bars.
 * Pattern source: Strava Challenges + Duolingo daily quests.
 */
export const ChallengesCard: React.FC<ChallengesCardProps> = ({ limit }) => {
  const active = useChallengeStore((s) => s.active);
  const totalXp = useChallengeStore((s) => s.totalXp);
  const join = useChallengeStore((s) => s.join);
  const leave = useChallengeStore((s) => s.leave);

  const available = CHALLENGE_TEMPLATES.filter((tpl) => !active.some((a) => a.templateId === tpl.id && !a.completed));
  const items = limit ? [...active.slice(0, limit)] : active;
  const availSlice = limit ? available.slice(0, Math.max(0, limit - items.length)) : available;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.iconBubble}>
            <Trophy size={16} color="#111111" weight="fill" />
          </View>
          <View>
            <Text variant="body" weight="bold" style={styles.title}>Challenges</Text>
            <Text variant="caption" style={styles.subtitle}>
              Time-bound goals with XP rewards
            </Text>
          </View>
        </View>
        <View style={styles.xpPill}>
          <Lightning size={12} color="#111111" weight="fill" />
          <Text variant="caption" weight="bold" style={styles.xpText}>{totalXp} XP</Text>
        </View>
      </View>

      {/* Active challenges with progress */}
      {items.length > 0 && (
        <View style={styles.activeList}>
          {items.map((ch) => {
            const tpl = CHALLENGE_TEMPLATES.find((t) => t.id === ch.templateId);
            if (!tpl) return null;
            const pct = Math.min(1, ch.progress / tpl.goalCount);
            return (
              <View key={ch.templateId} style={styles.activeCard}>
                <View style={styles.activeHeader}>
                  {badgeArtFor(tpl.emoji) ? (
                    <Image source={badgeArtFor(tpl.emoji)} style={styles.activeIcon as any} contentFit="contain" />
                  ) : (
                    <Text style={{ fontSize: 18 }}>{tpl.emoji}</Text>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="caption" weight="bold" numberOfLines={1} style={styles.activeTitle}>
                      {tpl.title}
                    </Text>
                    <Text variant="caption" style={styles.activeMeta} numberOfLines={1}>
                      {ch.completed
                        ? `Done · +${tpl.xpReward} XP earned`
                        : `${ch.progress}/${tpl.goalCount} · ${daysLeft(ch.endsAt)}d left`}
                    </Text>
                  </View>
                  {!ch.completed && (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        leave(ch.templateId);
                      }}
                      hitSlop={6}
                    >
                      <Text variant="caption" style={styles.leaveText}>Leave</Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, ch.completed && styles.progressFillDone, { width: `${Math.round(pct * 100)}%` }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Available challenges */}
      {availSlice.length > 0 && (
        <View style={styles.availList}>
          {availSlice.map((tpl: ChallengeTemplate) => (
            <View key={tpl.id} style={styles.availCard}>
              {badgeArtFor(tpl.emoji) ? (
                <Image source={badgeArtFor(tpl.emoji)} style={styles.availIcon as any} contentFit="contain" />
              ) : (
                <Text style={{ fontSize: 22 }}>{tpl.emoji}</Text>
              )}
              <Text variant="caption" weight="bold" style={styles.availTitle} numberOfLines={1}>{tpl.title}</Text>
              <Text variant="caption" style={styles.availDesc} numberOfLines={2}>{tpl.description}</Text>
              <View style={styles.availFooter}>
                <Text variant="caption" weight="semibold" style={styles.availReward}>+{tpl.xpReward} XP</Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    join(tpl);
                  }}
                  style={({ pressed }) => [styles.joinBtn, pressed && { opacity: 0.8 }]}
                  hitSlop={6}
                >
                  <Plus size={12} color="#FFFFFF" weight="bold" />
                  <Text variant="caption" weight="bold" style={styles.joinBtnText}>Join</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
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
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  xpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EAEAEA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  xpText: { color: '#111111' },
  activeList: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  activeCard: {
    backgroundColor: '#F6F6F6',
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activeTitle: { color: colors.light.textPrimary },
  activeMeta: { color: colors.light.textSecondary, opacity: 0.85 },
  leaveText: { color: colors.light.textSecondary, opacity: 0.7 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(17,17,17,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#111111',
  },
  progressFillDone: { backgroundColor: '#111111' },
  availList: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  activeIcon: {
    width: 36,
    height: 36,
  },
  availIcon: {
    width: 56,
    height: 56,
  },
  availCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#F6F6F6',
    borderRadius: 12,
    padding: spacing.md,
    gap: 4,
  },
  availTitle: { color: colors.light.textPrimary },
  availDesc: { color: colors.light.textSecondary, opacity: 0.85 },
  availFooter: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availReward: { color: '#111111' },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.light.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
  },
  joinBtnText: { color: '#FFFFFF' },
});

export default ChallengesCard;
