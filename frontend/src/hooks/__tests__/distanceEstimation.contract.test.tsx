/**
 * Contract tests for useDistanceEstimation + the device-tier wiring it reads from
 * useDeviceCapabilities.
 *
 * Central guarantee (per the hook's own docstring and the README): the expo-camera
 * fallback path CANNOT read a depth sensor, so this hook must NEVER fabricate a
 * distance — `distance` stays null unless the user sets one manually. Tier only
 * affects the accuracy LABEL.
 */
// iPhone 11 — ARKit but NO LiDAR => standard_ar tier. Defined as getters so this
// fully replaces jest-expo's built-in (empty-string) expo-device stub.
jest.mock('expo-device', () => ({
  __esModule: true,
  get modelId() { return 'iPhone12,1'; },
  get modelName() { return 'iPhone 11'; },
  get osVersion() { return '17.0'; },
  get brand() { return 'Apple'; },
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import * as Device from 'expo-device';
import { useDistanceEstimation } from '../useDistanceEstimation';

describe('useDistanceEstimation — never fabricates distance', () => {
  it('after auto-start, distance stays null (no simulated depth); status becomes ready', async () => {
    const { result } = renderHook(() => useDistanceEstimation());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.distance).toBeNull();
    expect(result.current.confidence).toBeGreaterThan(0);
  });

  it('reflects the standard_ar tier label (±3cm) for an ARKit/no-LiDAR device', async () => {
    const { result } = renderHook(() => useDistanceEstimation());
    await waitFor(() => expect(result.current.deviceTier).toBe('standard_ar'));
    expect(result.current.accuracy).toBe('±3cm');
  });

  it('setManualDistance enforces min/max and fires onReady inside the band', async () => {
    const onReady = jest.fn();
    const { result } = renderHook(() =>
      useDistanceEstimation({ minDistance: 20, maxDistance: 60, onReady })
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => result.current.setManualDistance(10));
    expect(result.current.status).toBe('too_close');

    act(() => result.current.setManualDistance(100));
    expect(result.current.status).toBe('too_far');

    act(() => result.current.setManualDistance(35));
    expect(result.current.status).toBe('ready');
    expect(result.current.distance).toBe(35);
    expect(onReady).toHaveBeenCalledWith(35);
  });
});
