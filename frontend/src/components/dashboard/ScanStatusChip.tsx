/**
 * ScanStatusChip — Uber-Eats "order tracking" chip for a backgrounded meal scan.
 *
 * Rendered on the Dashboard. Shows nothing unless a scan is running, finished-but-unreviewed,
 * or failed. Tapping reopens ReviewMeal bound to that scan ({ scanId } route param).
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight, CheckCircle, WarningCircle } from 'phosphor-react-native';

import { Text } from '@/components/Text';
import { useScanStore } from '@/stores';
import { BRAND_COLORS } from '@/utils';

export function ScanStatusChip() {
  const navigation = useNavigation<any>();
  const scan = useScanStore((s) => s.scan);
  const running = scan?.status === 'compressing' || scan?.status === 'analyzing';

  // Light 1s tick so the elapsed label stays honest while running.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  if (!scan || scan.consumed) {
    return null;
  }

  const openScan = () => navigation.navigate('ReviewMeal', { scanId: scan.scanId });

  let icon: React.ReactNode;
  let title: string;
  let caption: string;

  if (running) {
    const elapsed = Math.max(1, Math.round((Date.now() - scan.startedAt) / 1000));
    icon = <ActivityIndicator size="small" color={BRAND_COLORS.primaryDark} />;
    title = `${scan.mealSlot} scan is almost ready`;
    caption = `Analyzing for ${elapsed}s — tap to watch progress`;
  } else if (scan.status === 'ready') {
    icon = <CheckCircle size={22} color={BRAND_COLORS.semantic.success} weight="fill" />;
    title = `${scan.mealSlot} scan is ready`;
    caption = 'Tap to review and save';
  } else {
    icon = <WarningCircle size={22} color={BRAND_COLORS.semantic.warning} weight="fill" />;
    title = `${scan.mealSlot} scan needs attention`;
    caption = 'Tap to retry or pick another photo';
  }

  return (
    <Pressable
      onPress={openScan}
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${caption}`}
    >
      <View style={styles.icon}>{icon}</View>
      <View style={styles.copy}>
        <Text variant="body" weight="semibold" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" style={styles.caption} numberOfLines={1}>
          {caption}
        </Text>
      </View>
      <ArrowRight size={18} color={BRAND_COLORS.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND_COLORS.border,
    backgroundColor: BRAND_COLORS.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  icon: {
    width: 28,
    alignItems: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: BRAND_COLORS.textPrimary,
  },
  caption: {
    color: BRAND_COLORS.textMuted,
    marginTop: 1,
  },
});

export default ScanStatusChip;
