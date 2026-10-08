import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

jest.mock('../../../modules/metriful-lidar', () => ({
  isArPlaneAvailable: jest.fn(),
  measureArPlane: jest.fn(),
}));

import { isArPlaneAvailable, measureArPlane } from '../../../modules/metriful-lidar';
import { useARScale } from '@/hooks/useARScale';

const mockAvailable = isArPlaneAvailable as jest.Mock;
const mockMeasure = measureArPlane as jest.Mock;

describe('useARScale', () => {
  let latest: ReturnType<typeof useARScale> | null = null;
  let renderer: ReactTestRenderer | null = null;

  const HookProbe = () => {
    latest = useARScale();
    return null;
  };

  const mount = async () => {
    await act(async () => {
      renderer = create(<HookProbe />);
    });
  };

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
    latest = null;
    jest.resetAllMocks();
  });

  it('reports availability from the native module', async () => {
    mockAvailable.mockReturnValue(true);
    await mount();
    expect(latest!.available).toBe(true);
  });

  it('converts a plane reading to img_w_cm with the pinhole formula', async () => {
    mockAvailable.mockReturnValue(true);
    // 30cm away, 1920px wide, fx 1500px → 30 * 1920 / 1500 = 38.4cm
    mockMeasure.mockResolvedValue({
      hasScale: true, distanceCm: 30, fx: 1500, width: 1920, confidence: 0.8, samples: 5,
    });
    await mount();
    const r = await latest!.measure();
    expect(r.imgWidthCm).toBe(38.4);
    expect(r.distanceCm).toBe(30);
    expect(r.confidence).toBe(0.8);
  });

  it('returns null scale when no plane was found', async () => {
    mockAvailable.mockReturnValue(true);
    mockMeasure.mockResolvedValue({ hasScale: false, reason: 'no_plane' });
    await mount();
    const r = await latest!.measure();
    expect(r.imgWidthCm).toBeNull();
    expect(r.distanceCm).toBeNull();
    expect(r.raw?.reason).toBe('no_plane');
  });

  it('refuses to guess when intrinsics are missing', async () => {
    mockAvailable.mockReturnValue(true);
    mockMeasure.mockResolvedValue({ hasScale: true, distanceCm: 30, confidence: 0.8 });
    await mount();
    const r = await latest!.measure();
    expect(r.imgWidthCm).toBeNull();
    expect(r.confidence).toBe(0);
  });
});
