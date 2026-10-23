/**
 * KudosButton unit tests.
 *
 * Covers: optimistic toggle, server reconciliation, rapid double-tap debounce
 * (via the in-flight `pending` flag), revert on API error.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { KudosButton } from '../KudosButton';
import { squadsApi } from '@/services/squadsApi';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('@/services/squadsApi', () => ({
  squadsApi: { toggleKudos: jest.fn() },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
}));

describe('KudosButton', () => {
  const toggleSpy = squadsApi.toggleKudos as jest.Mock;

  beforeEach(() => {
    toggleSpy.mockReset();
  });

  it('toggles kudoed state optimistically and reconciles with server', async () => {
    toggleSpy.mockResolvedValueOnce({ mealLogId: 1, kudosCount: 4, kudoed: true });

    const { getByTestId, getByText } = render(
      <KudosButton mealLogId={1} initialCount={3} initialKudoed={false} />,
    );

    fireEvent.press(getByTestId('kudos-button-1'));

    // Optimistic
    expect(getByText('4')).toBeTruthy();

    // Server reconciliation lands the same number
    await waitFor(() => expect(toggleSpy).toHaveBeenCalledTimes(1));
    expect(getByText('4')).toBeTruthy();
  });

  it('reverts state when API call fails', async () => {
    toggleSpy.mockRejectedValueOnce(new Error('network'));
    const onError = jest.fn();

    const { getByTestId, queryByText, getByText } = render(
      <KudosButton mealLogId={2} initialCount={5} initialKudoed={false} onError={onError} />,
    );

    fireEvent.press(getByTestId('kudos-button-2'));
    expect(getByText('6')).toBeTruthy(); // optimistic +1

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    // Reverted to original count, original kudoed=false (button not "active")
    expect(getByText('5')).toBeTruthy();
    expect(queryByText('6')).toBeNull();
  });

  it('only fires one network call on rapid double-tap (in-flight debounce)', async () => {
    toggleSpy.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ mealLogId: 3, kudosCount: 1, kudoed: true }), 30)),
    );

    const { getByTestId } = render(
      <KudosButton mealLogId={3} initialCount={0} initialKudoed={false} />,
    );

    fireEvent.press(getByTestId('kudos-button-3'));
    fireEvent.press(getByTestId('kudos-button-3'));
    fireEvent.press(getByTestId('kudos-button-3'));

    await waitFor(() => expect(toggleSpy).toHaveBeenCalledTimes(1));
  });

  it('does not fire when disabled (e.g. own meal)', () => {
    const { getByTestId } = render(
      <KudosButton mealLogId={4} initialCount={0} initialKudoed={false} enabled={false} />,
    );
    fireEvent.press(getByTestId('kudos-button-4'));
    expect(toggleSpy).not.toHaveBeenCalled();
  });
});
