import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { formatLocalDateKey } from '@/utils/date';

export interface HealthSnapshot {
  date: string;
  timeZone: string;
  capturedAt: string;
  steps: number | null;
  activeEnergyKcal: number | null;
  exerciseMinutes: number | null;
  sleepMinutes: number | null;
  weightKg: number | null;
}

interface HealthModule {
  isAvailable(): boolean;
  requestAuthorization(): Promise<boolean>;
  readDailySummary(date: string): Promise<HealthSnapshot>;
}

const native = Platform.OS === 'ios'
  ? requireOptionalNativeModule<HealthModule>('MetrifulHealth') : null;

export function isAppleHealthAvailable(): boolean {
  return native?.isAvailable() ?? false;
}

export async function readAppleHealth(requestPermissions = false): Promise<HealthSnapshot> {
  if (!native || !native.isAvailable()) {
    throw new Error('Apple Health requires the Metriful iOS app on a supported device.');
  }
  if (requestPermissions && !(await native.requestAuthorization())) {
    throw new Error('Apple Health is unavailable on this device.');
  }
  return native.readDailySummary(formatLocalDateKey(new Date()));
}

export function hasHealthSamples(snapshot: HealthSnapshot): boolean {
  return [snapshot.steps, snapshot.activeEnergyKcal, snapshot.exerciseMinutes,
    snapshot.sleepMinutes, snapshot.weightKg].some(value => value !== null);
}
