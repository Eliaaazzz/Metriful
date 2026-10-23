import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppleHealthScreen } from '../AppleHealthScreen';
import { isAppleHealthAvailable, readAppleHealth, HealthSnapshot } from '@/services/appleHealth';

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return { useNavigation: () => ({ goBack: jest.fn() }),
    useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]) };
});
jest.mock('@/stores/useAuthStore', () => ({ useAuthStore: () => 'test-user' }));
jest.mock('@/services/appleHealth', () => ({
  isAppleHealthAvailable: jest.fn(), readAppleHealth: jest.fn(),
  hasHealthSamples: (value: { steps: number | null }) => value.steps !== null,
}));
jest.mock('@/utils', () => ({
  BRAND_COLORS: { error: 'red' }, spacing: { lg: 16, xl: 24 }, useContentBottomPadding: () => 24,
}));
jest.mock('@/components/CoachPanel', () => ({ CoachPanel: require('react-native').View }));
jest.mock('@/components', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return { SafeAreaWrapper: View, Text,
    Button: ({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) =>
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} disabled={disabled}>
        <Text>{title}</Text>
      </Pressable> };
});

const available = isAppleHealthAvailable as jest.MockedFunction<typeof isAppleHealthAvailable>;
const read = readAppleHealth as jest.MockedFunction<typeof readAppleHealth>;
const empty: HealthSnapshot = {
  date: '2026-10-23', timeZone: 'Australia/Sydney', capturedAt: '2026-10-23T04:00:00Z',
  steps: null, activeEnergyKcal: null, exerciseMinutes: null, sleepMinutes: null, weightKg: null,
};
beforeEach(() => { jest.clearAllMocks(); available.mockReturnValue(true); read.mockResolvedValue(empty); });

test('does not request Health permission until the user connects', () => {
  render(<AppleHealthScreen />);
  expect(read).not.toHaveBeenCalled();
});

test('shows missing samples when the authorization sheet returns without readable data', async () => {
  const screen = render(<AppleHealthScreen />);
  fireEvent.press(screen.getByLabelText('Connect Apple Health'));
  await waitFor(() => expect(screen.getByText(/No readable samples yet/)).toBeTruthy());
  expect(read).toHaveBeenCalledWith(true);
  expect(screen.getAllByText(/No readable data/)).toHaveLength(5);
});

test('renders the native summary and supports refresh', async () => {
  read.mockResolvedValue({ ...empty, steps: 2500, weightKg: 60 });
  const screen = render(<AppleHealthScreen />);
  fireEvent.press(screen.getByLabelText('Connect Apple Health'));
  await waitFor(() => expect(screen.getByText('Steps: 2500')).toBeTruthy());
  expect(screen.getByText('Latest weight today: 60 kg')).toBeTruthy();
  expect(screen.getByLabelText('Refresh Apple Health')).toBeTruthy();
});

test('blocks reading on unsupported platforms', () => {
  available.mockReturnValue(false);
  const screen = render(<AppleHealthScreen />);
  fireEvent.press(screen.getByLabelText('Connect Apple Health'));
  expect(read).not.toHaveBeenCalled();
});

test('ignores a pending read after leaving the screen', async () => {
  let complete: ((value: HealthSnapshot) => void) | undefined;
  read.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  const screen = render(<AppleHealthScreen />);
  fireEvent.press(screen.getByLabelText('Connect Apple Health'));
  fireEvent.press(screen.getByLabelText('Connect Apple Health'));
  expect(read).toHaveBeenCalledTimes(1);
  screen.unmount();
  await act(async () => { complete?.(empty); });
});
