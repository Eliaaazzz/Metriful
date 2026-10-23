/**
 * Squads — feature #220.
 *
 * Field shapes mirror the Spring Boot DTOs in
 * com.fitnessapp.backend.squad.dto.* — the API client unwraps the
 * `ApiEnvelope<T>` so consumers see `T` directly.
 */

export interface Squad {
  id: string;
  name: string;
  emoji: string;
  inviteCode: string;
  ownerUserId: string;
  memberCount: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDay: string | null;
  timezone: string;
  createdAt: string | null;
}

export interface SquadMemberSummary {
  userId: string;
  role: 'owner' | 'member';
  joinedAt: string | null;
}

export interface SquadDetail {
  squad: Squad;
  members: SquadMemberSummary[];
}

export interface LeaderboardEntry {
  userId: string;
  rank: number;        // 0 means warming up (unranked)
  mealsLogged: number;
  daysActive: number;
  warmingUp: boolean;
}

export interface KudosResponse {
  mealLogId: number;
  kudosCount: number;
  kudoed: boolean;
}

export interface CreateSquadPayload {
  name: string;
  emoji: string;
  timezone?: string;
}

export interface JoinSquadPayload {
  inviteCode: string;
}
