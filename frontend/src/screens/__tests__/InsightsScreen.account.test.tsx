import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import { InsightsScreen } from '../InsightsScreen';
import { insightsApi } from '@/services/insightsApi';

let mockUserId: string | undefined = 'account-a';
jest.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ userInfo: { userId: mockUserId } }),
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@/components/insights/InsightCard', () => {
  const { Text } = require('react-native');
  return { InsightCard: ({ insight }: { insight: { sentence: string } }) => <Text>{insight.sentence}</Text> };
});
jest.mock('@/components/insights/InsightsOnboardingCard', () => ({ InsightsOnboardingCard: () => null }));
jest.mock('@/services/insightsApi', () => ({ insightsApi: { list: jest.fn(), coldStart: jest.fn() } }));

it('hides fresh health insights after an account switch and while signed out', async () => {
  mockUserId = 'account-a';
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const list = insightsApi.list as jest.Mock;
  (insightsApi.coldStart as jest.Mock).mockResolvedValue({ daysLogged: 35, target: 30, unlocked: true });
  list.mockResolvedValueOnce([{ id: 1, sentence: 'Private health insight A' }]);
  list.mockImplementationOnce(() => new Promise(() => {}));
  const view = () => <QueryClientProvider client={client}><InsightsScreen /></QueryClientProvider>;
  const { getByText, queryByText, rerender, unmount } = render(view());
  await waitFor(() => expect(getByText('Private health insight A')).toBeTruthy());
  mockUserId = undefined;
  rerender(view());
  expect(queryByText('Private health insight A')).toBeNull();
  mockUserId = 'account-b';
  rerender(view());
  await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  expect(queryByText('Private health insight A')).toBeNull();
  unmount();
  client.clear();
});
