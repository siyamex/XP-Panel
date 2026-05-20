-- +goose Up
CREATE TABLE autoresponders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL,
  email        VARCHAR(255) NOT NULL UNIQUE,
  subject      VARCHAR(500) NOT NULL,
  body         TEXT NOT NULL,
  from_name    VARCHAR(255),
  start_at     TIMESTAMPTZ,
  end_at       TIMESTAMPTZ,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE email_filters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL,
  mailbox      VARCHAR(255) NOT NULL,
  name         VARCHAR(255) NOT NULL,
  rules        JSONB NOT NULL DEFAULT '[]',
  action       VARCHAR(50) NOT NULL,
  action_value TEXT,
  priority     INT NOT NULL DEFAULT 0,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_email_filters_mailbox ON email_filters(mailbox);

-- +goose Down
DROP TABLE IF EXISTS email_filters;
DROP TABLE IF EXISTS autoresponders;
