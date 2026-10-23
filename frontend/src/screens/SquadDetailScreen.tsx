/**
 * SquadDetailScreen — single squad header + members + 7-day leaderboard.
 *
 * Implements US-1.4 (leaderboard) and US-1.5 (leave) from issue #220.
 */
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { CaretLeft, ShareNetwork, SignOut } from 'phosphor-react-native';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BentoCard } from '@/components/common/BentoCard';
import SquadStreakHeader from '@/components/squads/SquadStreakHeader';
import { Text } from '@/components/Text';
import { squadsApi } from '@/services/squadsApi';
import { useAuthStore } from '@/stores/useAuthStore';
import { BRAND_COLORS, spacing } from '@/utils';

type Params = { SquadDetail: { squadId: string } };

export function SquadDetailScreen() {
  const userId = useAuthStore((s) => s.userInfo?.userId);
  const route = useRoute<RouteProp<Params, 'SquadDetail'>>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { squadId } = route.params;

  const detailQuery = useQuery({
    queryKey: ['squads', userId, 'detail', squadId],
    queryFn: () => squadsApi.detail(squadId),
    enabled: !!userId,
  });

  const leaderboardQuery = useQuery({
    queryKey: ['squads', userId, 'leaderboard', squadId],
    queryFn: () => squadsApi.leaderboard(squadId),
    enabled: !!userId,
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min while open (per AC-4)
  });

  const leaveMutation = useMutation({
    mutationFn: () => squadsApi.leave(squadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['squads', userId] });
      navigation.goBack();
    },
  });

  const handleShare = useCallback(async () => {
    if (!detailQuery.data) return;
    const { name, inviteCode } = detailQuery.data.squad;
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    try {
      await Share.share({
        message: `Join my AuraFitness squad "${name}" — code ${inviteCode}`,
      });
    } catch {
      /* user cancelled */
    }
  }, [detailQuery.data]);

  const handleLeave = useCallback(() => {
    Alert.alert(
      'Leave squad?',
      'You can rejoin later with the invite code if you change your mind.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => leaveMutation.mutate() },
      ],
    );
  }, [leaveMutation]);

  if (!userId) return null;

  if (detailQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={BRAND_COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text variant="caption" style={styles.error}>Could not load squad.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { squad, members } = detailQuery.data;
  const leaderboard = leaderboardQuery.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.iconButton}>
          <CaretLeft size={20} color={BRAND_COLORS.textPrimary} weight="bold" />
        </Pressable>
        <Pressable onPress={handleLeave} hitSlop={8} style={styles.iconButton}>
          <SignOut size={18} color={BRAND_COLORS.danger} weight="bold" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <SquadStreakHeader
          emoji={squad.emoji}
          name={squad.name}
          currentStreak={squad.currentStreak}
          longestStreak={squad.longestStreak}
          memberCount={squad.memberCount}
        />

        <Pressable onPress={handleShare} style={styles.codeRow}>
          <Text variant="caption" style={styles.codeLabel}>INVITE CODE</Text>
          <Text variant="body" weight="bold" style={styles.codeValue}>{squad.inviteCode}</Text>
          <ShareNetwork size={14} color={BRAND_COLORS.textMuted} weight="bold" />
        </Pressable>

        <Text variant="caption" weight="medium" style={styles.sectionLabel}>7-DAY LEADERBOARD</Text>
        <BentoCard>
          {leaderboardQuery.isLoading ? (
            <ActivityIndicator color={BRAND_COLORS.primary} />
          ) : leaderboard.length === 0 ? (
            <Text variant="caption" style={styles.muted}>No activity in the last 7 days.</Text>
          ) : (
            <View style={styles.leaderboardList}>
              {leaderboard.map((entry) => (
                <View key={entry.userId} style={styles.leaderRow}>
                  <Text variant="body" weight="bold" style={styles.rank}>
                    {entry.warmingUp ? '–' : `#${entry.rank}`}
                  </Text>
                  <Text variant="body" style={styles.rowName} numberOfLines={1}>
                    {shortId(entry.userId)}
                  </Text>
                  <Text variant="caption" style={styles.rowMeta}>
                    {entry.warmingUp
                      ? 'Warming up'
                      : `${entry.mealsLogged} meals · ${entry.daysActive}d active`}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </BentoCard>

        <Text variant="caption" weight="medium" style={styles.sectionLabel}>
          MEMBERS · {members.length}
        </Text>
        <BentoCard>
          <View style={styles.memberList}>
            {members.map((m) => (
              <View key={m.userId} style={styles.memberRow}>
                <Text variant="body" style={styles.memberName} numberOfLines={1}>{shortId(m.userId)}</Text>
                <Text variant="caption" style={styles.memberRole}>{m.role.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </BentoCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function shortId(uuid: string): string {
  return uuid.slice(0, 8);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND_COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  iconButton: { padding: spacing.xs },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  codeLabel: { color: BRAND_COLORS.textMuted, letterSpacing: 1.2, fontSize: 10 },
  codeValue: { letterSpacing: 1.4, fontVariant: ['tabular-nums'] },
  sectionLabel: {
    color: BRAND_COLORS.textMuted,
    letterSpacing: 1.2,
    fontSize: 10,
    marginTop: spacing.sm,
  },
  leaderboardList: { gap: spacing.sm },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rank: { width: 32, color: BRAND_COLORS.primary, fontVariant: ['tabular-nums'] },
  rowName: { flex: 1, fontVariant: ['tabular-nums'] },
  rowMeta: { color: BRAND_COLORS.textMuted, fontSize: 11 },
  memberList: { gap: spacing.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memberName: { flex: 1, fontVariant: ['tabular-nums'] },
  memberRole: { color: BRAND_COLORS.textMuted, letterSpacing: 1, fontSize: 10 },
  muted: { color: BRAND_COLORS.textMuted },
  error: { color: BRAND_COLORS.danger },
});

export default SquadDetailScreen;
