-- ============================================================================
-- V53: Behavior Insights — habit ↔ daily-score correlation engine
-- ============================================================================
-- Implements feature #221. Inspired by Whoop's 2026 Behavior Insights:
-- "On days you ate breakfast, your score is +6.2 higher (n=23, conf=high)".
--
-- Two tables:
--   user_behavior_days   — one row per (user, day, behavior_key); observed +
--                          the day's daily_score, computed nightly from
--                          meal_log activity.
--   behavior_insights    — one row per (user, behavior_key) holding the latest
--                          stats result (Welch t-test + Cohen's d + sample
--                          size) plus user-controllable pin / dismiss state.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_behavior_days (
    user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day          DATE         NOT NULL,
    behavior_key VARCHAR(64)  NOT NULL,
    observed     BOOLEAN      NOT NULL,
    daily_score  SMALLINT,                          -- 0..100, NULL until computed
    PRIMARY KEY (user_id, day, behavior_key)
);

CREATE INDEX IF NOT EXISTS idx_ubd_user_behavior_day
    ON user_behavior_days(user_id, behavior_key, day DESC);

CREATE INDEX IF NOT EXISTS idx_ubd_user_day
    ON user_behavior_days(user_id, day DESC);

CREATE TABLE IF NOT EXISTS behavior_insights (
    id              BIGSERIAL    PRIMARY KEY,
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    behavior_key    VARCHAR(64)  NOT NULL,
    delta_score     NUMERIC(6,2) NOT NULL,            -- mean(yes-days) - mean(no-days)
    cohens_d        NUMERIC(6,3) NOT NULL,
    p_value         NUMERIC(7,4) NOT NULL,
    sample_yes      INTEGER      NOT NULL,
    sample_no       INTEGER      NOT NULL,
    confidence      VARCHAR(8)   NOT NULL,            -- 'high' | 'med' | 'low'
    computed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    pinned          BOOLEAN      NOT NULL DEFAULT FALSE,
    dismissed_until DATE,
    UNIQUE (user_id, behavior_key)
);

CREATE INDEX IF NOT EXISTS idx_insights_user_pinned ON behavior_insights(user_id, pinned);
CREATE INDEX IF NOT EXISTS idx_insights_user_computed ON behavior_insights(user_id, computed_at DESC);
