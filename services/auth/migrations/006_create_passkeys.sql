-- +goose Up
CREATE TABLE passkeys (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT        NOT NULL UNIQUE,
  public_key    BYTEA       NOT NULL,
  aaguid        TEXT,
  sign_count    BIGINT      NOT NULL DEFAULT 0,
  device_name   VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_passkeys_user_id ON passkeys(user_id);

-- +goose Down
DROP TABLE IF EXISTS passkeys CASCADE;
