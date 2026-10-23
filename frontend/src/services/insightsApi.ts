/**
 * Behavior Insights API — feature #221.
 */
import { api } from './apiClient';
import type {
  ColdStartStatus,
  Insight,
  InsightDetail,
} from '@/types/insights';

const list = (): Promise<Insight[]> => api.get<Insight[]>('/api/v1/insights');

const coldStart = (): Promise<ColdStartStatus> =>
  api.get<ColdStartStatus>('/api/v1/insights/cold-start');

const detail = (id: number): Promise<InsightDetail> =>
  api.get<InsightDetail>(`/api/v1/insights/${id}/detail`);

const pin = (id: number): Promise<Insight> =>
  api.post<Insight>(`/api/v1/insights/${id}/pin`);

const unpin = (id: number): Promise<Insight> =>
  api.delete<Insight>(`/api/v1/insights/${id}/pin`);

const dismiss = (id: number): Promise<void> =>
  api.post<void>(`/api/v1/insights/${id}/dismiss`);

const recompute = (): Promise<{ insightsWritten: number }> =>
  api.post<{ insightsWritten: number }>('/api/v1/insights/recompute');

const backfill = (): Promise<{ daysProcessed: number; insightsWritten: number }> =>
  api.post<{ daysProcessed: number; insightsWritten: number }>('/api/v1/insights/backfill');

export const insightsApi = {
  list,
  coldStart,
  detail,
  pin,
  unpin,
  dismiss,
  recompute,
  backfill,
};

export default insightsApi;
