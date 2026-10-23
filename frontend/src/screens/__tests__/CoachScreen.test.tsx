import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { CoachScreen } from '../CoachScreen';
import { askCoach } from '@/services/coachApi';
import { readAppleHealth } from '@/services/appleHealth';

jest.mock('react-native-reanimated', () => {
  const chain = { springify: () => chain, damping: () => chain, stiffness: () => chain };
  return { __esModule: true, default: { View: require('react-native').View }, FadeInDown: chain };
});

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return { useNavigation: () => ({ goBack: jest.fn() }),
    useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]) };
});
jest.mock('@/stores/useAuthStore', () => ({ useAuthStore: () => 'test-user' }));
jest.mock('@/services/coachApi', () => ({ askCoach: jest.fn() }));
jest.mock('@/services/appleHealth', () => ({
  isAppleHealthAvailable: () => true, readAppleHealth: jest.fn(),
}));
jest.mock('@/utils', () => ({
  BRAND_COLORS: { textPrimary: 'black', textMuted: 'gray', error: 'red' },
  spacing: { md: 8, lg: 16, xl: 24 }, useContentBottomPadding: () => 24,
}));
jest.mock('@/components/CoachPanel', () => {
  const { View } = require('react-native');
  return { CoachPanel: View };
});
jest.mock('@/components', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return { SafeAreaWrapper: View, Text,
    Button: ({ title, onPress, disabled }: {title: string; onPress: () => void; disabled?: boolean}) =>
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} disabled={disabled}>
        <Text>{title}</Text>
      </Pressable> };
});

const mockAsk = askCoach as jest.MockedFunction<typeof askCoach>;
const mockRead = readAppleHealth as jest.MockedFunction<typeof readAppleHealth>;
const health = { date: '2026-10-23', timeZone: 'Australia/Sydney', capturedAt: '2026-10-23T04:00:00Z',
  steps: 4000, sleepMinutes: null, activeEnergyKcal: null, exerciseMinutes: null, weightKg: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockAsk.mockResolvedValue({ runId: 'test', answer: 'A small daily habit', tools: [], disclaimer: 'AI guidance' });
  mockRead.mockResolvedValue(health);
});

test('reads Health only after opt-in and clears derived conversation when sharing changes', async () => {
  const screen = render(<CoachScreen />);
  const input = screen.getByLabelText('Message to AI Coach');
  fireEvent.changeText(input, 'Help today');
  fireEvent.press(screen.getByLabelText('Ask Coach'));
  await waitFor(() => expect(screen.getByText('A small daily habit')).toBeTruthy());
  expect(mockRead).not.toHaveBeenCalled();
  expect(mockAsk).toHaveBeenLastCalledWith('Help today', [], false, null);
  fireEvent(screen.getByLabelText("Share today's Apple Health summary with AI"), 'valueChange', true);
  expect(screen.queryByText('A small daily habit')).toBeNull();
  fireEvent.changeText(input, 'Use my activity');
  fireEvent.press(screen.getByLabelText('Ask Coach'));
  await waitFor(() => expect(mockAsk).toHaveBeenLastCalledWith('Use my activity', [], true, health));
  await waitFor(() => expect(screen.getByText('A small daily habit')).toBeTruthy());
  fireEvent(screen.getByLabelText("Share today's Apple Health summary with AI"), 'valueChange', false);
  expect(screen.queryByText('A small daily habit')).toBeNull();
});

test('prevents duplicate requests and ignores completion after the visit ends', async () => {
  let resolve: ((value: Awaited<ReturnType<typeof askCoach>>) => void) | undefined;
  mockAsk.mockReturnValue(new Promise(done => { resolve = done; }));
  const screen = render(<CoachScreen />);
  fireEvent.changeText(screen.getByLabelText('Message to AI Coach'), 'Help today');
  fireEvent.press(screen.getByLabelText('Ask Coach'));
  fireEvent.press(screen.getByLabelText('Ask Coach'));
  expect(mockAsk).toHaveBeenCalledTimes(1);
  screen.unmount();
  await act(async () => { resolve?.({ runId: 'test', answer: 'Late response', tools: [], disclaimer: 'AI guidance' }); });
});
