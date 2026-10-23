/**
 * ScanStagesList — Uber-Eats-style process visibility for the meal scan.
 *
 * Replaces "infinite spinner anxiety" with a staged checklist (done ✓ / active / pending),
 * an honest ETA ("~4s left" → "Almost there — finishing up" when overdue), and an optional
 * "Continue in background" escape hatch so a slow analysis never traps the user on this screen.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'phosphor-react-native';

import { Text } from '@/components/Text';
import { BRAND_COLORS } from '@/utils';
import { deriveScanStages, ScanStatus } from '@/utils/scanStages';

interface ScanStagesListProps {
  status: ScanStatus;
  startedAt: number | null;
  expectedMs: number;
  onContinueInBackground?: () => void;
}

export function ScanStagesList({
  status,
  startedAt,
  expectedMs,
  onContinueInBackground,
}: ScanStagesListProps) {
  // 1s tick keeps the ETA countdown and simulated sub-stages moving.
  const [now, setNow] = useState(() => Date.now());
  const running = status === 'compressing' || status === 'analyzing';

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const elapsedMs = startedAt ? Math.max(0, now - startedAt) : 0;
  const view = deriveScanStages(status, elapsedMs, expectedMs);
  const etaLabel = view.overdue
    ? 'Almost there — finishing up'
    : view.etaSeconds != null
      ? `About ${view.etaSeconds}s left`
      : null;

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      {view.stages.map((stage) => (
        <View key={stage.key} style={styles.row}>
          <View
            style={[
              styles.dot,
              stage.state === 'done' && styles.dotDone,
              stage.state === 'active' && styles.dotActive,
            ]}
          >
            {stage.state === 'done' ? (
              <Check size={12} color="#FFFFFF" weight="bold" />
            ) : stage.state === 'active' ? (
              <ActivityIndicator size={10} color={BRAND_COLORS.primaryDark} />
            ) : null}
          </View>
          <Text
            variant="body"
            weight={stage.state === 'active' ? 'semibold' : 'regular'}
            style={[
              styles.label,
              stage.state === 'pending' && styles.labelPending,
              stage.state === 'active' && styles.labelActive,
            ]}
          >
            {stage.label}
          </Text>
        </View>
      ))}

      {etaLabel != null && running && (
        <Text variant="caption" style={styles.eta} accessibilityLabel={`Estimated time: ${etaLabel}`}>
          {etaLabel}
        </Text>
      )}

      {running && onContinueInBackground && (
        <Pressable
          onPress={onContinueInBackground}
          style={({ pressed }) => [styles.backgroundBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Continue in background and return to home"
        >
          <Text variant="body" weight="semibold" style={styles.backgroundBtnText}>
            Continue in background
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  dotDone: {
    backgroundColor: BRAND_COLORS.secondary,
    borderColor: BRAND_COLORS.secondary,
  },
  dotActive: {
    borderColor: BRAND_COLORS.primaryDark,
  },
  label: {
    color: '#0F172A',
    flex: 1,
  },
  labelPending: {
    color: '#94A3B8',
  },
  labelActive: {
    color: BRAND_COLORS.primaryDark,
  },
  eta: {
    color: '#64748B',
    marginTop: 2,
  },
  backgroundBtn: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  backgroundBtnText: {
    color: '#0F172A',
  },
});

export default ScanStagesList;
