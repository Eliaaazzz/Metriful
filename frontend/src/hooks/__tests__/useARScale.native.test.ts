/**
 * Contract tests for useARScale WHEN the native ARScaleModule is present.
 *
 * These exercise the JS bridge that the native ARKit reference template
 * (native-depth-plugin/ios/ARScaleModule.swift) talks to. They cannot exercise
 * ARKit itself (needs a real device) — they pin the SAFETY CONTRACT the README
 * promises: a scale number only ever propagates when the native side reports a
 * finite, real measurement. Anything else degrades to null (plate fallback).
 *
 * NOTE: the hook captures `NativeModules.ARScaleModule` at module-eval time, so we
 * install the mock BEFORE require()-ing the hook (jest isolates module state per file).
 */
import { NativeModules, Platform } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import type { UseARScale } from '../useARScale';

(Platform as any).OS = 'ios';
const measure = jest.fn();
const start = jest.fn().mockResolvedValue(true);
const stop = jest.fn().mockResolvedValue(true);
const isSupported = jest.fn().mockResolvedValue(true);
(NativeModules as any).ARScaleModule = { isSupported, start, stop, measure };

// Typed require (after the mock is installed) so renderHook keeps its generics.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useARScale } = require('../useARScale') as typeof import('../useARScale');

describe('useARScale (native ARScaleModule present)', () => {
  beforeEach(() => {
    measure.mockReset();
    start.mockClear().mockResolvedValue(true);
    stop.mockClear().mockResolvedValue(true);
    isSupported.mockClear().mockResolvedValue(true);
  });

  it('propagates a finite imgWcm when the plane raycast succeeds', async () => {
    measure.mockResolvedValue({ hasScale: true, imgWcm: 32.5, distanceCm: 28, fx: 1500 });
    const { result } = renderHook(() => useARScale());
    let v: number | null = -1;
    await act(async () => { v = await result.current.measure(); });
    expect(v).toBe(32.5);
    expect(result.current.imgWcm).toBe(32.5);
  });

  it('NEVER fabricates: hasScale=false -> null', async () => {
    measure.mockResolvedValue({ hasScale: false });
    const { result } = renderHook(() => useARScale());
    let v: number | null = -1;
    await act(async () => { v = await result.current.measure(); });
    expect(v).toBeNull();
    expect(result.current.imgWcm).toBeNull();
  });

  it('NEVER fabricates: non-finite imgWcm (NaN / Infinity) -> null', async () => {
    const { result } = renderHook(() => useARScale());
    let nanV: number | null = -1;
    let infV: number | null = -1;
    measure.mockResolvedValueOnce({ hasScale: true, imgWcm: NaN });
    await act(async () => { nanV = await result.current.measure(); });
    measure.mockResolvedValueOnce({ hasScale: true, imgWcm: Infinity });
    await act(async () => { infV = await result.current.measure(); });
    expect(nanV).toBeNull();
    expect(infV).toBeNull();
  });

  it('NEVER fabricates: null/missing imgWcm -> null', async () => {
    measure.mockResolvedValue({ hasScale: true, imgWcm: null });
    const { result } = renderHook(() => useARScale());
    let v: number | null = -1;
    await act(async () => { v = await result.current.measure(); });
    expect(v).toBeNull();
  });

  it('plausibility gate: out-of-range imgWcm (far-wall / too-close raycast) -> null', async () => {
    const { result } = renderHook(() => useARScale());
    let tooFar: number | null = -1;
    let tooClose: number | null = -1;
    measure.mockResolvedValueOnce({ hasScale: true, imgWcm: 220 });
    await act(async () => { tooFar = await result.current.measure(); });
    measure.mockResolvedValueOnce({ hasScale: true, imgWcm: 4 });
    await act(async () => { tooClose = await result.current.measure(); });
    expect(tooFar).toBeNull();
    expect(tooClose).toBeNull();
  });

  it('plausibility gate: accepts the documented 12-90 cm boundaries', async () => {
    const { result } = renderHook(() => useARScale());
    let lo: number | null = -1;
    let hi: number | null = -1;
    measure.mockResolvedValueOnce({ hasScale: true, imgWcm: 12 });
    await act(async () => { lo = await result.current.measure(); });
    measure.mockResolvedValueOnce({ hasScale: true, imgWcm: 90 });
    await act(async () => { hi = await result.current.measure(); });
    expect(lo).toBe(12);
    expect(hi).toBe(90);
  });

  it('restarts cleanly after an enabled toggle (cleanup resets the start guard)', async () => {
    const { result, rerender } = renderHook<UseARScale, { enabled: boolean }>(
      ({ enabled }) => useARScale(enabled),
      { initialProps: { enabled: true } }
    );
    await act(async () => { await result.current.start(); });
    expect(start).toHaveBeenCalledTimes(1);
    // Disable -> effect cleanup must stop the session AND reset the guard.
    await act(async () => { rerender({ enabled: false }); });
    expect(stop).toHaveBeenCalled();
    // Re-enable and start again -> must actually restart (was broken before the fix).
    await act(async () => { rerender({ enabled: true }); });
    await act(async () => { await result.current.start(); });
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('swallows a native measure() rejection -> null (no throw to caller)', async () => {
    measure.mockRejectedValue(new Error('AR session interrupted'));
    const { result } = renderHook(() => useARScale());
    let v: number | null = -1;
    await act(async () => { v = await result.current.measure(); });
    expect(v).toBeNull();
  });

  it('reports supported=true when the device reports ARWorldTracking support', async () => {
    const { result } = renderHook(() => useARScale());
    await waitFor(() => expect(result.current.supported).toBe(true));
  });

  it('start() is idempotent and stop() releases the session', async () => {
    const { result } = renderHook(() => useARScale());
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.start(); });
    expect(start).toHaveBeenCalledTimes(1); // guarded by started ref
    await act(async () => { await result.current.stop(); });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('releases a session whose startup resolves after unmount', async () => {
    let finishStart!: (value: boolean) => void;
    start.mockImplementationOnce(() => new Promise<boolean>((resolve) => { finishStart = resolve; }));
    const { result, unmount } = renderHook(() => useARScale());
    const pendingStart = result.current.start();
    await act(async () => { await Promise.resolve(); });
    unmount();
    await act(async () => {
      finishStart(true);
      await pendingStart;
      await Promise.resolve();
    });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('allows retry when native startup reports false', async () => {
    start.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useARScale());
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.start(); });
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('does not start while disabled', async () => {
    const { result } = renderHook(() => useARScale(false));
    await act(async () => { await result.current.start(); });
    expect(start).not.toHaveBeenCalled();
    expect(result.current.supported).toBe(false);
  });

  it('clears a previous scale when tracking loses the plane', async () => {
    measure.mockResolvedValueOnce({ hasScale: true, imgWcm: 32 });
    const { result } = renderHook(() => useARScale());
    await act(async () => { await result.current.measure(); });
    expect(result.current.imgWcm).toBe(32);
    measure.mockResolvedValueOnce({ hasScale: false });
    await act(async () => { await result.current.measure(); });
    expect(result.current.imgWcm).toBeNull();
  });
});
