/**
 * SquadsScreen — list of the user's squads, with create/join CTAs.
 *
 * Implements user stories US-1.1 / 1.2 / 1.3 from issue #220 (lifecycle).
 * The detail/leaderboard surface lives in {@link SquadDetailScreen}.
 */
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserPlus } from 'phosphor-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import JoinSquadModal from '@/components/squads/JoinSquadModal';
import SquadCard from '@/components/squads/SquadCard';
import SquadCreateModal from '@/components/squads/SquadCreateModal';
import { Text } from '@/components/Text';
import { squadsApi } from '@/services/squadsApi';
import { useAuthStore } from '@/stores/useAuthStore';
import type { Squad } from '@/types/squads';
import { BRAND_COLORS, spacing } from '@/utils';

export function SquadsScreen() {
  const userId = useAuthStore((s) => s.userInfo?.userId);
  const queryKey = ['squads', userId, 'list'] as const;
  const navigation = useNavigation<StackNavigationProp<any>>();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey,
    queryFn: squadsApi.list,
    enabled: !!userId,
    staleTime: 30_000,
  });

  const onSquadCreated = useCallback(
    (squad: Squad) => {
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey });
      navigation.navigate('SquadDetail', { squadId: squad.id });
    },
    [navigation, queryClient, userId],
  );

  const onSquadJoined = useCallback(
    (squad: Squad) => {
      setJoinOpen(false);
      queryClient.invalidateQueries({ queryKey });
      navigation.navigate('SquadDetail', { squadId: squad.id });
    },
    [navigation, queryClient, userId],
  );

  const onCardPress = useCallback(
    (squad: Squad) => navigation.navigate('SquadDetail', { squadId: squad.id }),
    [navigation],
  );

  const squads = data ?? [];
  const showEmpty = !isLoading && squads.length === 0;

  if (!userId) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text variant="heading2" weight="bold" style={styles.h1}>Squads</Text>
        <Text variant="caption" style={styles.subtitle}>
          Log alongside friends. Anyone logging keeps the streak alive.
        </Text>
      </View>

      <View style={styles.ctaRow}>
        <Pressable style={[styles.cta, styles.ctaPrimary]} onPress={() => setCreateOpen(true)}>
          <Plus size={16} color="#FFFFFF" weight="bold" />
          <Text variant="body" weight="bold" style={styles.ctaPrimaryText}>Create</Text>
        </Pressable>
        <Pressable style={[styles.cta, styles.ctaSecondary]} onPress={() => setJoinOpen(true)}>
          <UserPlus size={16} color={BRAND_COLORS.textPrimary} weight="bold" />
          <Text variant="body" weight="bold" style={styles.ctaSecondaryText}>Join with code</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={BRAND_COLORS.primary} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text variant="caption" style={styles.error}>Could not load squads. Pull to retry.</Text>
        </View>
      ) : showEmpty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🌅</Text>
          <Text variant="body" weight="bold" style={{ marginTop: spacing.sm }}>No squads yet</Text>
          <Text variant="caption" style={styles.emptyHint}>
            Create one to invite friends, or join with a 6-character code.
          </Text>
        </View>
      ) : (
        <FlatList
          data={squads}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => <SquadCard squad={item} onPress={onCardPress} />}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={BRAND_COLORS.primary} />
          }
        />
      )}

      <SquadCreateModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={onSquadCreated}
      />
      <JoinSquadModal
        visible={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={onSquadJoined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND_COLORS.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: 4 },
  h1: { fontSize: 28 },
  subtitle: { color: BRAND_COLORS.textMuted },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  cta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
  },
  ctaPrimary: { backgroundColor: BRAND_COLORS.primary },
  ctaPrimaryText: { color: '#FFFFFF' },
  ctaSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  ctaSecondaryText: { color: BRAND_COLORS.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyEmoji: { fontSize: 56 },
  emptyHint: { textAlign: 'center', color: BRAND_COLORS.textMuted, marginTop: spacing.xs },
  error: { color: BRAND_COLORS.danger, textAlign: 'center', paddingHorizontal: spacing.xl },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
});

export default SquadsScreen;
