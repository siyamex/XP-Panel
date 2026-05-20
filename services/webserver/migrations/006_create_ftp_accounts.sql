-- +goose Up
CREATE TABLE ftp_accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL,
  user_id      UUID NOT NULL,
  username     VARCHAR(100) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  home_dir     TEXT NOT NULL,
  quota_mb     INT NOT NULL DEFAULT 0,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ftp_accounts_org ON ftp_accounts(org_id);

-- +goose Down
DROP TABLE IF EXISTS ftp_accounts;
