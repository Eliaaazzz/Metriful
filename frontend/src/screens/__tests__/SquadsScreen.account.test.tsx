import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import { SquadsScreen } from '../SquadsScreen';
import { squadsApi } from '@/services/squadsApi';

let mockUserId: string | undefined = 'account-a';
jest.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ userInfo: { userId: mockUserId } }),
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@/components/squads/SquadCreateModal', () => () => null);
jest.mock('@/components/squads/JoinSquadModal', () => () => null);
jest.mock('@/components/squads/SquadCard', () => {
  const { Text } = require('react-native');
  return ({ squad }: { squad: { name: string } }) => <Text>{squad.name}</Text>;
});
jest.mock('@/services/squadsApi', () => ({ squadsApi: { list: jest.fn() } }));

it('hides a fresh squad cache after an account switch and while signed out', async () => {
  mockUserId = 'account-a';
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const list = squadsApi.list as jest.Mock;
  list.mockResolvedValueOnce([{ id: 'squad-a', name: 'Private squad A' }]);
  list.mockImplementationOnce(() => new Promise(() => {}));
  const view = () => <QueryClientProvider client={client}><SquadsScreen /></QueryClientProvider>;
  const { getByText, queryByText, rerender, unmount } = render(view());
  await waitFor(() => expect(getByText('Private squad A')).toBeTruthy());
  mockUserId = undefined;
  rerender(view());
  expect(queryByText('Private squad A')).toBeNull();
  mockUserId = 'account-b';
  rerender(view());
  await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  expect(queryByText('Private squad A')).toBeNull();
  unmount();
  client.clear();
});
