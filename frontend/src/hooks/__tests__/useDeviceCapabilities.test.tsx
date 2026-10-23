/**
 * Regression tests for device-tier classification.
 *
 * Guards the fixes that removed non-LiDAR iPhones from the LiDAR list, switched to
 * exact model-id matching, added the iPad Pro 12.9" 5th-gen ids, and relabeled the
 * depth tier so Android ToF devices aren't called "LiDAR".
 */
import { Platform } from 'react-native';
import { renderHook, waitFor } from '@testing-library/react-native';

// Mutable expo-device stand-in (getters fully replace jest-expo's empty stub).
const mockState = { modelId: '', modelName: '', osVersion: '17.0', brand: 'Apple' };
jest.mock('expo-device', () => ({
  __esModule: true,
  get modelId() { return mockState.modelId; },
  get modelName() { return mockState.modelName; },
  get osVersion() { return mockState.osVersion; },
  get brand() { return mockState.brand; },
}));

import { useDeviceCapabilities, getTierDescription } from '../useDeviceCapabilities';

describe('useDeviceCapabilities tiering', () => {
  beforeEach(() => {
    (Platform as any).OS = 'ios';
    mockState.modelId = '';
    mockState.modelName = '';
    mockState.osVersion = '17.0';
    mockState.brand = 'Apple';
  });

  it('iPhone 15 Pro Max (iPhone15,3) -> lidar tier', async () => {
    mockState.modelId = 'iPhone15,3';
    const { result } = renderHook(() => useDeviceCapabilities());
    await waitFor(() => expect(result.current.tier).toBe('lidar'));
    expect(result.current.hasLiDAR).toBe(true);
    expect(result.current.estimatedAccuracy).toBe('< 1%');
  });

  it('iPhone 13 (iPhone14,5) -> standard_ar, NOT lidar (it has no LiDAR)', async () => {
    mockState.modelId = 'iPhone14,5';
    const { result } = renderHook(() => useDeviceCapabilities());
    await waitFor(() => expect(result.current.tier).toBe('standard_ar'));
    expect(result.current.hasLiDAR).toBe(false);
  });

  it('iPad Pro 12.9" 5th gen (iPad13,8) -> lidar tier', async () => {
    mockState.modelId = 'iPad13,8';
    const { result } = renderHook(() => useDeviceCapabilities());
    await waitFor(() => expect(result.current.tier).toBe('lidar'));
    expect(result.current.hasLiDAR).toBe(true);
  });

  it('Galaxy S23 Ultra (SM-S918, ToF) -> high tier but NOT labeled LiDAR', async () => {
    (Platform as any).OS = 'android';
    mockState.modelId = 'SM-S918B';
    mockState.modelName = 'Galaxy S23 Ultra';
    mockState.osVersion = '14';
    mockState.brand = 'samsung';
    const { result } = renderHook(() => useDeviceCapabilities());
    await waitFor(() => expect(result.current.hasToF).toBe(true));
    expect(result.current.tier).toBe('lidar'); // shared high-accuracy depth tier
    expect(getTierDescription(result.current.tier)).toBe('Pro Accuracy (Depth Sensor)');
  });

  it('getTierDescription no longer claims LiDAR for the depth tier', () => {
    expect(getTierDescription('lidar')).toBe('Pro Accuracy (Depth Sensor)');
    expect(getTierDescription('standard_ar')).toBe('Standard Accuracy (AR)');
    expect(getTierDescription('basic')).toBe('Basic Mode');
  });
});
