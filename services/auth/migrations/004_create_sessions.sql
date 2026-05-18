-- +goose Up
CREATE TABLE user_sessions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash          TEXT        NOT NULL UNIQUE,
  refresh_token_hash  TEXT        UNIQUE,
  ip_address          INET,
  user_agent          TEXT,
  device_fingerprint  TEXT,
  expires_at          TIMESTAMPTZ NOT NULL,
  last_active_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_sessions_refresh_token_hash ON user_sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);

-- +goose Down
DROP TABLE IF EXISTS user_sessions CASCADE;
