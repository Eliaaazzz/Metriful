/**
 * Contract tests for useARScale WHEN the native ARScaleModule is absent —
 * i.e. web, Expo Go, a build where the reference template hasn't been added to the
 * Xcode target yet, or Android (no ARCore equivalent wired). This is the default
 * shipping state today. The README's promise: it degrades to the plate-reference
 * fallback and NEVER fabricates a scale.
 */
import { NativeModules, Platform } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';

(Platform as any).OS = 'ios';
delete (NativeModules as any).ARScaleModule; // not built into the target

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useARScale } = require('../useARScale');

describe('useARScale (native ARScaleModule ABSENT)', () => {
  it('reports supported=false', async () => {
    const { result } = renderHook(() => useARScale());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.supported).toBe(false);
  });

  it('measure() resolves to null (caller falls back to plate scale) and never throws', async () => {
    const { result } = renderHook(() => useARScale());
    let v: number | null = -1;
    await act(async () => { v = await result.current.measure(); });
    expect(v).toBeNull();
    expect(result.current.imgWcm).toBeNull();
  });

  it('start() / stop() are safe no-ops', async () => {
    const { result } = renderHook(() => useARScale());
    await act(async () => {
      await result.current.start();
      await result.current.stop();
    });
    expect(result.current.imgWcm).toBeNull();
  });
});
