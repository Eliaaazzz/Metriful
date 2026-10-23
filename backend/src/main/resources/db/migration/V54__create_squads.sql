-- ============================================================================
-- V54: Squads, social streak groups, Kudos, leaderboard
-- ============================================================================
-- Implements feature #220 (Squads). Adapts the Strava Clubs + Duolingo group
-- streak retention pattern to nutrition logging:
--   - 3–10 person groups identified by 6-char invite code
--   - per-meal Kudos (toggle, idempotent)
--   - shared Squad streak (≥1 member logs per day → +1)
--   - 7-day leaderboard ranked by meal-log activity
--
-- Service-layer rules (NOT enforced by SQL — see SquadService):
--   - max 3 active squads per user
--   - max 10 members per squad
--   - kudos only allowed on meal_log rows from same-squad members within 7d
-- ============================================================================

-- Squads
CREATE TABLE IF NOT EXISTS squads (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(30)  NOT NULL,
    emoji             VARCHAR(8)   NOT NULL,
    invite_code       VARCHAR(6)   NOT NULL UNIQUE,
    owner_user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_streak    INTEGER      NOT NULL DEFAULT 0,
    longest_streak    INTEGER      NOT NULL DEFAULT 0,
    last_active_day   DATE,
    timezone          VARCHAR(64)  NOT NULL DEFAULT 'UTC',
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_squads_owner ON squads(owner_user_id);

-- Squad members (composite PK)
CREATE TABLE IF NOT EXISTS squad_members (
    squad_id    UUID         NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
    user_id     UUID         NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    role        VARCHAR(16)  NOT NULL DEFAULT 'member',  -- 'owner' | 'member'
    joined_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (squad_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_squad_members_user ON squad_members(user_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_squad ON squad_members(squad_id);

-- Kudos on meal logs
CREATE TABLE IF NOT EXISTS meal_log_kudos (
    meal_log_id  BIGINT       NOT NULL REFERENCES meal_log(id) ON DELETE CASCADE,
    user_id      UUID         NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (meal_log_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_meal_log_kudos_meal ON meal_log_kudos(meal_log_id);
CREATE INDEX IF NOT EXISTS idx_meal_log_kudos_user ON meal_log_kudos(user_id);
