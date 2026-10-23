jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-modules-core', () => {
  const native = { isAvailable: jest.fn(() => true), requestAuthorization: jest.fn(), readDailySummary: jest.fn() };
  return { requireOptionalNativeModule: () => native, native };
});
jest.mock('@/utils/date', () => ({ formatLocalDateKey: () => '2026-10-23' }));
import { hasHealthSamples, readAppleHealth, HealthSnapshot } from '../appleHealth';
const mockNative = jest.requireMock('expo-modules-core').native;

const empty: HealthSnapshot = {
  date: '2026-10-23', timeZone: 'Australia/Sydney', capturedAt: '2026-10-23T04:00:00Z',
  steps: null, activeEnergyKcal: null, exerciseMinutes: null, sleepMinutes: null, weightKg: null,
};
beforeEach(() => { jest.clearAllMocks(); mockNative.isAvailable.mockReturnValue(true); });

test('a completed authorization sheet can still return no readable samples', async () => {
  mockNative.requestAuthorization.mockResolvedValue(true);
  mockNative.readDailySummary.mockResolvedValue(empty);
  expect(await readAppleHealth(true)).toEqual(empty);
  expect(hasHealthSamples(empty)).toBe(false);
  expect(hasHealthSamples({ ...empty, steps: 0 })).toBe(true);
});

test('does not query data on unavailable devices', async () => {
  mockNative.isAvailable.mockReturnValue(false);
  await expect(readAppleHealth(true)).rejects.toThrow('requires the Metriful iOS app');
  expect(mockNative.readDailySummary).not.toHaveBeenCalled();
});
