-- +goose Up
CREATE TABLE IF NOT EXISTS mailboxes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL,
  domain          VARCHAR(253) NOT NULL,
  username        VARCHAR(100) NOT NULL,
  email           VARCHAR(354) NOT NULL UNIQUE,
  password_hash   TEXT        NOT NULL,
  quota_mb        INT         NOT NULL DEFAULT 1024,
  used_mb         INT         NOT NULL DEFAULT 0,
  enabled         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(domain, username)
);
CREATE INDEX IF NOT EXISTS idx_mailboxes_org ON mailboxes(organization_id);
CREATE INDEX IF NOT EXISTS idx_mailboxes_domain ON mailboxes(domain);

-- +goose Down
DROP TABLE IF EXISTS mailboxes;
