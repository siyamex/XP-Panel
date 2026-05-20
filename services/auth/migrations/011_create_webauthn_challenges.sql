-- +goose Up
CREATE TABLE webauthn_challenges (
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(20) NOT NULL CHECK (type IN ('register','authenticate')),
  challenge  TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, type)
);

-- +goose Down
DROP TABLE IF EXISTS webauthn_challenges;
