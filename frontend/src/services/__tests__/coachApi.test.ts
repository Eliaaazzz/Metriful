import { askCoach, CoachMessage } from '../coachApi';
import { api } from '../apiClient';
import { HealthSnapshot } from '../appleHealth';

jest.mock('../apiClient', () => ({ api: { post: jest.fn() } }));
jest.mock('../appleHealth', () => ({}));

const health: HealthSnapshot = {
  date: '2026-10-23', timeZone: 'Australia/Sydney', capturedAt: '2026-10-23T04:00:00Z',
  steps: 4000, activeEnergyKcal: 200, exerciseMinutes: 20, sleepMinutes: null, weightKg: null,
};

beforeEach(() => jest.clearAllMocks());

test('never sends a retained health snapshot without explicit consent', async () => {
  await askCoach('How is my day?', [], false, health);
  expect(api.post).toHaveBeenCalledWith('/api/v1/coach/runs', expect.objectContaining({
    shareHealth: false, health: null, message: 'How is my day?',
  }), { timeout: 30000 });
});

test('shares only the selected snapshot and bounds conversation history', async () => {
  const history: CoachMessage[] = Array.from({ length: 10 }, (_, i) => ({ role: 'user', content: String(i) }));
  await askCoach('How is my day?', history, true, health);
  expect(api.post).toHaveBeenCalledWith('/api/v1/coach/runs', expect.objectContaining({
    shareHealth: true, health, history: history.slice(-6),
  }), expect.anything());
});
