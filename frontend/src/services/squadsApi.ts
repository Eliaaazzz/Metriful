/**
 * Squads API — feature #220.
 *
 * The shared `apiClient` already unwraps `ApiEnvelope<T>` so each helper
 * resolves directly to the inner DTO shape from the backend.
 */
import { api } from './apiClient';
import type {
  CreateSquadPayload,
  JoinSquadPayload,
  KudosResponse,
  LeaderboardEntry,
  Squad,
  SquadDetail,
} from '@/types/squads';

const list = (): Promise<Squad[]> => api.get<Squad[]>('/api/v1/squads');

const detail = (squadId: string): Promise<SquadDetail> =>
  api.get<SquadDetail>(`/api/v1/squads/${squadId}`);

const create = (payload: CreateSquadPayload): Promise<Squad> =>
  api.post<Squad>('/api/v1/squads', payload);

const join = (payload: JoinSquadPayload): Promise<Squad> =>
  api.post<Squad>('/api/v1/squads/join', payload);

const leave = (squadId: string): Promise<void> =>
  api.post<void>(`/api/v1/squads/${squadId}/leave`);

const removeMember = (squadId: string, targetUserId: string): Promise<void> =>
  api.delete<void>(`/api/v1/squads/${squadId}/members/${targetUserId}`);

const leaderboard = (squadId: string): Promise<LeaderboardEntry[]> =>
  api.get<LeaderboardEntry[]>(`/api/v1/squads/${squadId}/leaderboard`);

const toggleKudos = (mealLogId: number): Promise<KudosResponse> =>
  api.post<KudosResponse>(`/api/v1/meal-logs/${mealLogId}/kudos`);

export const squadsApi = {
  list,
  detail,
  create,
  join,
  leave,
  removeMember,
  leaderboard,
  toggleKudos,
};

export default squadsApi;
