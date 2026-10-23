import React, { useCallback, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Button, SafeAreaWrapper, Text } from '@/components';
import { CoachPanel } from '@/components/CoachPanel';
import { HealthSnapshot, hasHealthSamples, isAppleHealthAvailable, readAppleHealth } from '@/services/appleHealth';
import { BRAND_COLORS, spacing, useContentBottomPadding } from '@/utils';
import { useAuthStore } from '@/stores/useAuthStore';

// Apple Health's Sources flow: explicit connection, visible readings and permission controls.
export function AppleHealthScreen() {
  const navigation = useNavigation();
  const userId = useAuthStore(state => state.userInfo?.userId);
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const epoch = useRef(0);
  const lock = useRef(false);
  const bottom = useContentBottomPadding(spacing.xl);
  const available = isAppleHealthAvailable();
  useFocusEffect(useCallback(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; epoch.current += 1; lock.current = false;
      setSnapshot(null); setBusy(false); setError('');
    };
  }, [userId]));
  async function sync() {
    if (lock.current) return;
    lock.current = true;
    const visit = epoch.current;
    setBusy(true); setError('');
    try {
      const result = await readAppleHealth(true);
      if (mounted.current && visit === epoch.current) setSnapshot(result);
    } catch {
      if (mounted.current && visit === epoch.current) setError('Could not read Apple Health. Unlock your device and check access in Health.');
    } finally {
      if (visit === epoch.current) {
        lock.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  }
  const metrics: [string, number | null | undefined, string][] = [
    ['Steps', snapshot?.steps, ''], ['Active energy', snapshot?.activeEnergyKcal, 'kcal'],
    ['Exercise', snapshot?.exerciseMinutes, 'min'], ['Sleep since midnight', snapshot?.sleepMinutes, 'min'],
    ['Latest weight today', snapshot?.weightKg, 'kg'],
  ];
  return <SafeAreaWrapper><ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom }]}>
    <Button title="Back" variant="text" onPress={() => navigation.goBack()} />
    <Text variant="heading1" weight="bold">Apple Health</Text>
    <Text muted>Bring your daily movement and recovery into view.</Text>
    <CoachPanel>
      <Text weight="semibold">You control what is shared</Text>
      <Text>Choose which activity, sleep and weight readings Metriful can read. This screen keeps your summary on this device for this visit. AI sharing is a separate choice in Coach.</Text>
      <Button title={snapshot ? 'Refresh Apple Health' : 'Connect Apple Health'} onPress={sync}
        loading={busy} disabled={!available || busy} />
      {!available && <Text muted>Open the Metriful iOS app on a supported device to connect Apple Health. A native app build is required.</Text>}
      {error !== '' && <Text color={BRAND_COLORS.error} accessibilityLiveRegion="polite">{error}</Text>}
    </CoachPanel>
    {snapshot && <CoachPanel>
      <Text variant="heading3">Today · {snapshot.date}</Text>
      {metrics.map(([label, value, unit]) => <Text key={label}>
        {label}: {value == null ? 'No readable data' : `${Math.round(value * 10) / 10} ${unit}`.trim()}
      </Text>)}
      <Text variant="caption" muted>Updated {new Date(snapshot.capturedAt).toLocaleTimeString()} · {snapshot.timeZone}</Text>
      {!hasHealthSamples(snapshot) && <Text>No readable samples yet. Check permissions and whether your watch or another app has written data today.</Text>}
    </CoachPanel>}
    <CoachPanel>
      <Text weight="semibold">Manage access</Text>
      <Text>In the Health app, open your profile, then Apps or Data Access &amp; Devices, then Metriful. You can change each permission there. Apple keeps read-permission decisions private; missing data can also mean access was declined.</Text>
      <Text muted>Sleep covers asleep intervals since local midnight, with overlapping samples counted once. Weight shows the latest sample today. Sync runs when you tap refresh.</Text>
      {available && <Button title="Open app settings" variant="outline" onPress={() => { void Linking.openSettings(); }} />}
    </CoachPanel>
  </ScrollView></SafeAreaWrapper>;
}
const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg },
});
