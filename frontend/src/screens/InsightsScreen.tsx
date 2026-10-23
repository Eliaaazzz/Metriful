/**
 * InsightsScreen — surfaces the user's habit↔Daily-Score correlations.
 *
 * - Cold-start: <30 logged days → onboarding card with progress bar.
 * - Otherwise: scrollable list of {@link InsightCard} sorted by absolute delta
 *   (pinned first), each carrying the AI disclaimer.
 */
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CaretLeft, ArrowsClockwise } from 'phosphor-react-native';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InsightCard } from '@/components/insights/InsightCard';
import { InsightsOnboardingCard } from '@/components/insights/InsightsOnboardingCard';
import { Text } from '@/components/Text';
import { insightsApi } from '@/services/insightsApi';
import { useAuthStore } from '@/stores/useAuthStore';
import type { Insight } from '@/types/insights';
import { BRAND_COLORS, spacing } from '@/utils';

export function InsightsScreen() {
  const userId = useAuthStore((s) => s.userInfo?.userId);
  const listKey = ['insights', userId, 'list'] as const;
  const coldKey = ['insights', userId, 'coldStart'] as const;
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const coldStart = useQuery({
    queryKey: coldKey,
    queryFn: insightsApi.coldStart,
    enabled: !!userId,
    staleTime: 60_000,
  });

  const list = useQuery({
    queryKey: listKey,
    queryFn: insightsApi.list,
    enabled: !!userId && (coldStart.data?.unlocked ?? false),
    staleTime: 60_000,
  });

  const pinMutation = useMutation({
    mutationFn: (insight: Insight) =>
      insight.pinned ? insightsApi.unpin(insight.id) : insightsApi.pin(insight.id),
    onMutate: async (insight) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const prev = queryClient.getQueryData<Insight[]>(listKey);
      queryClient.setQueryData<Insight[]>(listKey, (old) =>
        (old ?? []).map((i) => (i.id === insight.id ? { ...i, pinned: !i.pinned } : i)),
      );
      return { prev };
    },
    onError: (_err, _insight, context) => {
      if (context?.prev) queryClient.setQueryData(listKey, context.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });

  const recomputeMutation = useMutation({
    mutationFn: insightsApi.recompute,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
      queryClient.invalidateQueries({ queryKey: coldKey });
    },
  });

  const handleTogglePin = useCallback(
    (insight: Insight) => pinMutation.mutate(insight),
    [pinMutation],
  );

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: listKey });
    queryClient.invalidateQueries({ queryKey: coldKey });
  }, [queryClient, userId]);

  const isLoading = coldStart.isLoading || (coldStart.data?.unlocked && list.isLoading);
  const insights = list.data ?? [];

  if (!userId) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.iconButton}>
          <CaretLeft size={20} color={BRAND_COLORS.textPrimary} weight="bold" />
        </Pressable>
        <Pressable
          onPress={() => recomputeMutation.mutate()}
          hitSlop={8}
          style={styles.iconButton}
          disabled={recomputeMutation.isPending}
        >
          {recomputeMutation.isPending
            ? <ActivityIndicator color={BRAND_COLORS.textMuted} />
            : <ArrowsClockwise size={18} color={BRAND_COLORS.textMuted} weight="bold" />}
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text variant="heading2" weight="bold" style={styles.h1}>Behavior Insights</Text>
        <Text variant="caption" style={styles.subtitle}>
          Which of your habits actually moves your Daily Score.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={BRAND_COLORS.primary} /></View>
      ) : !coldStart.data?.unlocked && coldStart.data ? (
        <View style={styles.padded}>
          <InsightsOnboardingCard status={coldStart.data} />
        </View>
      ) : insights.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text variant="body" weight="bold" style={{ marginTop: spacing.sm }}>
            Nothing significant yet
          </Text>
          <Text variant="caption" style={styles.emptyHint}>
            Once we have enough yes/no days for a behavior, we&apos;ll surface insights here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={insights}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <InsightCard insight={item} onTogglePin={handleTogglePin} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching}
              onRefresh={handleRefresh}
              tintColor={BRAND_COLORS.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND_COLORS.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  iconButton: { padding: spacing.xs },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: 4,
  },
  h1: { fontSize: 26 },
  subtitle: { color: BRAND_COLORS.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: { fontSize: 56 },
  emptyHint: {
    textAlign: 'center',
    color: BRAND_COLORS.textMuted,
    marginTop: spacing.xs,
  },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
});

export default InsightsScreen;
