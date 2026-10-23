import { api } from './apiClient';
import { HealthSnapshot } from './appleHealth';
import { formatLocalDateKey } from '@/utils/date';

export interface CoachMessage { role: 'user' | 'assistant'; content: string }
export interface CoachResponse {
  runId: string;
  answer: string;
  tools: { name: string; durationMs: number }[];
  disclaimer: string;
}

export function askCoach(message: string, history: CoachMessage[], shareHealth: boolean,
                         health: HealthSnapshot | null): Promise<CoachResponse> {
  return api.post<CoachResponse>('/api/v1/coach/runs', {
    message,
    date: shareHealth && health ? health.date : formatLocalDateKey(new Date()),
    timeZone: shareHealth && health ? health.timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone,
    history: history.slice(-6),
    shareHealth,
    health: shareHealth ? health : null,
  }, { timeout: 30000 });
}
